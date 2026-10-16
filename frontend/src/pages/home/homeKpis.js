import { Clock, Flame, TrendingUp, Trophy } from 'lucide-react';
import { DASH, formatNumber, formatSigned } from '@/utils/formatMetrics';

/**
 * Build the four /home KPI tiles from the server-computed `/users/me/home`
 * payload. Pure (no fetching) so empty / partial payloads are unit-tested.
 * @param {object|null} k `kpis` from the payload
 * @returns {Array<{label: string, value: string, delta: string|null, good?: boolean, hint: string, tone: string, icon: Function}>}
 */
export function buildHomeKpis(k) {
  if (!k) return [];
  const velocityLabel = k.velocitySprints > 0 ? `Velocity (${k.velocitySprints}-sprint)` : 'Velocity';
  return [
    {
      label: 'Completed',
      value: String(k.completed30 ?? 0),
      delta: formatSigned(k.completedDelta),
      good: (k.completedDelta ?? 0) >= 0,
      hint: 'last 30 days',
      tone: 'success',
      icon: Trophy,
    },
    {
      label: 'Avg cycle time',
      value: formatNumber(k.avgCycleDays, { suffix: 'd' }),
      delta: formatSigned(k.avgCycleDeltaDays, 'd'),
      // Shorter cycle time is good news.
      good: (k.avgCycleDeltaDays ?? 0) <= 0,
      hint: k.avgCycleDays == null ? 'no finished tasks yet' : 'start → done',
      tone: 'success',
      icon: Clock,
    },
    {
      label: 'Current streak',
      value: `${k.streakDays ?? 0}d`,
      delta: null,
      hint: 'days in a row with a completion',
      tone: 'warning',
      icon: Flame,
    },
    {
      label: velocityLabel,
      value: k.velocity == null ? DASH : formatNumber(k.velocity, { suffix: 'pt' }),
      delta: formatSigned(k.velocityDelta, 'pt'),
      good: (k.velocityDelta ?? 0) >= 0,
      hint: k.velocity == null ? 'no sprint work yet' : 'your points per sprint',
      tone: 'info',
      icon: TrendingUp,
    },
  ];
}
