// Sales — Pipeline (kanban by deal stage, with $ totals per column)

const SalesPipeline = ({ project, onOpenItem }) => {
  const stages = MOCK.DEAL_STAGES;
  const fmt = (n) => '$' + (n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : n);

  const totals = stages.map(s => MOCK.DEALS.filter(d => d.stage === s.id).reduce((a,b) => a + b.amount, 0));
  const grandTotal = totals.reduce((a,b)=>a+b, 0);

  return (
    <div className="main-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 'var(--s-7) var(--s-9)' }}>
      <div className="page-head" style={{ marginBottom: 'var(--s-6)' }}>
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Sales · Pipeline</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Q3 — Mid-market Fintech</h1>
          </div>
          <div className="row gap-4">
            <div className="row gap-4" style={{ padding: 'var(--s-3) var(--s-5)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div className="col" style={{ gap: 0 }}>
                <div className="muted" style={{ fontSize: 'var(--fs-2xs)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 'var(--tracking-wide)' }}>Weighted</div>
                <div className="mono" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.02em' }}>$486k</div>
              </div>
              <div className="divider-v" style={{ alignSelf: 'stretch' }} />
              <div className="col" style={{ gap: 0 }}>
                <div className="muted" style={{ fontSize: 'var(--fs-2xs)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 'var(--tracking-wide)' }}>Quota</div>
                <div className="row gap-3"><span className="mono" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.02em' }}>68%</span>
                <div className="bar" style={{ width: 60 }}><div className="bar-fill bar-fill-success" style={{ width: '68%' }} /></div></div>
              </div>
            </div>
            <Button variant="ai" size="sm" icon={<I.Sparkle size={13} stroke={2.4} />}>Score & rank leads</Button>
            <Button variant="primary" icon={<I.Plus size={14} />}>New deal</Button>
          </div>
        </div>
      </div>

      <div className="row gap-4" style={{ marginBottom: 'var(--s-6)' }}>
        <Chip>Owner: All</Chip>
        <Chip>Close: this quarter</Chip>
        <Chip>Source: All</Chip>
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{MOCK.DEALS.length} deals · {fmt(grandTotal)}</span>
      </div>

      <div className="pipeline" style={{ flex: 1, minHeight: 0 }}>
        {stages.map((s, si) => {
          const deals = MOCK.DEALS.filter(d => d.stage === s.id);
          const total = totals[si];
          return (
            <div key={s.id} className="pipe-col">
              <div className="pipe-col-head">
                <div className="pipe-stage-bar" style={{ background: s.hue }} />
                <div className="pipe-col-title">
                  <span className="pipe-col-name">{s.name}</span>
                  <span className="muted mono" style={{ fontSize: 'var(--fs-xs)' }}>{deals.length}</span>
                </div>
                <div className="pipe-col-sub">
                  <span className="pipe-col-amount">{fmt(total)}</span>
                  <button className="btn btn-ghost btn-icon-sm"><I.Plus size={12} /></button>
                </div>
              </div>
              <div className="pipe-col-body">
                {deals.map(d => {
                  const owner = MOCK.userById(d.owner);
                  const days = Math.floor((new Date(d.close) - new Date('2026-07-23')) / 86400000);
                  return (
                    <div key={d.id} className="deal-card" onClick={() => onOpenItem(d.id)}>
                      <div className="row gap-3 between" style={{ marginBottom: 'var(--s-3)' }}>
                        <div className={`proj-icon proj-icon-${'sales'}`} style={{ width: 22, height: 22, fontSize: 9, borderRadius: 'var(--r-sm)' }}>{d.icon}</div>
                        <span className="muted mono" style={{ fontSize: 'var(--fs-2xs)' }}>{d.id}</span>
                      </div>
                      <div className="deal-name">{d.name}</div>
                      <div className="deal-company">{d.company}</div>
                      <div className="row between" style={{ marginTop: 'var(--s-3)' }}>
                        <span className="deal-amt">{fmt(d.amount)}</span>
                        <Avatar user={owner} size="xs" />
                      </div>
                      <div className="row between" style={{ marginTop: 'var(--s-3)' }}>
                        <span className="muted" style={{ fontSize: 'var(--fs-2xs)' }}>{d.activity}</span>
                        <span className="muted mono" style={{ fontSize: 'var(--fs-2xs)' }}>{days}d</span>
                      </div>
                      {/* Stalled hint */}
                      {d.id === 'D-122' && (
                        <div className="row gap-2" style={{
                          marginTop: 'var(--s-3)', padding: '4px var(--s-3)',
                          background: 'var(--ai-gradient-soft)', border: '1px solid var(--ai-border)',
                          borderRadius: 'var(--r-sm)', color: 'var(--ai-text)',
                          fontSize: 'var(--fs-2xs)', fontWeight: 500,
                        }}>
                          <I.Sparkle size={9} stroke={2.4} />
                          <span>Stalled 9d · AI suggests nudge</span>
                        </div>
                      )}
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

window.SalesPipeline = SalesPipeline;
