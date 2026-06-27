import { z } from "zod";
import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

const createConversationSchema = z.object({
  characterId: z.string().min(1),
  personality: z.string().min(1),
  language: z.string().default("en"),
  title: z.string().optional(),
});

export async function createConversationHandler(request: Request) {
  try {
    const auth = await requireAuth();
    
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);
    
    if (!parsed.success) {
      return withCors(errorResponse(parsed.error.issues[0].message, 422));
    }
    
    const { characterId, personality, language, title } = parsed.data;
    
    const displayName = characterId.charAt(0).toUpperCase() + characterId.slice(1);
    const defaultTitle = `Latihan dengan ${displayName}`;
    
    const conversation = await prisma.conversation.create({
      data: {
        userId: auth.userId,
        characterId,
        personality,
        language,
        title: title || defaultTitle,
      },
    });
    
    return withCors(successResponse({ id: conversation.id }));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }
    return withCors(errorResponse("Gagal membuat percakapan", 500));
  }
}
