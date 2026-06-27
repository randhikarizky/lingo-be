export type TranscribeInput = {
  audio: Buffer;
  mimeType: string;
  fileName: string;
  language?: string;
  requestId?: string;
};

export type TranscribeResult = {
  text: string;
  mock: boolean;
};

export type SynthesizeInput = {
  text: string;
  language?: string;
  voice?: string;
  requestId?: string;
};

export type SynthesizeResult = {
  audio: Buffer;
  mimeType: string;
  mock: boolean;
};

export interface VoiceProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}
