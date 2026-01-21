/**
 * Speech Synthesis Fingerprinting Module
 * Collects available speech synthesis voices
 */

import type { ModuleResult, SpeechData } from '../types';
import { sha256 } from '../core/crypto';

// Get speech synthesis voices
function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve([]);
      return;
    }

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Voices may load asynchronously
    const timeout = setTimeout(() => resolve([]), 1000);

    speechSynthesis.onvoiceschanged = () => {
      clearTimeout(timeout);
      resolve(speechSynthesis.getVoices());
    };
  });
}

// Parse voice data
function parseVoices(voices: SpeechSynthesisVoice[]): SpeechData {
  if (voices.length === 0) {
    return {};
  }

  const voiceData = voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
  }));

  // Count local and remote voices
  const local = voices.filter((v) => v.localService).length;
  const remote = voices.filter((v) => !v.localService).length;

  // Get unique languages
  const languages = [...new Set(voices.map((v) => v.lang))].sort();

  // Get default voice
  const defaultVoice = voices.find((v) => v.default);

  return {
    voices: voiceData,
    local,
    remote,
    languages,
    defaultVoiceName: defaultVoice?.name,
    defaultVoiceLang: defaultVoice?.lang,
  };
}

export async function collectSpeech(): Promise<ModuleResult<SpeechData>> {
  if (!window.speechSynthesis) {
    return {
      hash: '',
      data: {},
      error: 'Speech synthesis not supported',
    };
  }

  const voices = await getVoices();
  const data = parseVoices(voices);

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
