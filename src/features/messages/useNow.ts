import { useEffect, useState } from 'react';

// The current time, refreshed on an interval so poll countdowns keep moving.
export function useNow(intervalMs = 30 * 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
