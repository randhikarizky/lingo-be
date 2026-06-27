import { getMockTranscript } from "@/features/speech/domain/constants/mock-transcripts";
import type {
  SynthesizeInput,
  SynthesizeResult,
  TranscribeInput,
  TranscribeResult,
  VoiceProvider,
} from "@/features/speech/domain/ports/voice-provider.interface";

function buildMockAudioBuffer(text: string) {
  // Minimal valid MPEG frame header placeholder for dev/mock playback attempts.
  const header = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
  const body = Buffer.from(text, "utf-8");
  return Buffer.concat([header, body]);
}

export class MockVoiceProvider implements VoiceProvider {
  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (input.audio.length === 0) {
      throw new Error("Audio kosong");
    }

    return {
      text: getMockTranscript(input.language),
      mock: true,
    };
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    return {
      audio: buildMockAudioBuffer(input.text),
      mimeType: "audio/mpeg",
      mock: true,
    };
  }
}
