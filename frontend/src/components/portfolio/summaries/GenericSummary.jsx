import { useEffect, useState } from 'react';
import { listsApi } from '@/api/lists.api';
import { SummaryCard, SummaryMetric, SummaryRow } from '../SummaryCard';

export function GenericSummary({ project }) {
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listsApi.getView(project.id)
      .then((v) => !cancelled && setView(v))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [project.id]);

  const all = [
    ...(view?.unsorted ?? []),
    ...((view?.lists ?? []).flatMap((l) => l.tasks)),
  ];
  const open = all.filter((t) => t.status !== 'Done' && t.status !== 'WontDo').length;
  const done = all.filter((t) => t.status === 'Done').length;
  const pct = all.length === 0 ? 0 : Math.round((done / all.length) * 100);

  return (
    <SummaryCard
      loading={loading}
      error={error}
      footer={`${view?.lists?.length ?? 0} list${view?.lists?.length === 1 ? '' : 's'}`}
    >
      <SummaryMetric
        label="Open tasks"
        value={open}
        sublabel={`${all.length} total`}
      />
      <SummaryRow
        label="Completion"
        value={`${pct}%`}
        tone={pct >= 75 ? 'success' : undefined}
      />
    </SummaryCard>
  );
}
