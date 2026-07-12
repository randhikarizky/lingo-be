import type { PaymentProvider } from "@/features/billing/domain/ports/payment-provider.interface";
import type {
  CreatePaymentResult,
  PaymentWebhookPayload,
  VerifiedWebhookResult,
} from "@/features/billing/domain/types/billing.types";
import type {
  PaymentMethodOption,
  ProviderCreatePaymentInput,
} from "@/features/billing/domain/ports/payment-provider.interface";

const MOCK_PAYMENT_METHODS: PaymentMethodOption[] = [
  { code: "QRIS", name: "QRIS", fee: 0 },
  { code: "VA", name: "Virtual Account", fee: 0 },
  { code: "EW", name: "E-Wallet", fee: 0 },
  { code: "BT", name: "Bank Transfer", fee: 0 },
];

function getFrontendBaseUrl() {
  return process.env.FRONTEND_BASE_URL?.trim() || "http://localhost:3626";
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";

  async createPayment(
    input: ProviderCreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    const expiredAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const paymentUrl = `${getFrontendBaseUrl()}/pricing/payment/mock?transactionId=${input.merchantOrderId}`;

    return {
      transactionId: input.merchantOrderId,
      invoiceNumber: input.invoiceNumber,
      paymentUrl,
      amount: input.amount,
      expiredAt,
      provider: "mock",
    };
  }

  async getPaymentMethods() {
    return MOCK_PAYMENT_METHODS;
  }

  async getTransaction() {
    return { status: "PENDING" as const };
  }

  verifyWebhook(payload: PaymentWebhookPayload): VerifiedWebhookResult {
    return {
      verified: true,
      merchantOrderId: payload.merchantOrderId,
      amount: Number(payload.amount),
      resultCode: payload.resultCode,
      reference: payload.reference,
      paymentMethod: payload.paymentMethod,
    };
  }
}
