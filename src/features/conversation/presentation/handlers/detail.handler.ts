import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function detailConversationHandler(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await context.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return withCors(errorResponse("Percakapan tidak ditemukan", 404));
    }

    if (conversation.userId !== auth.userId) {
      return withCors(errorResponse("Forbidden", 403));
    }

    const responseData = {
      id: conversation.id,
      title: conversation.title,
      characterId: conversation.characterId,
      personality: conversation.personality,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role, // "USER" | "ASSISTANT"
        content: m.content,
        correction: m.correction,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    return withCors(successResponse(responseData));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }
    return withCors(errorResponse("Gagal memuat detail percakapan", 500));
  }
}
