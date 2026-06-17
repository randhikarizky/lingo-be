import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function deleteConversationHandler(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return withCors(errorResponse("Percakapan tidak ditemukan", 404));
    }

    if (conversation.userId !== auth.userId) {
      return withCors(errorResponse("Forbidden", 403));
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return withCors(successResponse({ success: true }, "Percakapan berhasil dihapus"));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }
    return withCors(errorResponse("Gagal menghapus percakapan", 500));
  }
}
