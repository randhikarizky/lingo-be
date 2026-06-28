import type { UsageType, Prisma } from "@prisma/client";

import { prisma } from "@/global/database/prisma";

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export class UsageService {
  async recordUsage(params: {
    userId: string;
    type: UsageType;
    amount?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.usageLog.create({
      data: {
        userId: params.userId,
        type: params.type,
        amount: params.amount ?? 1,
        metadata: params.metadata,
      },
    });
  }

  async getDailyUsage(userId: string) {
    const since = getStartOfToday();

    const logs = await prisma.usageLog.groupBy({
      by: ["type"],
      where: {
        userId,
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });

    const usage = {
      speakingMinutes: 0,
      aiReplies: 0,
      sttRequests: 0,
      ttsRequests: 0,
    };

    for (const log of logs) {
      const amount = log._sum.amount ?? 0;

      switch (log.type) {
        case "SPEAKING":
          usage.speakingMinutes += amount;
          break;
        case "CHAT":
          usage.aiReplies += amount;
          break;
        case "STT":
          usage.sttRequests += amount;
          break;
        case "TTS":
          usage.ttsRequests += amount;
          break;
        default:
          break;
      }
    }

    return usage;
  }

  async getActiveConversationCount(userId: string) {
    return prisma.conversation.count({
      where: {
        userId,
        status: "ACTIVE",
      },
    });
  }
}

export const usageService = new UsageService();

export function estimateSpeakingMinutesFromText(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 130));
}

export function estimateSpeakingMinutesFromAudioBytes(bytes: number) {
  return Math.max(1, Math.round(bytes / (32 * 1024)));
}
