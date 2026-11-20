/**
 * Pure PCM 16-bit little-endian audio helpers for Gemini Live API.
 * Input audio: 16 kHz mono signed 16-bit PCM.
 * Output audio: 24 kHz mono signed 16-bit PCM.
 */

export function downsampleFloat32(
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000
): Float32Array {
  if (inputSampleRate <= 0 || targetSampleRate <= 0 || input.length === 0) {
    return new Float32Array(0);
  }
  if (inputSampleRate === targetSampleRate) {
    return input;
  }
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    if (end <= start) {
      result[i] = input[Math.min(start, input.length - 1)];
    } else {
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += input[j];
      }
      result[i] = sum / (end - start);
    }
  }
  return result;
}

export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return int16;
}

export function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function float32ToPcm16Base64(
  float32: Float32Array,
  inputSampleRate = 16000,
  targetSampleRate = 16000
): string {
  const resampled = downsampleFloat32(float32, inputSampleRate, targetSampleRate);
  const int16 = float32ToInt16(resampled);
  return int16ToBase64(int16);
}

export function pcm16Base64ToFloat32(base64: string): Float32Array {
  if (!base64) return new Float32Array(0);
  let bytes: Uint8Array;
  if (typeof Buffer !== 'undefined' && typeof atob === 'undefined') {
    bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  } else {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return out;
}
