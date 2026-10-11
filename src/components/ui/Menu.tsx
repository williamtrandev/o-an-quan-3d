'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import { AI_LEVELS, AI_LEVEL_LABEL, type AiLevel } from '@/lib/game/ai';
import { TIMES, TIME_EMOJI, TIME_LABEL, useSettings } from '@/lib/settings';
import { playSound } from '@/lib/sound';
import { useGame } from '@/lib/store';

/** Title screen over the slowly orbiting courtyard. */
export function Menu({ onRules }: { onRules: () => void }) {
  const start = useGame((s) => s.start);
  const [level, setLevel] = useState<AiLevel>(2);
  const [first, setFirst] = useState<'human' | 'ai'>('human');
  const time = useSettings((s) => s.time);
  const setTime = useSettings((s) => s.setTime);

  const begin = (kind: 'ai' | 'local') => {
    playSound('start');
    start(
      kind === 'ai'
        ? { kind: 'ai', level, human: first === 'human' ? 'south' : 'north' }
        : { kind: 'local' },
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="pointer-events-none fixed inset-0 z-20 flex items-end justify-center p-4 sm:items-center sm:justify-start sm:p-10"
    >
      <div className="panel pointer-events-auto w-full max-w-sm p-6 sm:p-7">
        <p className="label">Trò chơi dân gian Việt Nam</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight text-[#f6ead2] sm:text-5xl">
          Ô Ăn <span className="text-[#e9b949]">Quan</span>
        </h1>
        <p className="mt-2 text-sm text-[#f6ead2]/70">
          Rải sỏi trên bàn gỗ giữa sân đình, ăn dân, ăn quan, giành phần thắng.
        </p>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="label mb-2">Độ khó của máy</p>
            <div className="grid grid-cols-4 gap-1.5">
              {AI_LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  onClick={() => setLevel(l)}
                  className={`rounded-xl px-1 py-2 text-xs font-semibold transition ${
                    level === l
                      ? 'bg-[#e9b949] text-[#2a1606]'
                      : 'bg-white/5 text-[#f6ead2]/75 hover:bg-white/15'
                  }`}
                >
                  {AI_LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(
                [
                  ['human', 'Bạn đi trước'],
                  ['ai', 'Máy đi trước'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={first === value}
                  onClick={() => setFirst(value)}
                  className={`rounded-xl px-2 py-1.5 text-xs font-medium transition ${
                    first === value
                      ? 'bg-white text-slate-900'
                      : 'bg-white/5 text-[#f6ead2]/70 hover:bg-white/15'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="btn-red mt-3 w-full" onClick={() => begin('ai')}>
              🤖 Đấu với máy
            </button>
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => begin('local')}>
            👥 Hai người một máy
          </button>
          <button type="button" className="btn w-full" onClick={onRules}>
            📜 Luật chơi
          </button>
        </div>

        <div className="mt-5">
          <p className="label mb-2">Khung cảnh</p>
          <div className="flex gap-1.5">
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={time === t}
                onClick={() => setTime(t)}
                className={`chip flex-1 ${time === t ? 'bg-[#f6ead2] text-[#2a1606] ring-transparent' : 'bg-white/5 text-[#f6ead2]/70 ring-white/10 hover:bg-white/15'}`}
              >
                {TIME_EMOJI[t]} {TIME_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
