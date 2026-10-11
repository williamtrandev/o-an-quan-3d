import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const TIMES = ['day', 'sunset', 'night'] as const;
export type TimeOfDay = (typeof TIMES)[number];
export const TIME_LABEL: Record<TimeOfDay, string> = {
  day: 'Ban ngày',
  sunset: 'Chiều tà',
  night: 'Đêm trăng',
};
export const TIME_EMOJI: Record<TimeOfDay, string> = { day: '☀️', sunset: '🌇', night: '🌙' };

interface Settings {
  /** Sowing animation speed multiplier. */
  speed: 1 | 2;
  sound: boolean;
  /** Number badges over every pit. */
  showCounts: boolean;
  time: TimeOfDay;
  setSpeed: (speed: 1 | 2) => void;
  toggleSound: () => void;
  toggleCounts: () => void;
  setTime: (time: TimeOfDay) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      speed: 1,
      sound: true,
      showCounts: true,
      time: 'sunset',
      setSpeed: (speed) => set({ speed }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      toggleCounts: () => set((s) => ({ showCounts: !s.showCounts })),
      setTime: (time) => set({ time }),
    }),
    {
      name: 'oanquan-settings',
      storage: createJSONStorage(() => localStorage),
      // Rehydrated on the client after mount, so server and client render the same HTML.
      skipHydration: true,
    },
  ),
);
