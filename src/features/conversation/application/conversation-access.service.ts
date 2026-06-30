import { prisma } from "@/global/database/prisma";

export class ConversationAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConversationAccessError";
    this.status = status;
  }
}

export async function assertActiveConversationAccess(
  userId: string,
  conversationId: string
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new ConversationAccessError("Percakapan tidak ditemukan", 404);
  }

  if (conversation.userId !== userId) {
    throw new ConversationAccessError("Forbidden", 403);
  }

  if (conversation.status !== "ACTIVE") {
    throw new ConversationAccessError("Sesi latihan sudah selesai", 409);
  }

  return conversation;
}

export function mapConversationAccessError(error: unknown) {
  if (!(error instanceof ConversationAccessError)) {
    return null;
  }

  return error;
}
