export type UsageTotals = {
  speakingMinutes: number;
  aiRequests: number;
  sttRequests: number;
  ttsRequests: number;
};

export type CostRates = {
  perChat: number;
  perStt: number;
  perTts: number;
  perSpeakingMinute: number;
};

export type CostBreakdown = {
  chatUsd: number;
  sttUsd: number;
  ttsUsd: number;
  speakingUsd: number;
  totalUsd: number;
};

function parseRate(envKey: string, fallback: number) {
  const raw = process.env[envKey]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getCostRates(): CostRates {
  return {
    perChat: parseRate("COST_USD_PER_CHAT", 0.002),
    perStt: parseRate("COST_USD_PER_STT", 0.004),
    perTts: parseRate("COST_USD_PER_TTS", 0.003),
    perSpeakingMinute: parseRate("COST_USD_PER_SPEAKING_MINUTE", 0.001),
  };
}

export function emptyUsageTotals(): UsageTotals {
  return {
    speakingMinutes: 0,
    aiRequests: 0,
    sttRequests: 0,
    ttsRequests: 0,
  };
}

export function accumulateUsageType(
  totals: UsageTotals,
  type: string,
  amount: number
): UsageTotals {
  const next = { ...totals };

  switch (type) {
    case "SPEAKING":
      next.speakingMinutes += amount;
      break;
    case "CHAT":
      next.aiRequests += amount;
      break;
    case "STT":
      next.sttRequests += amount;
      break;
    case "TTS":
      next.ttsRequests += amount;
      break;
    default:
      break;
  }

  return next;
}

export function estimateCostFromUsage(
  usage: UsageTotals,
  rates: CostRates = getCostRates()
): CostBreakdown {
  const chatUsd = usage.aiRequests * rates.perChat;
  const sttUsd = usage.sttRequests * rates.perStt;
  const ttsUsd = usage.ttsRequests * rates.perTts;
  const speakingUsd = usage.speakingMinutes * rates.perSpeakingMinute;

  return {
    chatUsd: roundUsd(chatUsd),
    sttUsd: roundUsd(sttUsd),
    ttsUsd: roundUsd(ttsUsd),
    speakingUsd: roundUsd(speakingUsd),
    totalUsd: roundUsd(chatUsd + sttUsd + ttsUsd + speakingUsd),
  };
}

export function roundUsd(value: number) {
  return Number(value.toFixed(4));
}

export function getCostRatesPublic() {
  const rates = getCostRates();

  return {
    currency: "USD",
    unit: "per_request_or_minute",
    rates: {
      chat: rates.perChat,
      stt: rates.perStt,
      tts: rates.perTts,
      speakingMinute: rates.perSpeakingMinute,
    },
    envOverrides: [
      "COST_USD_PER_CHAT",
      "COST_USD_PER_STT",
      "COST_USD_PER_TTS",
      "COST_USD_PER_SPEAKING_MINUTE",
    ],
  };
}
