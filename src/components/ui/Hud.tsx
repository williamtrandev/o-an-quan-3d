'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import { AI_LEVEL_LABEL } from '@/lib/game/ai';
import { score, winner, type Side } from '@/lib/game/rules';
import { TIMES, TIME_EMOJI, useSettings } from '@/lib/settings';
import { playSound } from '@/lib/sound';
import { sideName, useGame } from '@/lib/store';
import { pick } from '@/lib/util';
import { Dialog } from './Dialog';

/** One player's score card. */
function ScoreCard({ side, active }: { side: Side; active: boolean }) {
  const mode = useGame((s) => s.mode);
  const shown = useGame((s) => s.shown);
  const points = score(shown, side);
  const pile = shown.captured[side];
  const robot = mode.kind === 'ai' && side !== mode.human;
  return (
    <div
      className={`panel flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 transition duration-300 sm:px-4 sm:py-2.5 ${
        active ? 'ring-2 ring-[#e9b949] shadow-[0_0_24px_-4px_rgba(233,185,73,0.6)]' : 'opacity-80'
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-lg">
        {robot ? '🤖' : side === 'south' ? '🧑' : '🧒'}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-xs font-semibold text-[#f6ead2]/70">{sideName(mode, side)}</p>
        <p className="text-xs text-[#f6ead2]/50">
          {pile.quan > 0 && (
            <span className="mr-1 font-bold text-emerald-300">{pile.quan} quan</span>
          )}
          {pile.stones} dân
          {shown.debt[side] > 0 && (
            <span className="ml-1 text-rose-300">· nợ {shown.debt[side]}</span>
          )}
        </p>
      </div>
      <p className="text-2xl font-black tabular-nums text-[#f6ead2]">{points}</p>
    </div>
  );
}

function Status() {
  const mode = useGame((s) => s.mode);
  const shown = useGame((s) => s.shown);
  const animating = useGame((s) => s.queue.length > 0);
  const thinking = useGame((s) => s.thinking);
  const selected = useGame((s) => s.selected);
  const human = mode.kind === 'local' || shown.turn === mode.human;
  let text: string;
  if (shown.over) text = 'Hết quan, tàn dân: ván đã kết thúc';
  else if (animating) text = 'Đang rải sỏi…';
  else if (thinking) text = 'Máy đang nghĩ';
  else if (!human) text = 'Lượt của máy';
  else if (selected !== null) text = 'Chọn mũi tên để rải theo chiều đó';
  else
    text =
      mode.kind === 'local'
        ? `${sideName(mode, shown.turn)}: chạm một ô dân bên mình`
        : 'Lượt của bạn: chạm một ô dân sáng viền';
  return (
    <motion.p
      key={text}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel mx-auto w-fit max-w-full truncate px-4 py-1.5 text-center text-xs font-semibold text-[#f6ead2] sm:text-sm"
    >
      {text}
      {thinking && (
        <span className="ml-1 inline-flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="thinking-dot" style={{ animationDelay: `${i * 0.15}s` }}>
              •
            </span>
          ))}
        </span>
      )}
    </motion.p>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[10px] font-medium transition active:scale-95 disabled:opacity-35 ${
        active ? 'bg-[#e9b949] text-[#2a1606]' : 'bg-white/10 text-[#f6ead2]/85 hover:bg-white/20'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="max-w-16 truncate">{label}</span>
    </button>
  );
}

/** Scores, status and controls during a game. */
export function Hud({ onRules }: { onRules: () => void }) {
  const mode = useGame((s) => s.mode);
  const shown = useGame((s) => s.shown);
  const idle = useGame((s) => s.queue.length === 0 && !s.thinking);
  const historyLength = useGame((s) => s.history.length);
  const { undo, showHint, start, toMenu } = useGame.getState();
  const canInteract = useGame(
    (s) =>
      s.phase === 'playing' &&
      s.queue.length === 0 &&
      !s.state.over &&
      !s.thinking &&
      (s.mode.kind === 'local' || s.state.turn === s.mode.human),
  );
  const settings = useSettings();
  const [confirm, setConfirm] = useState(false);
  const top: Side = mode.kind === 'ai' ? (mode.human === 'south' ? 'north' : 'south') : 'north';
  const bottom: Side = top === 'north' ? 'south' : 'north';
  const nextTime = pick(TIMES, (TIMES.indexOf(settings.time) + 1) % TIMES.length);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-none fixed inset-x-0 top-0 z-20 space-y-2 p-3 sm:p-4"
      >
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-stretch gap-2">
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label="Về menu"
            className="panel grid w-11 shrink-0 place-items-center text-lg hover:bg-white/10"
          >
            ←
          </button>
          <ScoreCard side={top} active={!shown.over && shown.turn === top} />
          <ScoreCard side={bottom} active={!shown.over && shown.turn === bottom} />
        </div>
        <Status />
      </motion.header>

      <motion.nav
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        aria-label="Điều khiển"
        className="panel fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-xl items-center justify-between gap-1 p-1.5"
      >
        <ToolButton
          label="Đi lại"
          icon="↶"
          onClick={undo}
          disabled={!idle || historyLength === 0}
        />
        <ToolButton label="Gợi ý" icon="💡" onClick={showHint} disabled={!canInteract} />
        <ToolButton
          label={settings.speed === 2 ? 'Nhanh' : 'Thường'}
          icon="⏩"
          onClick={() => settings.setSpeed(settings.speed === 2 ? 1 : 2)}
          active={settings.speed === 2}
        />
        <ToolButton
          label="Số sỏi"
          icon="🔢"
          onClick={settings.toggleCounts}
          active={settings.showCounts}
        />
        <ToolButton
          label="Cảnh"
          icon={TIME_EMOJI[settings.time]}
          onClick={() => settings.setTime(nextTime)}
        />
        <ToolButton
          label={settings.sound ? 'Âm thanh' : 'Tắt tiếng'}
          icon={settings.sound ? '🔊' : '🔇'}
          onClick={settings.toggleSound}
        />
        <ToolButton label="Luật" icon="📜" onClick={onRules} />
      </motion.nav>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Rời ván này?">
        <p className="text-sm text-[#f6ead2]/75">Ván đang chơi sẽ không được lưu.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConfirm(false);
              start(mode);
              playSound('start');
            }}
          >
            Ván mới
          </button>
          <button
            type="button"
            className="btn-red"
            onClick={() => {
              setConfirm(false);
              toMenu();
            }}
          >
            Về menu
          </button>
        </div>
      </Dialog>
      <ResultDialog />
      {mode.kind === 'ai' && (
        <p className="pointer-events-none fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.2rem)] left-1/2 z-10 -translate-x-1/2 text-[11px] text-[#f6ead2]/50">
          Máy · {AI_LEVEL_LABEL[mode.level]}
        </p>
      )}
    </>
  );
}

function ResultDialog() {
  const mode = useGame((s) => s.mode);
  const shown = useGame((s) => s.shown);
  const animating = useGame((s) => s.queue.length > 0);
  const [dismissed, setDismissed] = useState<object | null>(null);
  const { start, toMenu } = useGame.getState();
  const result = winner(shown);
  const open = shown.over && !animating && dismissed !== shown;
  const title =
    result === 'draw'
      ? 'Hoà!'
      : mode.kind === 'ai'
        ? result === mode.human
          ? 'Bạn thắng! 🎉'
          : 'Máy thắng rồi'
        : `${sideName(mode, result ?? 'south')} thắng! 🎉`;
  return (
    <Dialog open={open} onClose={() => setDismissed(shown)} title={title}>
      <div className="grid grid-cols-2 gap-2 text-center">
        {(['south', 'north'] as const).map((side) => (
          <div
            key={side}
            className={`rounded-2xl p-3 ring-1 ${result === side ? 'bg-[#e9b949]/15 ring-[#e9b949]/50' : 'bg-white/5 ring-white/10'}`}
          >
            <p className="text-xs text-[#f6ead2]/60">{sideName(mode, side)}</p>
            <p className="text-3xl font-black text-[#f6ead2]">{score(shown, side)}</p>
            <p className="text-[11px] text-[#f6ead2]/50">
              {shown.captured[side].quan} quan · {shown.captured[side].stones} dân
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => toMenu()}>
          Về menu
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            playSound('start');
            start(mode);
          }}
        >
          Chơi lại
        </button>
      </div>
    </Dialog>
  );
}
