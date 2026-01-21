/**
 * Media MIME Type Fingerprinting Module
 * Collects supported media formats and codecs
 */

import type { ModuleResult, MediaData } from '../types';
import { sha256 } from '../core/crypto';

// Audio MIME types to test
const AUDIO_TYPES = [
  'audio/ogg; codecs="vorbis"',
  'audio/ogg; codecs="opus"',
  'audio/ogg; codecs="flac"',
  'audio/mpeg',
  'audio/mp4; codecs="mp4a.40.2"',
  'audio/mp4; codecs="ac-3"',
  'audio/mp4; codecs="ec-3"',
  'audio/webm; codecs="vorbis"',
  'audio/webm; codecs="opus"',
  'audio/wav; codecs="1"',
  'audio/flac',
  'audio/aac',
  'audio/x-m4a',
  'audio/x-wav',
];

// Video MIME types to test
const VIDEO_TYPES = [
  'video/ogg; codecs="theora"',
  'video/ogg; codecs="theora, vorbis"',
  'video/mp4; codecs="avc1.42E01E"',
  'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  'video/mp4; codecs="avc1.4D401E"',
  'video/mp4; codecs="avc1.64001E"',
  'video/mp4; codecs="hev1.1.6.L93.B0"',
  'video/mp4; codecs="hvc1.1.6.L93.B0"',
  'video/mp4; codecs="av01.0.00M.08"',
  'video/mp4; codecs="vp09.00.10.08"',
  'video/webm; codecs="vp8"',
  'video/webm; codecs="vp8, vorbis"',
  'video/webm; codecs="vp9"',
  'video/webm; codecs="vp9, opus"',
  'video/webm; codecs="av1"',
  'video/x-matroska; codecs="avc1.42E01E"',
  'video/3gpp; codecs="mp4v.20.8"',
  'video/quicktime',
];

// Check MIME type support
function checkMediaType(type: string, element: HTMLVideoElement | HTMLAudioElement): string {
  try {
    const canPlay = element.canPlayType(type);
    return canPlay || '';
  } catch {
    return '';
  }
}

// Get all supported MIME types
function getMimeTypes(): MediaData['mimeTypes'] {
  const video = document.createElement('video');
  const audio = document.createElement('audio');

  const results: Array<{ type: string; supported: string }> = [];

  // Check video types
  for (const type of VIDEO_TYPES) {
    const supported = checkMediaType(type, video);
    if (supported) {
      results.push({ type, supported });
    }
  }

  // Check audio types
  for (const type of AUDIO_TYPES) {
    const supported = checkMediaType(type, audio);
    if (supported) {
      results.push({ type, supported });
    }
  }

  return results;
}

// Check MediaSource support
function getMediaSourceTypes(): string[] {
  if (!window.MediaSource?.isTypeSupported) {
    return [];
  }

  const types = [
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4; codecs="avc1.4D401E"',
    'video/mp4; codecs="avc1.64001E"',
    'video/webm; codecs="vp8"',
    'video/webm; codecs="vp9"',
    'video/webm; codecs="av01.0.00M.08"',
    'audio/mp4; codecs="mp4a.40.2"',
    'audio/webm; codecs="opus"',
  ];

  return types.filter((type) => {
    try {
      return MediaSource.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

export async function collectMedia(): Promise<ModuleResult<MediaData>> {
  const data: MediaData = {
    mimeTypes: getMimeTypes(),
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
