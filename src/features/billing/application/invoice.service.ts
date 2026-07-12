import { prisma } from "@/global/database/prisma";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export class InvoiceService {
  async generateInvoiceNumber() {
    const now = new Date();
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const prefix = `INV-${datePart}`;

    const [latestInvoice, latestTransaction] = await Promise.all([
      prisma.paymentInvoice.findFirst({
        where: { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: "desc" },
        select: { invoiceNumber: true },
      }),
      prisma.paymentTransaction.findFirst({
        where: { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: "desc" },
        select: { invoiceNumber: true },
      }),
    ]);

    const candidates = [
      latestInvoice?.invoiceNumber,
      latestTransaction?.invoiceNumber,
    ].filter((value): value is string => Boolean(value));

    const maxSequence = candidates.reduce((max, invoiceNumber) => {
      const sequence = Number(invoiceNumber.split("-").pop() || "0");
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }, 0);

    return `${prefix}-${String(maxSequence + 1).padStart(4, "0")}`;
  }

  async createDraftInvoice(input: {
    transactionId: string;
    invoiceNumber: string;
    amount: number;
    currency?: string;
  }) {
    return prisma.paymentInvoice.create({
      data: {
        transactionId: input.transactionId,
        invoiceNumber: input.invoiceNumber,
        amount: input.amount,
        currency: input.currency ?? "IDR",
        status: "ISSUED",
      },
    });
  }

  async markPaid(transactionId: string) {
    return prisma.paymentInvoice.updateMany({
      where: { transactionId },
      data: { status: "PAID" },
    });
  }

  async markCancelled(transactionId: string) {
    return prisma.paymentInvoice.updateMany({
      where: { transactionId },
      data: { status: "CANCELLED" },
    });
  }
}

export const invoiceService = new InvoiceService();
