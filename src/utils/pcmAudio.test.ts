import test from 'node:test';
import assert from 'node:assert/strict';
import {
  downsampleFloat32,
  float32ToPcm16Base64,
  pcm16Base64ToFloat32,
} from './pcmAudio';

test('float32ToPcm16Base64 and pcm16Base64ToFloat32 round-trip accurately', () => {
  const input = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const encoded = float32ToPcm16Base64(input, 16000, 16000);
  const decoded = pcm16Base64ToFloat32(encoded);

  assert.equal(decoded.length, input.length);
  for (let i = 0; i < input.length; i++) {
    assert.ok(
      Math.abs(decoded[i] - input[i]) < 0.001,
      `sample ${i} mismatch: got ${decoded[i]}, expected ${input[i]}`
    );
  }
});

test('float32ToPcm16Base64 clamps out-of-range samples safely', () => {
  const encoded = float32ToPcm16Base64(new Float32Array([2.5, -3.2]), 16000, 16000);
  const decoded = pcm16Base64ToFloat32(encoded);
  assert.equal(decoded.length, 2);
  assert.ok(decoded[0] <= 1 && decoded[0] > 0.999);
  assert.ok(decoded[1] >= -1 && decoded[1] < -0.999);
});

test('downsampleFloat32 converts 48kHz buffers down to 16kHz', () => {
  const input = new Float32Array(480);
  for (let i = 0; i < input.length; i++) {
    input[i] = 0.25;
  }
  const output = downsampleFloat32(input, 48000, 16000);
  assert.equal(output.length, 160);
  assert.ok(Math.abs(output[0] - 0.25) < 1e-6);
  assert.ok(Math.abs(output[159] - 0.25) < 1e-6);
});
