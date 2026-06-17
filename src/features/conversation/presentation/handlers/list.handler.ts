import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function listConversationsHandler() {
  try {
    const auth = await requireAuth();

    const conversations = await prisma.conversation.findMany({
      where: { userId: auth.userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const mapped = conversations.map((c) => ({
      id: c.id,
      title: c.title ?? `Latihan dengan ${c.characterId}`,
      characterId: c.characterId,
      personality: c.personality,
      lastMessage: c.messages[0]?.content ?? null,
      updatedAt: c.updatedAt.toISOString(),
    }));

    return withCors(successResponse(mapped));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }
    return withCors(errorResponse("Gagal mengambil daftar percakapan", 500));
  }
}
