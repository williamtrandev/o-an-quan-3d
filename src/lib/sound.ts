/**
 * Web Audio synthesiser for the game's sounds (pebbles on wood), so no audio assets ship.
 */
export type SoundName = 'drop' | 'pickup' | 'capture' | 'quan' | 'start' | 'end' | 'select';

let context: AudioContext | null = null;
let enabled = true;

export const setSoundEnabled = (on: boolean): void => {
  enabled = on;
};

const audio = (): AudioContext | null => {
  if (!enabled || typeof window === 'undefined' || !('AudioContext' in window)) return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
};

/** A short knock of filtered noise: a pebble landing on wood or on other pebbles. */
const knock = (ctx: AudioContext, at: number, gain: number, freq: number, length = 0.06) => {
  const n = Math.floor(ctx.sampleRate * length);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 4;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  src.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 2.5;
  amp.gain.value = gain;
  src.connect(filter).connect(amp).connect(ctx.destination);
  src.start(ctx.currentTime + at);
};

const tone = (
  ctx: AudioContext,
  freq: number,
  at: number,
  dur: number,
  gain = 0.12,
  type: OscillatorType = 'sine',
) => {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
  amp.gain.setValueAtTime(0, ctx.currentTime + at);
  amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + at + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + at);
  osc.stop(ctx.currentTime + at + dur + 0.05);
};

export const playSound = (name: SoundName): void => {
  const ctx = audio();
  if (!ctx) return;
  const pitch = 0.85 + Math.random() * 0.3;
  switch (name) {
    case 'drop':
      knock(ctx, 0, 0.9, 1900 * pitch);
      knock(ctx, 0.025, 0.35, 2600 * pitch, 0.04);
      break;
    case 'pickup':
      for (let i = 0; i < 4; i++) knock(ctx, i * 0.018, 0.35, (1500 + i * 300) * pitch, 0.04);
      break;
    case 'select':
      knock(ctx, 0, 0.5, 1200 * pitch, 0.05);
      break;
    case 'capture':
      for (let i = 0; i < 6; i++)
        knock(ctx, i * 0.03, 0.5, (1700 + Math.random() * 900) * pitch, 0.05);
      tone(ctx, 880, 0.02, 0.25, 0.06, 'triangle');
      break;
    case 'quan':
      tone(ctx, 196, 0, 1.4, 0.18, 'sine');
      tone(ctx, 392, 0, 0.9, 0.06, 'triangle');
      knock(ctx, 0, 1, 700, 0.12);
      break;
    case 'start':
      tone(ctx, 523, 0, 0.14, 0.1, 'triangle');
      tone(ctx, 659, 0.1, 0.14, 0.1, 'triangle');
      tone(ctx, 784, 0.2, 0.25, 0.1, 'triangle');
      break;
    case 'end':
      tone(ctx, 784, 0, 0.2, 0.1, 'triangle');
      tone(ctx, 988, 0.15, 0.2, 0.1, 'triangle');
      tone(ctx, 1175, 0.3, 0.5, 0.1, 'triangle');
      break;
  }
};
