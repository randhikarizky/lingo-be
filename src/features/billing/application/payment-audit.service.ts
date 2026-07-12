import type { Prisma } from "@prisma/client";

import { prisma } from "@/global/database/prisma";

export class PaymentAuditService {
  async log(input: {
    transactionId: string;
    userId: string;
    action: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.paymentAuditLog.create({
      data: {
        transactionId: input.transactionId,
        userId: input.userId,
        action: input.action,
        reason: input.reason,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

export const paymentAuditService = new PaymentAuditService();
