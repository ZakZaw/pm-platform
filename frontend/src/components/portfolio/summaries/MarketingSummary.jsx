import { useEffect, useState } from 'react';
import { marketingApi } from '@/api/marketing.api';
import { SummaryCard, SummaryMetric, SummaryRow } from '../SummaryCard';

export function MarketingSummary({ project }) {
  const [campaigns, setCampaigns] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
    Promise.all([
      marketingApi.listCampaigns(project.id),
      marketingApi.getCalendar(project.id, {
        from: now.toISOString(),
        to: weekAhead.toISOString(),
      }).catch(() => null),
    ])
      .then(([cs, cal]) => {
        if (cancelled) return;
        setCampaigns(cs);
        setCalendar(cal);
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [project.id]);

  const active = (campaigns ?? []).filter(
    (c) => c.status === 'Active' || c.status === 'Planning'
  ).length;
  const dueThisWeek = calendar?.assets?.length ?? 0;
  const published = (campaigns ?? []).reduce(
    (s, c) => s + (c.publishedAssetCount ?? 0), 0);

  return (
    <SummaryCard
      loading={loading}
      error={error}
      footer={`${campaigns?.length ?? 0} total campaign${campaigns?.length === 1 ? '' : 's'}`}
    >
      <SummaryMetric
        label="Active campaigns"
        value={active}
        sublabel={`${published} asset${published === 1 ? '' : 's'} published all-time`}
      />
      <SummaryRow
        label="Assets due this week"
        value={dueThisWeek}
        tone={dueThisWeek > 5 ? 'warning' : undefined}
      />
    </SummaryCard>
  );
}
