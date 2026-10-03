import { Fragment } from 'react';
import './WorkloadHeatmap.css';

// Load value → intensity class. 0 is a quiet neutral dot; 1–3 deepen the
// accent; 4 and 5+ warm to warning / danger.
function level(v) {
  if (!v || v <= 0) return 0;
  return Math.min(5, Math.round(v));
}

/**
 * Daily load heatmap (people × days). `data` is `[{ name, load: number[] }]`
 * where each load value is 0–5 (story points / tasks). Colors warm as load
 * grows. A per-person total sits at the end of each row.
 */
export function WorkloadHeatmap({ days = [], data = [] }) {
  return (
    <div className="workload-heat" style={{ '--heat-days': days.length }}>
      <div />
      {days.map((d, i) => (
        <div key={`d-${i}`} className="workload-heat__day">
          {d}
        </div>
      ))}
      <div className="workload-heat__day workload-heat__total-head">Total</div>
      {data.map((row, i) => (
        <Fragment key={`p-${i}`}>
          <div className="workload-heat__name truncate" title={row.name}>{row.name}</div>
          {row.load.map((v, j) => (
            <div
              key={`c-${i}-${j}`}
              className={`workload-heat__cell is-l${level(v)}`}
              title={`${row.name} · ${days[j]} · ${v}`}
            />
          ))}
          <div className="workload-heat__total">
            {row.load.reduce((s, v) => s + (v ?? 0), 0)}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
