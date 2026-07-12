import { billingService } from "@/features/billing/application/billing.service";
import type { PaymentWebhookPayload } from "@/features/billing/domain/types/billing.types";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

function parseFormBody(body: string): PaymentWebhookPayload {
  const params = new URLSearchParams(body);

  return {
    merchantCode: params.get("merchantCode") || "",
    amount: params.get("amount") || "0",
    merchantOrderId: params.get("merchantOrderId") || "",
    reference: params.get("reference") || undefined,
    resultCode: params.get("resultCode") || "",
    signature: params.get("signature") || "",
    paymentMethod: params.get("paymentMethod") || undefined,
  };
}

export async function duitkuWebhookHandler(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let payload: PaymentWebhookPayload;

    if (contentType.includes("application/json")) {
      payload = (await request.json()) as PaymentWebhookPayload;
    } else {
      const body = await request.text();
      payload = parseFormBody(body);
    }

    const result = await billingService.processWebhook("duitku", payload);

    if (!result.processed) {
      return withCors(errorResponse("Webhook diabaikan", 400));
    }

    return withCors(successResponse({ ok: true, reason: result.reason }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses webhook";
    return withCors(errorResponse(message, 500));
  }
}
