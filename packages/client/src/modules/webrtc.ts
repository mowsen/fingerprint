/**
 * WebRTC Fingerprinting Module
 * Collects WebRTC capabilities and codec information
 */

import type { ModuleResult, WebRTCData } from '../types';
import { sha256 } from '../core/crypto';

// Check WebRTC support
function isWebRTCSupported(): boolean {
  return !!(
    window.RTCPeerConnection ||
    // @ts-expect-error - webkit prefix
    window.webkitRTCPeerConnection ||
    // @ts-expect-error - moz prefix
    window.mozRTCPeerConnection
  );
}

// Get RTCPeerConnection constructor
function getRTCPeerConnection(): typeof RTCPeerConnection | null {
  return (
    window.RTCPeerConnection ||
    // @ts-expect-error - webkit prefix
    window.webkitRTCPeerConnection ||
    // @ts-expect-error - moz prefix
    window.mozRTCPeerConnection ||
    null
  );
}

// Get supported audio codecs
async function getAudioCodecs(): Promise<string[]> {
  try {
    if (!RTCRtpSender.getCapabilities) return [];
    const capabilities = RTCRtpSender.getCapabilities('audio');
    if (!capabilities) return [];
    return capabilities.codecs.map((codec) => `${codec.mimeType}/${codec.clockRate}`);
  } catch {
    return [];
  }
}

// Get supported video codecs
async function getVideoCodecs(): Promise<string[]> {
  try {
    if (!RTCRtpSender.getCapabilities) return [];
    const capabilities = RTCRtpSender.getCapabilities('video');
    if (!capabilities) return [];
    return capabilities.codecs.map((codec) => codec.mimeType);
  } catch {
    return [];
  }
}

// Get media device count
async function getMediaDeviceCount(): Promise<{ audio: number; video: number }> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { audio: 0, video: 0 };
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    let audio = 0;
    let video = 0;
    for (const device of devices) {
      if (device.kind === 'audioinput' || device.kind === 'audiooutput') {
        audio++;
      } else if (device.kind === 'videoinput') {
        video++;
      }
    }
    return { audio, video };
  } catch {
    return { audio: 0, video: 0 };
  }
}

// Get local IPs (may be blocked by browser)
async function getLocalIPs(): Promise<string[]> {
  const RTCPeerConnectionConstructor = getRTCPeerConnection();
  if (!RTCPeerConnectionConstructor) return [];

  const ips: string[] = [];

  try {
    const config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };

    const pc = new RTCPeerConnectionConstructor(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = event.candidate.candidate;
        const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (ipMatch && !ips.includes(ipMatch[1])) {
          ips.push(ipMatch[1]);
        }
      }
    };

    // Create data channel to trigger ICE gathering
    pc.createDataChannel('');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });

    pc.close();
  } catch {
    // WebRTC IP gathering failed
  }

  return ips;
}

export async function collectWebRTC(): Promise<ModuleResult<WebRTCData>> {
  if (!isWebRTCSupported()) {
    return {
      hash: '',
      data: { supported: false },
      error: 'WebRTC not supported',
    };
  }

  // Collect data in parallel
  const [audioCodecs, videoCodecs, deviceCounts, localIPs] = await Promise.all([
    getAudioCodecs(),
    getVideoCodecs(),
    getMediaDeviceCount(),
    getLocalIPs(),
  ]);

  const data: WebRTCData = {
    supported: true,
    audio: {
      codecs: audioCodecs,
      devices: deviceCounts.audio,
    },
    video: {
      codecs: videoCodecs,
      devices: deviceCounts.video,
    },
    localIPs: localIPs.length > 0 ? localIPs : undefined,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
