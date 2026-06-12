export type AiModelProvider = "kie-ai";

export type AiModelName = "gpt-5-2" | "gemini-2.5-pro";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};
