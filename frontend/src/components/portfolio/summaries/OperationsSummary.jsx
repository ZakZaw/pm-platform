import { useEffect, useState } from 'react';
import { operationsApi } from '@/api/operations.api';
import { SummaryCard, SummaryMetric, SummaryRow } from '../SummaryCard';

export function OperationsSummary({ project }) {
  const [workflows, setWorkflows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    operationsApi.listWorkflows(project.id)
      .then((w) => !cancelled && setWorkflows(w))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [project.id]);

  const now = Date.now();
  const horizon = now + 7 * 86_400_000;
  const upcoming = (workflows ?? []).filter((w) => {
    if (!w.nextRunAt) return false;
    const t = new Date(w.nextRunAt).getTime();
    return t >= now && t <= horizon;
  }).length;
  const overdue = (workflows ?? []).reduce(
    (s, w) => s + (w.overdueRunCount ?? 0), 0);

  return (
    <SummaryCard
      loading={loading}
      error={error}
      footer={`${workflows?.length ?? 0} workflow${workflows?.length === 1 ? '' : 's'}`}
    >
      <SummaryMetric
        label="Runs next 7d"
        value={upcoming}
        sublabel="scheduled"
      />
      <SummaryRow
        label="Overdue runs"
        value={overdue}
        tone={overdue > 0 ? 'danger' : 'success'}
      />
    </SummaryCard>
  );
}
