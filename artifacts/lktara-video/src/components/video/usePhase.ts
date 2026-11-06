import { useMemo, useState } from 'react';
import { useSceneTimer } from '@/lib/video';

/** Returns how many of the given times (ms) have elapsed in the current scene. */
export function usePhase(times: number[]): number {
  const [phase, setPhase] = useState(0);
  const key = times.join(',');
  const events = useMemo(
    () => times.map((time, i) => ({ time, callback: () => setPhase((p) => Math.max(p, i + 1)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useSceneTimer(events);
  return phase;
}

export const snap = { type: 'spring' as const, stiffness: 320, damping: 26 };
export const glide = { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] as const };
