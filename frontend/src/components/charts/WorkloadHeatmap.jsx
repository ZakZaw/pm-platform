import { Fragment } from 'react';
import './WorkloadHeatmap.css';

/**
 * Daily load heatmap (people × days). `data` is `[{ name, load: number[] }]`
 * where each load value is 0–5 (story points). Colors warm as load grows.
 */
export function WorkloadHeatmap({ days = [], data = [] }) {
  const shade = (v) => {
    const a = 0.10 + (v / 5) * 0.55;
    if (v >= 5) return `rgba(229, 72, 77, ${a})`;
    if (v >= 4) return `rgba(224, 162, 58, ${a})`;
    return `rgba(91, 106, 240, ${a})`;
  };
  return (
    <div
      className="workload-heat"
      style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
    >
      <div />
      {days.map((d, i) => (
        <div key={`d-${i}`} className="mono workload-heat__day">
          {d}
        </div>
      ))}
      {data.map((row, i) => (
        <Fragment key={`p-${i}`}>
          <div className="workload-heat__name truncate">{row.name}</div>
          {row.load.map((v, j) => (
            <div
              key={`c-${i}-${j}`}
              className="workload-heat__cell"
              style={{ background: shade(v) }}
              title={`${row.name} · ${days[j]} · ${v}pt`}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
