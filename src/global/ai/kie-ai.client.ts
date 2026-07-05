import { isMockAiEnabled } from "../config/mock.config";
import { getKieChatCompletionsUrl } from "./kie-base-url";

type KieAiModel = "gpt-5-2" | "gemini-2.5-pro";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

type ChatCompletionRequest = {
  model?: KieAiModel;
  messages: ChatMessage[];
  stream?: boolean;
};

type ChatCompletionResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
};

export type ChatCompletionResult = {
  content: string;
  mock: boolean;
  model: KieAiModel;
};

const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY ?? "";
const DEFAULT_MODEL = (process.env.KIE_AI_DEFAULT_MODEL ??
  "gpt-5-2") as KieAiModel;

function getLastUserMessage(messages: ChatMessage[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser?.content ?? "";
}

function buildMockResponse(
  request: ChatCompletionRequest,
): ChatCompletionResult {
  const model = request.model ?? DEFAULT_MODEL;
  const lastMessage = getLastUserMessage(request.messages);

  const content = [
    `[MOCK AI — ${model}]`,
    "",
    lastMessage
      ? `Anda berkata: "${lastMessage}"`
      : "Silakan kirim pesan untuk melihat respons dummy.",
    "",
    "Artikulasimu sudah bagus! Untuk latihan berikutnya, coba ucapkan dengan lebih natural seperti ini: [practice|practise] atau perhatikan bentuk lampau [go|went].",
    "",
    "API key Kie AI belum dikonfigurasi — ini respons dummy untuk development.",
  ].join("\n");

  return { content, mock: true, model };
}

export class KieAiClient {
  isMockMode() {
    return isMockAiEnabled();
  }

  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResult> {
    const model = request.model ?? DEFAULT_MODEL;

    if (isMockAiEnabled()) {
      return buildMockResponse(request);
    }

    const response = await fetch(getKieChatCompletionsUrl(model), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KIE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: request.messages,
        stream: request.stream ?? false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kie AI error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;

    return {
      content: data.choices[0]?.message?.content ?? "",
      mock: false,
      model,
    };
  }
}

export const kieAiClient = new KieAiClient();
