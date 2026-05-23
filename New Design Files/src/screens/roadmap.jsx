// Portfolio Roadmap (Gantt-ish) — cross-type, color-coded.

const Roadmap = () => {
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Each row: project name, type, start month (0-5), end (0-5), progress %
  // We'll inline some sub-milestones too.
  const lanes = [
    { p: 'p_apollo',   bars: [
      { type: 'eng',  start: 0,   end: 1.8, progress: 65, label: 'Apollo · Onboarding (Sprint 22-25)' },
      { type: 'milestone', at: 1.6, label: 'Launch' },
    ]},
    { p: 'p_loom',     bars: [
      { type: 'eng',  start: 0.5, end: 3.2, progress: 30, label: 'Loom · Internal Tooling' },
    ]},
    { p: 'p_orbital',  bars: [
      { type: 'sales',start: 0,   end: 2.8, progress: 55, label: 'Orbital Q3 Outbound — close period' },
      { type: 'milestone', at: 2.7, label: 'EOQ close' },
    ]},
    { p: 'p_canopy',   bars: [
      { type: 'mkt',  start: 0,   end: 1.0, progress: 70, label: 'Spring Brand · launch wave' },
      { type: 'mkt',  start: 1.2, end: 2.5, progress: 10, label: 'Q3 customer stories' },
    ]},
    { p: 'p_relay',    bars: [
      { type: 'sup',  start: 0,   end: 5.8, progress: 50, label: 'Customer Support — ongoing' },
    ]},
    { p: 'p_audit',    bars: [
      { type: 'ops',  start: 0.2, end: 1.2, progress: 81, label: 'SOC 2 audit · prep' },
      { type: 'milestone', at: 1.2, label: 'Audit start' },
      { type: 'ops',  start: 1.2, end: 2.4, progress: 0, label: 'Audit fieldwork' },
    ]},
  ];

  const colorFor = (type) => ({
    eng: 'var(--accent)', sales: 'var(--success)', sup: 'var(--rose)',
    mkt: 'var(--warning)', ops: 'var(--violet)',
  }[type]);

  const pos = (n) => `${(n / 6) * 100}%`;

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Portfolio</div>
            <h1 className="page-title">Roadmap — Q3 2026</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              Cross-project timeline. Bars are color-coded by project type.
            </p>
          </div>
          <div className="row gap-4">
            <Segmented value="q" onChange={()=>{}}
              options={[{ value: 'q', label: 'Quarter' }, { value: 'm', label: 'Month' }, { value: 'y', label: 'Year' }]} />
            <Button icon={<I.Filter size={13} />}>Filter</Button>
            <Button variant="primary" icon={<I.Plus size={14} />}>Milestone</Button>
          </div>
        </div>
      </div>

      {/* Color legend */}
      <div className="row gap-5" style={{ marginBottom: 'var(--s-5)' }}>
        {[
          ['Engineering', 'eng'], ['Sales', 'sales'], ['Support', 'sup'],
          ['Marketing', 'mkt'], ['Operations', 'ops'],
        ].map(([n, k]) => (
          <div key={k} className="row gap-3" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            <span style={{ width: 12, height: 4, borderRadius: 2, background: colorFor(k) }} />{n}
          </div>
        ))}
      </div>

      <div className="gantt">
        <div className="gantt-head">
          <div>Project</div>
          <div className="gantt-months">
            {months.map(m => <div key={m}>{m} '26</div>)}
          </div>
        </div>
        {lanes.map((l, i) => {
          const proj = MOCK.projectById(l.p);
          const pt = MOCK.PROJECT_TYPES[proj.type];
          return (
            <div key={i} className="gantt-row">
              <div className="gantt-label">
                <div className={`proj-icon proj-icon-${pt.accent}`} style={{ width: 22, height: 22, fontSize: 9, borderRadius: 'var(--r-sm)' }}>{proj.icon}</div>
                <div className="col" style={{ gap: 0, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }} className="truncate">{proj.name.split(' — ')[0]}</div>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{pt.label}</div>
                </div>
              </div>
              <div className="gantt-track">
                {l.bars.map((b, bi) => {
                  if (b.type === 'milestone') {
                    return (
                      <Tip key={bi} text={b.label}>
                        <div className="gantt-milestone" style={{
                          left: `calc(${pos(b.at)} - 12px)`,
                          background: 'var(--surface)',
                          borderColor: 'var(--text)',
                        }} />
                      </Tip>
                    );
                  }
                  return (
                    <div key={bi} className="gantt-bar" style={{
                      left: pos(b.start), width: `calc(${pos(b.end - b.start)})`,
                      background: colorFor(b.type),
                    }}>
                      <span style={{ position: 'relative', zIndex: 1 }} className="truncate">{b.label}</span>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${b.progress}%`, background: 'rgba(255,255,255,0.18)',
                        borderRadius: 'inherit',
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

window.Roadmap = Roadmap;
