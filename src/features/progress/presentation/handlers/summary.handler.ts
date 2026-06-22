import dayjs from "dayjs";
import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function progressSummaryHandler() {
  try {
    const auth = await requireAuth();
    const userId = auth.userId;

    // 1. Get conversations count and dates
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const conversationCount = conversations.length;

    // 2. Get user messages count and speaking minutes
    const userMessages = await prisma.message.findMany({
      where: {
        role: "USER",
        conversation: { userId },
      },
      select: {
        content: true,
      },
    });
    const messageCount = userMessages.length;
    const totalCharacters = userMessages.reduce((sum, msg) => sum + msg.content.length, 0);
    const speakingMinutes = Math.ceil(totalCharacters / 12 / 60);

    // 3. Calculate streak (consecutive days of practice)
    const dates = Array.from(
      new Set(
        conversations.map((c) => dayjs(c.createdAt).format("YYYY-MM-DD"))
      )
    ).sort((a, b) => b.localeCompare(a)); // desc

    let currentStreak = 0;
    const lastPracticeDate = conversations[0]
      ? dayjs(conversations[0].createdAt).format("YYYY-MM-DD")
      : null;

    if (dates.length > 0) {
      const todayStr = dayjs().format("YYYY-MM-DD");
      const yesterdayStr = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      const dateSet = new Set(dates);

      if (dateSet.has(todayStr)) {
        currentStreak = 1;
        let checkDate = dayjs().subtract(1, "day");
        while (dateSet.has(checkDate.format("YYYY-MM-DD"))) {
          currentStreak++;
          checkDate = checkDate.subtract(1, "day");
        }
      } else if (dateSet.has(yesterdayStr)) {
        currentStreak = 1;
        let checkDate = dayjs().subtract(2, "days");
        while (dateSet.has(checkDate.format("YYYY-MM-DD"))) {
          currentStreak++;
          checkDate = checkDate.subtract(1, "day");
        }
      }
    }

    return withCors(
      successResponse({
        conversationCount,
        messageCount,
        speakingMinutes,
        currentStreak,
        lastPracticeDate,
      })
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }
    return withCors(errorResponse("Gagal memuat ringkasan progres", 500));
  }
}
