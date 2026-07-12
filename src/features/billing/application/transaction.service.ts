import { Prisma, type TransactionStatus } from "@prisma/client";

import { prisma } from "@/global/database/prisma";

export class TransactionService {
  async createTransaction(input: {
    id: string;
    invoiceNumber: string;
    userId: string;
    planId: import("@prisma/client").PlanType;
    billingProductId: string;
    durationMonths: number;
    provider: string;
    amount: number;
    expiredAt: Date;
  }) {
    return prisma.paymentTransaction.create({
      data: {
        id: input.id,
        invoiceNumber: input.invoiceNumber,
        userId: input.userId,
        planId: input.planId,
        billingProductId: input.billingProductId,
        durationMonths: input.durationMonths,
        provider: input.provider,
        amount: input.amount,
        status: "CREATED",
        expiredAt: input.expiredAt,
      },
    });
  }

  async markPending(
    transactionId: string,
    providerReference?: string,
    extras?: {
      paymentUrl?: string;
      paymentMethod?: string;
    },
  ) {
    const updated = await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status: "PENDING",
        providerReference,
        paymentMethod: extras?.paymentMethod,
      },
    });

    if (extras?.paymentUrl) {
      await this.setPaymentUrl(transactionId, extras.paymentUrl);
    }

    return {
      ...updated,
      paymentUrl: extras?.paymentUrl ?? (await this.getPaymentUrl(transactionId)),
    };
  }

  async setPaymentUrl(transactionId: string, paymentUrl: string) {
    await prisma.$executeRaw`
      UPDATE "payment_transactions"
      SET "paymentUrl" = ${paymentUrl}, "updatedAt" = NOW()
      WHERE "id" = ${transactionId}
    `;
  }

  async getPaymentUrl(transactionId: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<{ paymentUrl: string | null }[]>`
      SELECT "paymentUrl"
      FROM "payment_transactions"
      WHERE "id" = ${transactionId}
      LIMIT 1
    `;

    return rows[0]?.paymentUrl ?? null;
  }

  private async attachPaymentUrls<T extends { id: string }>(
    transactions: T[],
  ): Promise<Array<T & { paymentUrl: string | null }>> {
    if (transactions.length === 0) {
      return [];
    }

    const ids = transactions.map((transaction) => transaction.id);
    const rows = await prisma.$queryRaw<{ id: string; paymentUrl: string | null }[]>`
      SELECT "id", "paymentUrl"
      FROM "payment_transactions"
      WHERE "id" IN (${Prisma.join(ids)})
    `;
    const urlMap = new Map(rows.map((row) => [row.id, row.paymentUrl]));

    return transactions.map((transaction) => ({
      ...transaction,
      paymentUrl: urlMap.get(transaction.id) ?? null,
    }));
  }

  async updateStatus(
    transactionId: string,
    status: TransactionStatus,
    input?: {
      providerReference?: string;
      paymentMethod?: string;
      paidAt?: Date;
    },
  ) {
    return prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status,
        providerReference: input?.providerReference,
        paymentMethod: input?.paymentMethod,
        paidAt: input?.paidAt,
      },
    });
  }

  async markCancelled(transactionId: string) {
    try {
      return await this.updateStatus(transactionId, "CANCELLED");
    } catch {
      await prisma.$executeRaw`
        UPDATE "payment_transactions"
        SET "status" = CAST('CANCELLED' AS "TransactionStatus"), "updatedAt" = NOW()
        WHERE "id" = ${transactionId}
      `;
      return this.findById(transactionId);
    }
  }

  async findById(transactionId: string) {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { invoice: true },
    });

    if (!transaction) {
      return null;
    }

    const paymentUrl = await this.getPaymentUrl(transactionId);
    return { ...transaction, paymentUrl };
  }

  async findByInvoiceNumber(invoiceNumber: string) {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { invoiceNumber },
      include: { invoice: true },
    });

    if (!transaction) {
      return null;
    }

    const paymentUrl = await this.getPaymentUrl(transaction.id);
    return { ...transaction, paymentUrl };
  }

  async listByUser(userId: string) {
    const transactions = await prisma.paymentTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { invoice: true },
    });

    return this.attachPaymentUrls(transactions);
  }
}

export const transactionService = new TransactionService();
