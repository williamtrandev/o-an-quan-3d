'use client';

import { AnimatePresence } from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { BoardOverlay } from '@/components/ui/BoardOverlay';
import { Hud } from '@/components/ui/Hud';
import { Menu } from '@/components/ui/Menu';
import { RulesDialog } from '@/components/ui/RulesDialog';
import { setSoundEnabled } from '@/lib/sound';
import { useSettings } from '@/lib/settings';
import { useGame } from '@/lib/store';

const GameCanvas = dynamic(() => import('@/components/scene/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-[#f6ead2]/60">Đang bày bàn…</div>
  ),
});

export default function Home() {
  const phase = useGame((s) => s.phase);
  const sound = useSettings((s) => s.sound);
  const [rules, setRules] = useState(false);

  useEffect(() => {
    void useSettings.persist.rehydrate();
  }, []);
  useEffect(() => setSoundEnabled(sound), [sound]);

  return (
    <main className="relative h-svh overflow-hidden bg-[#1a120c]">
      <div className="absolute inset-0">
        <GameCanvas />
      </div>
      <BoardOverlay />
      <AnimatePresence mode="wait">
        {phase === 'menu' ? (
          <Menu key="menu" onRules={() => setRules(true)} />
        ) : (
          <Hud key="hud" onRules={() => setRules(true)} />
        )}
      </AnimatePresence>
      <RulesDialog open={rules} onClose={() => setRules(false)} />
    </main>
  );
}
