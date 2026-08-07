import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

/**
 * Re-renders once a minute. Used by the "resets in HH:MM" countdowns, which
 * only ever change at minute granularity — polling any faster would burn
 * battery for no visible difference.
 */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), MINUTE_MS);
    return () => clearInterval(id);
  }, []);

  return tick;
}
