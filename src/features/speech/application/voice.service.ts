import { isMockVoiceEnabled } from "@/global/config/mock.config";
import { KieVoiceProvider } from "@/features/speech/data/providers/kie-voice.provider";
import { MockVoiceProvider } from "@/features/speech/data/providers/mock-voice.provider";
import type {
  SynthesizeInput,
  TranscribeInput,
  VoiceProvider,
} from "@/features/speech/domain/ports/voice-provider.interface";

let voiceProvider: VoiceProvider | null = null;

function getVoiceProvider(): VoiceProvider {
  if (!voiceProvider) {
    voiceProvider = isMockVoiceEnabled()
      ? new MockVoiceProvider()
      : new KieVoiceProvider();
  }

  return voiceProvider;
}

export class VoiceService {
  transcribe(input: TranscribeInput) {
    return getVoiceProvider().transcribe(input);
  }

  synthesize(input: SynthesizeInput) {
    return getVoiceProvider().synthesize(input);
  }

  isMockMode() {
    return isMockVoiceEnabled();
  }
}

export const voiceService = new VoiceService();
