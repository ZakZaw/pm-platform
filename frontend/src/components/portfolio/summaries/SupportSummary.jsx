import { useEffect, useState } from 'react';
import { supportApi } from '@/api/support.api';
import { SummaryCard, SummaryMetric, SummaryRow } from '../SummaryCard';

export function SupportSummary({ project }) {
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supportApi.getQueueView(project.id)
      .then((v) => !cancelled && setView(v))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [project.id]);

  const queues = view?.queues ?? [];
  const open = queues.reduce((s, q) => s + q.openCount, 0);
  const breached = queues.reduce((s, q) => s + q.breachedCount, 0);
  const attainment = open === 0 ? 100 : Math.round(((open - breached) / open) * 100);

  return (
    <SummaryCard
      loading={loading}
      error={error}
      footer={`${queues.length} queue${queues.length === 1 ? '' : 's'}`}
    >
      <SummaryMetric
        label="Open tickets"
        value={open}
        tone={breached > 0 ? 'danger' : undefined}
        sublabel={breached > 0 ? `${breached} past SLA` : 'All within SLA'}
      />
      <SummaryRow
        label="SLA attainment"
        value={`${attainment}%`}
        tone={attainment >= 95 ? 'success' : attainment >= 80 ? 'warning' : 'danger'}
      />
    </SummaryCard>
  );
}
