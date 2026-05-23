import { useEffect, useState } from 'react';
import { salesApi } from '@/api/sales.api';
import { SummaryCard, SummaryMetric, SummaryRow } from '../SummaryCard';

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

export function SalesSummary({ project }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    salesApi.getPipeline(project.id)
      .then((p) => !cancelled && setPipeline(p))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [project.id]);

  let total = 0;
  let openDeals = 0;
  let weighted = 0;
  let currency = 'USD';
  for (const s of pipeline?.stages ?? []) {
    for (const d of s.deals ?? []) {
      total += d.value ?? 0;
      weighted += (d.value ?? 0) * ((d.probability ?? 0) / 100);
      openDeals += 1;
      if (d.currency) currency = d.currency;
    }
  }

  return (
    <SummaryCard loading={loading} error={error} footer={`${pipeline?.stages?.length ?? 0} stages`}>
      <SummaryMetric
        label="Open pipeline"
        value={formatMoney(total, currency)}
        sublabel={`${openDeals} deal${openDeals === 1 ? '' : 's'}`}
      />
      <SummaryRow
        label="Weighted forecast"
        value={formatMoney(Math.round(weighted), currency)}
      />
    </SummaryCard>
  );
}
