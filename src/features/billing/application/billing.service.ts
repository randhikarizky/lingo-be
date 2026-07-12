import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";
import { prisma } from "@/global/database/prisma";
import { logBillingAnalyticsEvent } from "@/features/billing/application/billing.analytics";
import { billingRetryQueue } from "@/features/billing/application/billing-retry-queue.service";
import { invoiceService } from "@/features/billing/application/invoice.service";
import { paymentAuditService } from "@/features/billing/application/payment-audit.service";
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

function getFrontendBaseUrl() {
  return process.env.FRONTEND_BASE_URL?.trim() || "http://localhost:3626";
}

function resolvePaymentUrl(transaction: {
  id: string;
  provider: string;
  paymentUrl: string | null;
}) {
  if (transaction.paymentUrl) {
    return transaction.paymentUrl;
  }

  if (transaction.provider === "mock") {
    return `${getFrontendBaseUrl()}/pricing/payment/mock?transactionId=${transaction.id}`;
  }

  return null;
}

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
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
    const expiredAt = new Date(Date.now() + 60 * 60 * 1000);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const transactionId = randomUUID();
      const invoiceNumber = await invoiceService.generateInvoiceNumber();

      try {
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
          {
            paymentUrl: payment.paymentUrl,
            paymentMethod: input.paymentMethod,
          },
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
      } catch (error) {
        const isDuplicateInvoice =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          Array.isArray(error.meta?.target) &&
          (error.meta.target as string[]).includes("invoiceNumber");

        if (isDuplicateInvoice && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Gagal membuat nomor invoice unik");
  }

  async getTransactionDetail(userId: string, transactionId: string) {
    const transaction = await transactionService.findById(transactionId);
    if (!transaction || transaction.userId !== userId) {
      return null;
    }

    const product = getBillingProduct(
      transaction.billingProductId as BillingProductId,
    );
    const discountAmount = product.listPrice - product.finalPrice;
    const isPending =
      transaction.status === "PENDING" || transaction.status === "CREATED";
    const isExpired =
      transaction.expiredAt !== null && transaction.expiredAt < new Date();

    return {
      id: transaction.id,
      invoiceNumber: transaction.invoiceNumber,
      planId: transaction.planId,
      product,
      amount: transaction.amount,
      listPrice: product.listPrice,
      discountAmount,
      discountPercent: product.discountPercent,
      taxAmount: 0,
      currency: transaction.currency,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      paymentUrl:
        isPending && !isExpired ? resolvePaymentUrl(transaction) : null,
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
        expiredAt: transaction.expiredAt?.toISOString() ?? null,
        paymentUrl:
          transaction.status === "PENDING" || transaction.status === "CREATED"
            ? resolvePaymentUrl(transaction)
            : null,
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

  async cancelTransaction(
    userId: string,
    transactionId: string,
    reason?: string,
  ) {
    const transaction = await transactionService.findById(transactionId);
    if (!transaction || transaction.userId !== userId) {
      throw new Error("Transaksi tidak ditemukan");
    }

    if (transaction.status !== "PENDING" && transaction.status !== "CREATED") {
      throw new Error("Invoice tidak dapat dibatalkan pada status ini");
    }

    if (transaction.expiredAt && transaction.expiredAt < new Date()) {
      await transactionService.updateStatus(transaction.id, "EXPIRED");
      throw new Error("Invoice sudah kedaluwarsa");
    }

    await transactionService.markCancelled(transaction.id);
    await invoiceService.markCancelled(transaction.id);

    await paymentAuditService.log({
      transactionId: transaction.id,
      userId,
      action: "invoice_cancelled",
      reason,
      metadata: {
        invoiceNumber: transaction.invoiceNumber,
        amount: transaction.amount,
      },
    });

    logBillingAnalyticsEvent("payment_cancelled", {
      transactionId: transaction.id,
      userId,
      reason,
    });

    return this.getTransactionDetail(userId, transactionId);
  }

  async getInvoiceDocument(userId: string, transactionId: string) {
    const detail = await this.getTransactionDetail(userId, transactionId);
    if (!detail) {
      return null;
    }

    if (detail.status !== "PAID") {
      throw new Error("Invoice hanya tersedia untuk pembayaran yang sudah lunas");
    }

    const createdLabel = new Date(detail.createdAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const paidLabel = detail.paidAt
      ? new Date(detail.paidAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${detail.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 32px; }
    h1 { margin-bottom: 4px; }
    .muted { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    td { padding: 8px 0; vertical-align: top; }
    .total { font-size: 20px; font-weight: bold; }
    hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>Lingora Invoice</h1>
  <p class="muted">${detail.invoiceNumber}</p>
  <hr />
  <table>
    <tr><td>Plan</td><td><strong>${detail.product.label}</strong></td></tr>
    <tr><td>Duration</td><td>${detail.product.durationLabel}</td></tr>
    <tr><td>Subtotal</td><td>${formatIdr(detail.listPrice)}</td></tr>
    <tr><td>Discount</td><td>${detail.discountPercent > 0 ? `${detail.discountPercent}% (-${formatIdr(detail.discountAmount)})` : "-"}</td></tr>
    <tr><td>Tax</td><td>${formatIdr(detail.taxAmount)}</td></tr>
    <tr><td class="total">Total</td><td class="total">${formatIdr(detail.amount)}</td></tr>
    <tr><td>Status</td><td>Paid</td></tr>
    <tr><td>Payment Method</td><td>${detail.paymentMethod || "-"}</td></tr>
    <tr><td>Created</td><td>${createdLabel}</td></tr>
    <tr><td>Paid</td><td>${paidLabel}</td></tr>
  </table>
</body>
</html>`;
  }
}

export const billingService = new BillingService();
