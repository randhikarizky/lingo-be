import type {
  SynthesizeInput,
  SynthesizeResult,
  TranscribeInput,
  TranscribeResult,
  VoiceProvider,
} from "@/features/speech/domain/ports/voice-provider.interface";
import { uploadAudioToKie } from "@/features/speech/infrastructure/kie-file-upload.client";
import {
  createKieTask,
  downloadRemoteAudio,
  parseKieAudioUrl,
  parseKieTextResult,
  pollKieTaskResult,
} from "@/features/speech/infrastructure/kie-jobs.client";
import { logInfo } from "@/global/utils/logger";

const KIE_STT_MODEL =
  process.env.KIE_STT_MODEL ?? "elevenlabs/speech-to-text";
const KIE_TTS_MODEL =
  process.env.KIE_TTS_MODEL ?? "elevenlabs/text-to-speech-turbo-2-5";
const KIE_TTS_VOICE = process.env.KIE_TTS_VOICE ?? "Rachel";

export class KieVoiceProvider implements VoiceProvider {
  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const requestId = input.requestId;

    if (requestId) {
      logInfo(requestId, "voice.transcribe.start", {
        mimeType: input.mimeType,
        bytes: input.audio.length,
        language: input.language,
      });
    }

    const audioUrl = await uploadAudioToKie(
      {
        buffer: input.audio,
        fileName: input.fileName,
        mimeType: input.mimeType,
      },
      { requestId }
    );

    const taskId = await createKieTask(
      {
        model: KIE_STT_MODEL,
        input: {
          audio_url: audioUrl,
          language_code: input.language ?? "en",
          tag_audio_events: false,
          diarize: false,
        },
      },
      { requestId }
    );

    const resultJson = await pollKieTaskResult(taskId, { requestId });
    const text = parseKieTextResult(resultJson);

    if (requestId) {
      logInfo(requestId, "voice.transcribe.success", { textLength: text.length });
    }

    return {
      text,
      mock: false,
    };
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
    const requestId = input.requestId;

    if (requestId) {
      logInfo(requestId, "voice.synthesize.start", {
        textLength: input.text.length,
        language: input.language,
        voice: input.voice ?? KIE_TTS_VOICE,
      });
    }

    const taskId = await createKieTask(
      {
        model: KIE_TTS_MODEL,
        input: {
          text: input.text,
          voice: input.voice ?? KIE_TTS_VOICE,
          speed: 1,
          stability: 0.5,
          similarity_boost: 0.75,
          language_code: input.language ?? "",
        },
      },
      { requestId }
    );

    const resultJson = await pollKieTaskResult(taskId, { requestId });
    const audioUrl = parseKieAudioUrl(resultJson);
    const downloaded = await downloadRemoteAudio(audioUrl, { requestId });

    if (requestId) {
      logInfo(requestId, "voice.synthesize.success", {
        bytes: downloaded.buffer.length,
        mimeType: downloaded.mimeType,
      });
    }

    return {
      audio: downloaded.buffer,
      mimeType: downloaded.mimeType.includes("audio")
        ? downloaded.mimeType
        : "audio/mpeg",
      mock: false,
    };
  }
}
