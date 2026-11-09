import { useEffect, useState } from 'react';

/**
 * Returns Date.now(), refreshed on a fixed interval so time-relative UI
 * (due-date buckets, "expired" flags, SLA countdowns) stays current without
 * calling the impure Date.now() during render. Default cadence: 1 minute.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
