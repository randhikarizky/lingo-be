import type { Message } from "@prisma/client";

import { kieAiClient } from "@/global/ai/kie-ai.client";
import { getModelForPersonality } from "@/features/learning/domain/constants/tutors";
import type {
  SessionMetrics,
  SessionSummaryFeedback,
} from "@/features/learning/domain/types/learning-session.types";

type ConversationMessage = Pick<Message, "role" | "content">;

function buildTranscript(messages: ConversationMessage[]) {
  return messages
    .filter(
      (message) => message.role === "USER" || message.role === "ASSISTANT",
    )
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");
}

function parseSummaryJson(content: string): SessionSummaryFeedback | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<SessionSummaryFeedback>;

    if (
      typeof parsed.grammar === "string" &&
      typeof parsed.vocabulary === "string" &&
      typeof parsed.fluency === "string" &&
      typeof parsed.confidence === "string" &&
      typeof parsed.strength === "string" &&
      typeof parsed.improvementArea === "string"
    ) {
      return parsed as SessionSummaryFeedback;
    }
  } catch {
    return null;
  }

  return null;
}

function buildFallbackSummary(metrics: SessionMetrics): SessionSummaryFeedback {
  return {
    grammar: "Keep practicing sentence structure in short, clear phrases.",
    vocabulary: `You used about ${metrics.wordsSpoken} words and learned ${metrics.newVocabulary.length} corrected expressions.`,
    fluency:
      "Your speaking flow is developing — keep responding in full sentences.",
    confidence:
      "You stayed engaged throughout the session. Keep building momentum.",
    strength: "Great effort completing the practice scenario.",
    improvementArea:
      "Try using past tense and follow-up questions more consistently.",
  };
}

export class SessionSummaryService {
  async generate(params: {
    personality: string;
    scenarioLabel: string;
    objective: string;
    difficulty: string;
    messages: ConversationMessage[];
    metrics: SessionMetrics;
  }): Promise<SessionSummaryFeedback> {
    const transcript = buildTranscript(params.messages);

    if (!transcript.trim()) {
      return buildFallbackSummary(params.metrics);
    }

    const result = await kieAiClient.chatCompletion({
      model: getModelForPersonality(params.personality),
      messages: [
        {
          role: "system",
          content:
            "You are an English learning coach. Return ONLY valid JSON with keys: grammar, vocabulary, fluency, confidence, strength, improvementArea. Each value is one concise English sentence for the learner.",
        },
        {
          role: "user",
          content: [
            `Scenario: ${params.scenarioLabel}`,
            `Objective: ${params.objective}`,
            `Difficulty: ${params.difficulty}`,
            `Words spoken: ${params.metrics.wordsSpoken}`,
            `Corrections: ${params.metrics.corrections}`,
            `New vocabulary: ${params.metrics.newVocabulary.join(", ") || "none"}`,
            "",
            "Transcript:",
            transcript,
          ].join("\n"),
        },
      ],
    });

    return (
      parseSummaryJson(result.content) ?? buildFallbackSummary(params.metrics)
    );
  }
}

export const sessionSummaryService = new SessionSummaryService();
