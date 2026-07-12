import type { PlanType } from "@prisma/client";

export type BillingProductId =
  | "pro-1m"
  | "pro-3m"
  | "pro-6m"
  | "pro-12m"
  | "pro-24m";

export type TransactionStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";

export type PaymentProviderId = "duitku" | "mock";

export type BillingProduct = {
  id: BillingProductId;
  planId: PlanType;
  label: string;
  durationMonths: number;
  durationLabel: string;
  listPrice: number;
  finalPrice: number;
  discountPercent: number;
  currency: "IDR";
};

export type CreatePaymentInput = {
  userId: string;
  userEmail: string;
  userName: string;
  productId: BillingProductId;
  paymentMethod?: string;
};

export type CreatePaymentResult = {
  transactionId: string;
  invoiceNumber: string;
  paymentUrl: string;
  amount: number;
  expiredAt: string;
  provider: PaymentProviderId;
  providerReference?: string;
};

export type PaymentWebhookPayload = {
  merchantCode: string;
  amount: string | number;
  merchantOrderId: string;
  reference?: string;
  resultCode: string;
  signature: string;
  paymentMethod?: string;
};

export type VerifiedWebhookResult = {
  verified: boolean;
  merchantOrderId: string;
  amount: number;
  resultCode: string;
  reference?: string;
  paymentMethod?: string;
};
