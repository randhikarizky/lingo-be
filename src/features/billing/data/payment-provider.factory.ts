import { getDuitkuConfig } from "@/features/billing/infrastructure/duitku.client";
import { DuitkuPaymentProvider } from "@/features/billing/data/providers/duitku-payment.provider";
import { MockPaymentProvider } from "@/features/billing/data/providers/mock-payment.provider";
import type { PaymentProvider } from "@/features/billing/domain/ports/payment-provider.interface";

export function resolvePaymentProvider(): PaymentProvider {
  const configured = process.env.PAYMENT_PROVIDER?.trim() || "duitku";

  if (configured === "mock") {
    return new MockPaymentProvider();
  }

  const duitkuConfig = getDuitkuConfig();
  if (duitkuConfig) {
    return new DuitkuPaymentProvider(duitkuConfig);
  }

  if (process.env.NODE_ENV !== "production") {
    return new MockPaymentProvider();
  }

  throw new Error("Payment provider belum dikonfigurasi");
}
