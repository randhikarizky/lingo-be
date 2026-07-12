import { prisma } from "@/global/database/prisma";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export class InvoiceService {
  async generateInvoiceNumber() {
    const now = new Date();
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const prefix = `INV-${datePart}`;

    const latest = await prisma.paymentInvoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { createdAt: "desc" },
      select: { invoiceNumber: true },
    });

    const sequence = latest
      ? Number(latest.invoiceNumber.split("-").pop() || "0") + 1
      : 1;

    return `${prefix}-${String(sequence).padStart(4, "0")}`;
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
}

export const invoiceService = new InvoiceService();
