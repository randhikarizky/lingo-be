import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentWebhookPayload,
  VerifiedWebhookResult,
} from "../types/billing.types";

export type ProviderCreatePaymentInput = CreatePaymentInput & {
  merchantOrderId: string;
  invoiceNumber: string;
  amount: number;
  productLabel: string;
  durationLabel: string;
};

export type ProviderTransactionStatus = {
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  providerReference?: string;
  paymentMethod?: string;
};

export type PaymentMethodOption = {
  code: string;
  name: string;
  imageUrl?: string;
  fee?: number;
};

export interface PaymentProvider {
  readonly id: string;

  createPayment(
    input: ProviderCreatePaymentInput,
  ): Promise<CreatePaymentResult>;

  getPaymentMethods?(amount: number): Promise<PaymentMethodOption[]>;

  getTransaction(
    merchantOrderId: string,
  ): Promise<ProviderTransactionStatus | null>;

  verifyWebhook(payload: PaymentWebhookPayload): VerifiedWebhookResult;

  cancelPayment?(merchantOrderId: string): Promise<void>;
}
