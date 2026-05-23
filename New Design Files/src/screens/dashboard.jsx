// Dashboard — composable widgets that work cross-type.

const Dashboard = () => {
  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Insights</div>
            <h1 className="page-title">Org Dashboard</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>Live snapshot across every project type · refreshed 4m ago</p>
          </div>
          <div className="row gap-3">
            <Segmented value="7" onChange={()=>{}}
              options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }]} />
            <Button icon={<I.Plus size={13} />}>Add widget</Button>
          </div>
        </div>
      </div>

      <div className="grid-12">
        {/* Velocity chart */}
        <div className="card col-8">
          <div className="card-header">
            <div className="row gap-3">
              <strong>Engineering velocity</strong>
              <Badge>2 projects</Badge>
            </div>
            <div className="row gap-3">
              <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>pts completed per sprint</span>
              <Button variant="ghost" size="sm" icon={<I.More size={12} />} />
            </div>
          </div>
          <div className="card-body" style={{ padding: 'var(--s-7)' }}>
            <BarChart data={[
              { l: 'S18', v: 26, c: 32 },
              { l: 'S19', v: 30, c: 32 },
              { l: 'S20', v: 28, c: 36 },
              { l: 'S21', v: 34, c: 36 },
              { l: 'S22', v: 32, c: 38 },
              { l: 'S23', v: 38, c: 40 },
              { l: 'S24', v: 24, c: 42, current: true },
            ]} />
          </div>
        </div>

        {/* Health distribution */}
        <div className="card col-4">
          <div className="card-header"><strong>Project health</strong><span className="muted mono" style={{ fontSize: 'var(--fs-xs)' }}>{MOCK.PROJECTS.length} projects</span></div>
          <div className="card-body">
            <div className="col gap-4">
              {MOCK.PROJECTS.slice(0,5).map(p => {
                const pt = MOCK.PROJECT_TYPES[p.type];
                return (
                  <div key={p.id} className="row gap-4">
                    <div className={`proj-icon proj-icon-${pt.accent}`} style={{ width: 24, height: 24, fontSize: 10, borderRadius: 'var(--r-sm)' }}>{p.icon}</div>
                    <div className="col" style={{ flex: 1, gap: 4, minWidth: 0 }}>
                      <div className="row between">
                        <span style={{ fontSize: 'var(--fs-sm)' }} className="truncate">{p.name.split(' — ')[0]}</span>
                        <span className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{p.health}</span>
                      </div>
                      <Bar value={p.health} variant={p.health >= 80 ? 'success' : p.health >= 60 ? 'warning' : 'danger'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Workload heatmap */}
        <div className="card col-8">
          <div className="card-header"><strong>Workload heatmap</strong><span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>this week</span></div>
          <div className="card-body">
            <Heatmap />
          </div>
        </div>

        {/* Pipeline mix */}
        <div className="card col-4">
          <div className="card-header"><strong>Pipeline by stage</strong></div>
          <div className="card-body">
            <PipelineChart />
          </div>
        </div>

        {/* Cycle time */}
        <div className="card col-6">
          <div className="card-header"><strong>Cycle time</strong><Badge tone="success" dot>-2d vs avg</Badge></div>
          <div className="card-body">
            <div className="row gap-7" style={{ alignItems: 'flex-end' }}>
              <div className="col" style={{ gap: 6 }}>
                <span className="mono" style={{ fontSize: 'var(--fs-4xl)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>3.4<span style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)' }}>d</span></span>
                <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>median across eng + sales</span>
              </div>
              <Sparkline data={[4.2, 4.1, 4.0, 3.8, 3.6, 3.9, 3.7, 3.5, 3.4]} color="var(--success)" width={220} height={60} />
            </div>
          </div>
        </div>

        {/* SLA */}
        <div className="card col-6">
          <div className="card-header"><strong>Support SLA</strong><Badge tone="success" dot>94%</Badge></div>
          <div className="card-body">
            <div className="col gap-4">
              {[
                { l: 'First response', value: 96 },
                { l: 'Resolution', value: 91 },
                { l: 'CSAT', value: 94 },
              ].map(r => (
                <div key={r.l} className="row gap-4">
                  <span style={{ width: 120, fontSize: 'var(--fs-sm)' }}>{r.l}</span>
                  <Bar value={r.value} variant="success" />
                  <span className="mono" style={{ fontSize: 'var(--fs-xs)', minWidth: 36, textAlign: 'right' }}>{r.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BarChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.c));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 'var(--s-5)', alignItems: 'end', height: 220, paddingBottom: 'var(--s-5)' }}>
      {data.map((d, i) => (
        <div key={i} className="col" style={{ alignItems: 'center', gap: 'var(--s-3)', height: '100%' }}>
          <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{d.v}</span>
          <div style={{ position: 'relative', flex: 1, width: '60%', display: 'flex', alignItems: 'end', minHeight: 4 }}>
            <div style={{
              width: '100%', height: `${(d.v / max) * 100}%`,
              background: d.current ? 'var(--ai-gradient)' : 'var(--accent)',
              borderRadius: '6px 6px 0 0',
              minHeight: 4,
            }} />
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: `${(d.c / max) * 100}%`,
              border: '1.5px dashed var(--border-strong)', borderBottom: 0,
              borderRadius: '6px 6px 0 0',
              pointerEvents: 'none',
            }} />
          </div>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>{d.l}</span>
        </div>
      ))}
    </div>
  );
};

