import { z } from "zod";

import { billingService } from "@/features/billing/application/billing.service";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function billingCatalogHandler() {
  return withCors(successResponse({ products: billingService.getCatalog() }));
}

export async function billingPaymentMethodsHandler(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (
      !productId ||
      !["pro-1m", "pro-3m", "pro-6m", "pro-12m", "pro-24m"].includes(productId)
    ) {
      return withCors(errorResponse("productId tidak valid", 422));
    }

    const methods = await billingService.getPaymentMethods(
      productId as "pro-1m" | "pro-3m" | "pro-6m" | "pro-12m" | "pro-24m",
    );

    return withCors(successResponse({ methods }));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal memuat metode pembayaran";
    return withCors(errorResponse(message, 500));
  }
}

const createPaymentSchema = z.object({
  productId: z.enum(["pro-1m", "pro-3m", "pro-6m", "pro-12m", "pro-24m"]),
  paymentMethod: z.string().optional(),
});

export async function createPaymentHandler(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const { prisma } = await import("@/global/database/prisma");
    const dbUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, name: true },
    });

    if (!dbUser) {
      return withCors(errorResponse("Pengguna tidak ditemukan", 404));
    }

    const payment = await billingService.createPayment({
      userId: auth.userId,
      userEmail: dbUser.email,
      userName: dbUser.name,
      productId: parsed.data.productId,
      paymentMethod: parsed.data.paymentMethod,
    });

    return withCors(successResponse(payment));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    const message =
      error instanceof Error ? error.message : "Gagal membuat pembayaran";
    return withCors(errorResponse(message, 500));
  }
}

export async function billingHistoryHandler() {
  try {
    const auth = await requireAuth();
    const history = await billingService.listHistory(auth.userId);
    return withCors(successResponse({ items: history }));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal memuat riwayat billing", 500));
  }
}

export async function billingDetailHandler(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const detail = await billingService.getTransactionDetail(auth.userId, id);

    if (!detail) {
      return withCors(errorResponse("Transaksi tidak ditemukan", 404));
    }

    return withCors(successResponse(detail));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal memuat detail transaksi", 500));
  }
}

const mockCompleteSchema = z.object({
  transactionId: z.string().min(1),
});

export async function mockCompletePaymentHandler(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return withCors(errorResponse("Not found", 404));
    }

    const auth = await requireAuth();
    const body = await request.json();
    const parsed = mockCompleteSchema.safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    await billingService.completeMockPayment(
      parsed.data.transactionId,
      auth.userId,
    );

    const detail = await billingService.getTransactionDetail(
      auth.userId,
      parsed.data.transactionId,
    );

    return withCors(successResponse(detail));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    const message =
      error instanceof Error ? error.message : "Gagal menyelesaikan pembayaran";
    return withCors(errorResponse(message, 422));
  }
}

export async function billingCancelHandler(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = z
      .object({
        reason: z.string().max(200).optional(),
      })
      .safeParse(body);

    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }

    const detail = await billingService.cancelTransaction(
      auth.userId,
      id,
      parsed.data.reason,
    );

    return withCors(successResponse(detail));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    const message =
      error instanceof Error ? error.message : "Gagal membatalkan invoice";
    const status = message.includes("tidak ditemukan") ? 404 : 422;
    return withCors(errorResponse(message, status));
  }
}

export async function billingInvoiceDocumentHandler(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;
    const html = await billingService.getInvoiceDocument(auth.userId, id);

    if (!html) {
      return withCors(errorResponse("Transaksi tidak ditemukan", 404), request);
    }

    return withCors(
      new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="invoice-${id}.html"`,
        },
      }),
      request,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401), request);
    }

    const message =
      error instanceof Error ? error.message : "Gagal mengunduh invoice";
    return withCors(errorResponse(message, 422), request);
  }
}

export async function billingReturnHandler(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const transactionId =
      url.searchParams.get("transactionId") ||
      url.searchParams.get("merchantOrderId");
    const resultCode = url.searchParams.get("resultCode");

    if (!transactionId) {
      return withCors(errorResponse("transactionId wajib diisi", 422));
    }

    const detail = await billingService.syncReturnStatus({
      userId: auth.userId,
      transactionId,
      resultCode,
    });

    if (!detail) {
      return withCors(errorResponse("Transaksi tidak ditemukan", 404));
    }

    return withCors(successResponse(detail));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }

    return withCors(errorResponse("Gagal sinkron status pembayaran", 500));
  }
}
