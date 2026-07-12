import {
  DuitkuClient,
  getDuitkuConfig,
  verifyDuitkuWebhookSignature,
} from "@/features/billing/infrastructure/duitku.client";
import type { PaymentProvider } from "@/features/billing/domain/ports/payment-provider.interface";
import type {
  CreatePaymentResult,
  PaymentWebhookPayload,
  VerifiedWebhookResult,
} from "@/features/billing/domain/types/billing.types";
import type { ProviderCreatePaymentInput } from "@/features/billing/domain/ports/payment-provider.interface";

export class DuitkuPaymentProvider implements PaymentProvider {
  readonly id = "duitku";
  private readonly client: DuitkuClient;
  private readonly config: NonNullable<ReturnType<typeof getDuitkuConfig>>;

  constructor(config: NonNullable<ReturnType<typeof getDuitkuConfig>>) {
    this.config = config;
    this.client = new DuitkuClient(config);
  }

  async createPayment(
    input: ProviderCreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    const inquiry = await this.client.createInquiry({
      merchantOrderId: input.merchantOrderId,
      paymentAmount: input.amount,
      productDetails: `${input.productLabel} - ${input.durationLabel}`,
      email: input.userEmail,
      customerVaName: input.userName,
      paymentMethod: input.paymentMethod,
      expiryPeriodMinutes: 60,
    });

    const expiredAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      transactionId: input.merchantOrderId,
      invoiceNumber: input.invoiceNumber,
      paymentUrl: inquiry.paymentUrl!,
      amount: input.amount,
      expiredAt,
      provider: "duitku",
      providerReference: inquiry.reference,
    };
  }

  async getPaymentMethods(amount: number) {
    const methods = await this.client.getPaymentMethods(amount);
    return methods.map((method) => ({
      code: method.paymentMethod,
      name: method.paymentName,
      imageUrl: method.paymentImage,
      fee: Number(method.totalFee ?? 0),
    }));
  }

  async getTransaction(merchantOrderId: string) {
    const result = await this.client.checkTransaction(merchantOrderId);
    if (!result) return null;

    const code = result.resultCode ?? result.statusCode;
    if (code === "00") {
      return {
        status: "PAID" as const,
        providerReference: result.reference,
        paymentMethod: result.paymentMethod,
      };
    }

    if (code === "01") {
      return { status: "PENDING" as const, providerReference: result.reference };
    }

    return { status: "FAILED" as const, providerReference: result.reference };
  }

  verifyWebhook(payload: PaymentWebhookPayload): VerifiedWebhookResult {
    const verified = verifyDuitkuWebhookSignature({
      merchantCode: payload.merchantCode,
      amount: payload.amount,
      merchantOrderId: payload.merchantOrderId,
      signature: payload.signature,
      apiKey: this.config.apiKey,
    });

    return {
      verified,
      merchantOrderId: payload.merchantOrderId,
      amount: Number(payload.amount),
      resultCode: payload.resultCode,
      reference: payload.reference,
      paymentMethod: payload.paymentMethod,
    };
  }
}
