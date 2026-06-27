import dayjs from "dayjs";
import { prisma } from "@/global/database/prisma";
import { requireAuth } from "@/global/middleware/auth.guard";
import { errorResponse, successResponse } from "@/global/utils/response";
import { withCors } from "@/global/utils/cors";

export async function progressActivityHandler() {
  try {
    const auth = await requireAuth();
    const userId = auth.userId;

    // 1. Generate last 30 days list (date keys)
    const activity = [];
    const now = dayjs().startOf("day");
    for (let i = 29; i >= 0; i--) {
      const dStr = now.subtract(i, "day").format("YYYY-MM-DD");
      activity.push({ date: dStr, messages: 0 });
    }

    // 2. Fetch user messages from last 30 days
    const thirtyDaysAgo = dayjs().subtract(30, "days").startOf("day").toDate();
    const messages = await prisma.message.findMany({
      where: {
        role: "USER",
        conversation: { userId },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    });

    // 3. Count messages per date
    const counts: Record<string, number> = {};
    messages.forEach((m) => {
      const dStr = dayjs(m.createdAt).format("YYYY-MM-DD");
      counts[dStr] = (counts[dStr] || 0) + 1;
    });

    // 4. Map counts to activity list
    activity.forEach((item) => {
      item.messages = counts[item.date] || 0;
    });

    return withCors(successResponse(activity));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return withCors(errorResponse("Unauthorized", 401));
    }
    return withCors(errorResponse("Gagal memuat aktivitas progres", 500));
  }
}