const Heatmap = () => {
  const members = MOCK.MEMBERS.slice(0, 6);
  const days = ['M','T','W','T','F'];
  return (
    <div className="col gap-3">
      <div style={{ display: 'grid', gridTemplateColumns: '110px repeat(5, 1fr) 50px', gap: 6, fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 'var(--tracking-wide)' }}>
        <div />
        {days.map((d, i) => <div key={i} style={{ textAlign: 'center' }}>{d}</div>)}
        <div style={{ textAlign: 'center' }}>util</div>
      </div>
      {members.map((m, i) => {
        const vals = [0.7, 0.9, 0.5, 1.1, 0.4].map((v, j) => v + (i * 0.13) % 0.6 - 0.2);
        const util = vals.reduce((a,b)=>a+b, 0) / vals.length;
        return (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '110px repeat(5, 1fr) 50px', gap: 6, alignItems: 'center' }}>
            <div className="row gap-3"><Avatar user={m} size="sm" /><span className="truncate" style={{ fontSize: 'var(--fs-sm)' }}>{m.name.split(' ')[0]}</span></div>
            {vals.map((v, j) => {
              const clamp = Math.max(0, Math.min(1.3, v));
              const intensity = Math.min(1, clamp);
              const over = clamp > 1;
              return (
                <div key={j} style={{
                  height: 24, borderRadius: 'var(--r-sm)',
                  background: over
                    ? `hsl(354 78% ${65 - intensity * 12}% / 0.85)`
                    : `hsl(217 91% ${88 - intensity * 30}%)`,
                }} />
              );
            })}
            <span className="mono" style={{ fontSize: 'var(--fs-xs)', textAlign: 'center', color: util > 1 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600 }}>{Math.round(util * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
};

const PipelineChart = () => {
  const stages = MOCK.DEAL_STAGES.slice(0, 4);
  const data = stages.map(s => ({
    name: s.name, hue: s.hue,
    val: MOCK.DEALS.filter(d => d.stage === s.id).reduce((a,b)=>a+b.amount, 0),
  }));
  const max = Math.max(...data.map(d => d.val));
  return (
    <div className="col gap-4">
      {data.map(d => (
        <div key={d.name} className="col" style={{ gap: 4 }}>
          <div className="row between">
            <span style={{ fontSize: 'var(--fs-sm)' }}>{d.name}</span>
            <span className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>${(d.val/1000).toFixed(0)}k</span>
          </div>
          <div className="bar"><div className="bar-fill" style={{ width: `${(d.val / max) * 100}%`, background: d.hue }} /></div>
        </div>
      ))}
    </div>
  );
};

window.Dashboard = Dashboard;
