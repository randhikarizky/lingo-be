import type { TransactionStatus } from "@prisma/client";

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

  async markPending(transactionId: string, providerReference?: string) {
    return prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status: "PENDING",
        providerReference,
      },
    });
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

  async findById(transactionId: string) {
    return prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { invoice: true },
    });
  }

  async findByInvoiceNumber(invoiceNumber: string) {
    return prisma.paymentTransaction.findUnique({
      where: { invoiceNumber },
      include: { invoice: true },
    });
  }

  async listByUser(userId: string) {
    return prisma.paymentTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { invoice: true },
    });
  }
}

export const transactionService = new TransactionService();
