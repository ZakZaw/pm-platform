import { useEffect, useState } from 'react';
import { boardApi } from '@/api/board.api';
import { sprintsApi } from '@/api/sprints.api';
import { SummaryCard, SummaryMetric, SummaryRow } from '../SummaryCard';

export function EngineeringSummary({ project }) {
  const [board, setBoard] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      boardApi.get(project.id).catch(() => null),
      sprintsApi.getActive(project.id).catch(() => null),
    ])
      .then(([b, s]) => {
        if (cancelled) return;
        setBoard(b);
        setSprint(s);
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [project.id]);

  let open = 0;
  let done = 0;
  let total = 0;
  if (board) {
    for (const lane of board.swimlanes) {
      for (const col of lane.columns) {
        total += col.cards.length;
        if (col.status === 'Done') done += col.cards.length;
        else if (col.status !== 'WontDo') open += col.cards.length;
      }
    }
  }

  return (
    <SummaryCard loading={loading} error={error} footer={sprint ? sprint.name : 'No active sprint'}>
      <SummaryMetric
        label="Open tasks"
        value={open}
        sublabel={`${done} done / ${total} total`}
      />
      {sprint && (
        <SummaryRow
          label="Sprint goal"
          value={sprint.goal ? '✓' : '—'}
        />
      )}
    </SummaryCard>
  );
}
