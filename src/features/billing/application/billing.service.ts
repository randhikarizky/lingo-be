import { randomUUID } from "crypto";

import { prisma } from "@/global/database/prisma";
import { logBillingAnalyticsEvent } from "@/features/billing/application/billing.analytics";
import { billingRetryQueue } from "@/features/billing/application/billing-retry-queue.service";
import { invoiceService } from "@/features/billing/application/invoice.service";
import { transactionService } from "@/features/billing/application/transaction.service";
import { resolvePaymentProvider } from "@/features/billing/data/payment-provider.factory";
import {
  getBillingProduct,
  listBillingProducts,
} from "@/features/billing/domain/constants/billing-catalog";
import type {
  BillingProductId,
  PaymentWebhookPayload,
} from "@/features/billing/domain/types/billing.types";
import { getDuitkuConfig } from "@/features/billing/infrastructure/duitku.client";
import { planService } from "@/features/subscription/application/plan.service";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export class BillingService {
  getCatalog() {
    return listBillingProducts();
  }

  async getPaymentMethods(productId: BillingProductId) {
    const product = getBillingProduct(productId);
    const provider = resolvePaymentProvider();

    if (!provider.getPaymentMethods) {
      return [];
    }

    return provider.getPaymentMethods(product.finalPrice);
  }

  async createPayment(input: {
    userId: string;
    userEmail: string;
    userName: string;
    productId: BillingProductId;
    paymentMethod?: string;
  }) {
    const product = getBillingProduct(input.productId);
    const provider = resolvePaymentProvider();
    const transactionId = randomUUID();
    const invoiceNumber = await invoiceService.generateInvoiceNumber();
    const expiredAt = new Date(Date.now() + 60 * 60 * 1000);

    await transactionService.createTransaction({
      id: transactionId,
      invoiceNumber,
      userId: input.userId,
      planId: product.planId,
      billingProductId: product.id,
      durationMonths: product.durationMonths,
      provider: provider.id,
      amount: product.finalPrice,
      expiredAt,
    });

    const payment = await provider.createPayment({
      ...input,
      merchantOrderId: transactionId,
      invoiceNumber,
      amount: product.finalPrice,
      productLabel: product.label,
      durationLabel: product.durationLabel,
    });

    await transactionService.markPending(
      transactionId,
      payment.providerReference,
    );

    await invoiceService.createDraftInvoice({
      transactionId,
      invoiceNumber,
      amount: product.finalPrice,
      currency: product.currency,
    });

    logBillingAnalyticsEvent("payment_created", {
      userId: input.userId,
      transactionId,
      productId: product.id,
      amount: product.finalPrice,
      provider: provider.id,
    });

    return {
      transactionId,
      invoiceNumber,
      paymentUrl: payment.paymentUrl,
      amount: product.finalPrice,
      listPrice: product.listPrice,
      discountPercent: product.discountPercent,
      product,
      expiredAt: expiredAt.toISOString(),
      provider: provider.id,
      providerReference: payment.providerReference,
    };
  }

  async getTransactionDetail(userId: string, transactionId: string) {
    const transaction = await transactionService.findById(transactionId);
    if (!transaction || transaction.userId !== userId) {
      return null;
    }

    const product = getBillingProduct(
      transaction.billingProductId as BillingProductId,
    );

    return {
      id: transaction.id,
      invoiceNumber: transaction.invoiceNumber,
      planId: transaction.planId,
      product,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      provider: transaction.provider,
      providerReference: transaction.providerReference,
      expiredAt: transaction.expiredAt?.toISOString() ?? null,
      paidAt: transaction.paidAt?.toISOString() ?? null,
      createdAt: transaction.createdAt.toISOString(),
      invoice: transaction.invoice
        ? {
            id: transaction.invoice.id,
            status: transaction.invoice.status,
            issuedAt: transaction.invoice.issuedAt.toISOString(),
          }
        : null,
    };
  }

  async listHistory(userId: string) {
    await this.expireStaleTransactions();
    const transactions = await transactionService.listByUser(userId);

    return transactions.map((transaction) => {
      const product = getBillingProduct(
        transaction.billingProductId as BillingProductId,
      );

      return {
        id: transaction.id,
        invoiceNumber: transaction.invoiceNumber,
        planLabel: product.label,
        durationLabel: product.durationLabel,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        paidAt: transaction.paidAt?.toISOString() ?? null,
        createdAt: transaction.createdAt.toISOString(),
      };
    });
  }

  async processWebhook(providerId: string, payload: PaymentWebhookPayload) {
    const provider = resolvePaymentProvider();
    const verification = provider.verifyWebhook(payload);

    await prisma.paymentWebhook.create({
      data: {
        provider: providerId,
        payload,
        signature: payload.signature,
        verified: verification.verified,
      },
    });

    if (!verification.verified) {
      billingRetryQueue.enqueue(providerId, payload as unknown as Record<string, unknown>);
      return { processed: false, reason: "invalid_signature" as const };
    }

    const duitkuConfig = getDuitkuConfig();
    if (
      providerId === "duitku" &&
      duitkuConfig &&
      payload.merchantCode !== duitkuConfig.merchantCode
    ) {
      return { processed: false, reason: "invalid_merchant" as const };
    }

    const transaction = await transactionService.findById(
      verification.merchantOrderId,
    );

    if (!transaction) {
      return { processed: false, reason: "transaction_not_found" as const };
    }

    if (transaction.amount !== verification.amount) {
      return { processed: false, reason: "amount_mismatch" as const };
    }

    if (transaction.status === "PAID") {
      return { processed: true, reason: "already_paid" as const };
    }

    if (verification.resultCode === "00") {
      await this.activateSubscription(transaction.id, {
        providerReference: verification.reference,
        paymentMethod: verification.paymentMethod,
      });
      return { processed: true, reason: "paid" as const };
    }

    if (verification.resultCode === "01") {
      await transactionService.updateStatus(transaction.id, "FAILED", {
        paymentMethod: verification.paymentMethod,
      });
      logBillingAnalyticsEvent("payment_failed", {
        transactionId: transaction.id,
        userId: transaction.userId,
      });
      return { processed: true, reason: "failed" as const };
    }

    billingRetryQueue.enqueue(providerId, payload as unknown as Record<string, unknown>);
    return { processed: false, reason: "ignored" as const };
  }

  async activateSubscription(
    transactionId: string,
    extras?: {
      providerReference?: string;
      paymentMethod?: string;
    },
  ) {
    const transaction = await transactionService.findById(transactionId);
    if (!transaction || transaction.status === "PAID") {
      return transaction;
    }

    const paidAt = new Date();
    const userPlan = await planService.ensureUserPlan(transaction.userId);
    const extensionBase =
      userPlan.expiredAt && userPlan.expiredAt > paidAt
        ? userPlan.expiredAt
        : paidAt;
    const expiredAt = addMonths(extensionBase, transaction.durationMonths);

    await transactionService.updateStatus(transaction.id, "PAID", {
      providerReference:
        extras?.providerReference ?? transaction.providerReference ?? undefined,
      paymentMethod: extras?.paymentMethod,
      paidAt,
    });
    await invoiceService.markPaid(transaction.id);
    await planService.activatePaidPlan(
      transaction.userId,
      transaction.planId,
      expiredAt,
    );

    logBillingAnalyticsEvent("payment_success", {
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
    });
    logBillingAnalyticsEvent("subscription_activated", {
      transactionId: transaction.id,
      userId: transaction.userId,
      planId: transaction.planId,
      expiredAt: expiredAt.toISOString(),
    });

    return transaction;
  }

  async completeMockPayment(transactionId: string, userId: string) {
    const transaction = await transactionService.findById(transactionId);
    if (!transaction || transaction.userId !== userId) {
      throw new Error("Transaksi tidak ditemukan");
    }

    if (transaction.provider !== "mock") {
      throw new Error("Mock payment tidak tersedia untuk transaksi ini");
    }

    if (transaction.expiredAt && transaction.expiredAt < new Date()) {
      await transactionService.updateStatus(transaction.id, "EXPIRED");
      logBillingAnalyticsEvent("payment_expired", {
        transactionId: transaction.id,
        userId: transaction.userId,
      });
      throw new Error("Transaksi telah kedaluwarsa");
    }

    return this.activateSubscription(transaction.id);
  }

  async syncReturnStatus(input: {
    userId: string;
    transactionId: string;
    resultCode?: string | null;
  }) {
    const transaction = await transactionService.findById(input.transactionId);
    if (!transaction || transaction.userId !== input.userId) {
      return null;
    }

    if (transaction.status === "PAID") {
      return this.getTransactionDetail(input.userId, input.transactionId);
    }

    if (transaction.expiredAt && transaction.expiredAt < new Date()) {
      await transactionService.updateStatus(transaction.id, "EXPIRED");
      logBillingAnalyticsEvent("payment_expired", {
        transactionId: transaction.id,
        userId: transaction.userId,
      });
      return this.getTransactionDetail(input.userId, input.transactionId);
    }

    if (input.resultCode === "00" && transaction.provider === "mock") {
      await this.activateSubscription(transaction.id);
      return this.getTransactionDetail(input.userId, input.transactionId);
    }

    if (transaction.provider === "duitku" && transaction.status === "PENDING") {
      const provider = resolvePaymentProvider();
      const remote = await provider.getTransaction(transaction.id);
      if (remote?.status === "PAID") {
        await this.activateSubscription(transaction.id, {
          providerReference: remote.providerReference,
          paymentMethod: remote.paymentMethod,
        });
      }
    }

    return this.getTransactionDetail(input.userId, input.transactionId);
  }

  async expireStaleTransactions() {
    const stale = await prisma.paymentTransaction.findMany({
      where: {
        status: { in: ["CREATED", "PENDING"] },
        expiredAt: { lt: new Date() },
      },
      select: { id: true, userId: true },
    });

    for (const transaction of stale) {
      await transactionService.updateStatus(transaction.id, "EXPIRED");
      logBillingAnalyticsEvent("payment_expired", {
        transactionId: transaction.id,
        userId: transaction.userId,
      });
    }

    return stale.length;
  }
}

export const billingService = new BillingService();
