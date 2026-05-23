// Marketing — Content Calendar

const MarketingCalendar = ({ project, onOpenItem }) => {
  // Build a 5x7 grid for "July 2026". Days 1..31 with offset.
  const dim = 31; const offset = 2; // July 1 2026 is Wednesday => offset 3, but let's use 2 (Tue) for layout variety
  const today = 14;
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const day = i - offset + 1;
    cells.push({ day, valid: day >= 1 && day <= dim, isToday: day === today });
  }
  const events = MOCK.ASSETS;
  const byDay = events.reduce((acc, e) => {
    (acc[e.day] = acc[e.day] || []).push(e); return acc;
  }, {});

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const legend = [
    { k: 'blog', label: 'Blog', color: 'var(--info)' },
    { k: 'email', label: 'Email', color: 'var(--accent)' },
    { k: 'social', label: 'Social', color: 'var(--rose)' },
    { k: 'event', label: 'Event', color: 'var(--violet)' },
    { k: 'ad', label: 'Ad', color: 'var(--warning)' },
  ];

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Marketing · Content calendar</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>July 2026 — Canopy</h1>
          </div>
          <div className="row gap-4">
            <div className="row gap-3">
              <button className="btn btn-ghost btn-icon"><I.Chevron size={14} style={{ transform: 'rotate(180deg)' }} /></button>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 500, minWidth: 80, textAlign: 'center' }}>July 2026</span>
              <button className="btn btn-ghost btn-icon"><I.Chevron size={14} /></button>
            </div>
            <Segmented value="month" onChange={() => {}}
              options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'list', label: 'List' }]} />
            <Button variant="ai" size="sm" icon={<I.Sparkle size={13} stroke={2.4} />}>Draft week ahead</Button>
            <Button variant="primary" icon={<I.Plus size={14} />}>New asset</Button>
          </div>
        </div>
      </div>

      <div className="row gap-5" style={{ marginBottom: 'var(--s-5)' }}>
        {legend.map(l => (
          <div key={l.k} className="row gap-3" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <Chip>Campaign: All</Chip>
        <Chip>Channel: All</Chip>
      </div>

      <div className="cal">
        <div className="cal-head">{dayNames.map(d => <div key={d}>{d}</div>)}</div>
        <div className="cal-grid">
          {cells.map((c, i) => (
            <div key={i} className={`cal-cell ${!c.valid ? 'is-other' : ''} ${c.isToday ? 'is-today' : ''}`}>
              <div className="cal-date">{c.valid ? c.day : ''}</div>
              {c.valid && byDay[c.day]?.map((e, j) => (
                <div key={j} className={`cal-event evt-${e.type}`} onClick={() => onOpenItem(`asset-${c.day}-${j}`)}>
                  <span>{e.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.MarketingCalendar = MarketingCalendar;
