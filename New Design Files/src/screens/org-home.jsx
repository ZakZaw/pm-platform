// Org Home — project picker showing mix of project types.

const OrgHome = ({ projects, onPickProject, onOpenAIWizard }) => {
  const [filter, setFilter] = useState('all');
  const types = ['all', ...Object.keys(MOCK.PROJECT_TYPES)];
  const shown = filter === 'all' ? projects : projects.filter(p => p.type === filter);

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Workspace</div>
            <h1 className="page-title">Good afternoon, Aria</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              {projects.length} active projects across {new Set(projects.map(p=>p.type)).size} types · 18 members · 3 AI suggestions waiting
            </p>
          </div>
          <div className="row gap-3">
            <Button variant="" icon={<I.Filter size={14} />}>Filter</Button>
            <Button variant="ai" icon={<I.Sparkle size={13} stroke={2.4} />} onClick={onOpenAIWizard}>New project</Button>
          </div>
        </div>
      </div>

      {/* Hero stat strip */}
      <div className="grid-4" style={{ marginBottom: 'var(--s-9)' }}>
        <div className="stat">
          <div className="stat-label">Portfolio health<I.Trend size={12} /></div>
          <div className="stat-row">
            <div className="stat-value">82</div>
            <HealthRing value={82} size={32} />
          </div>
          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>across {projects.length} projects · daily snapshot</div>
        </div>
        <div className="stat">
          <div className="stat-label">Velocity (eng)</div>
          <div className="stat-row">
            <div className="stat-value">34<span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', fontWeight: 500 }}> pts/wk</span></div>
            <span className="stat-delta stat-delta-up"><I.ArrowUp size={10} stroke={3} />8%</span>
          </div>
          <Sparkline data={[22,24,26,25,28,30,28,32,30,33,34]} color="var(--accent)" />
        </div>
        <div className="stat">
          <div className="stat-label">Pipeline value</div>
          <div className="stat-row">
            <div className="stat-value mono">$1.26m</div>
            <span className="stat-delta stat-delta-up"><I.ArrowUp size={10} stroke={3} />12%</span>
          </div>
          <Sparkline data={[800,820,810,900,950,1000,1050,1100,1150,1180,1260]} color="var(--success)" />
        </div>
        <div className="stat">
          <div className="stat-label">Open tickets · SLA</div>
          <div className="stat-row">
            <div className="stat-value">28<span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', fontWeight: 500 }}> open</span></div>
            <span className="stat-delta stat-delta-up"><I.Check size={10} stroke={3} />94%</span>
          </div>
          <Sparkline data={[40,38,36,35,32,30,32,30,28,29,28]} color="var(--violet)" />
        </div>
      </div>

      {/* AI ribbon */}
      <div className="ai-card" style={{ marginBottom: 'var(--s-9)' }}>
        <div className="ai-card-head">
          <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
          <div className="col" style={{ gap: 2, flex: 1 }}>
            <strong style={{ fontSize: 'var(--fs-md)' }}>3 suggestions are waiting for your call</strong>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Sprint replan · stalled deal · weekly support digest</span>
          </div>
          <Button variant="" size="sm">View inbox<I.Arrow size={12} /></Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="between" style={{ marginBottom: 'var(--s-6)' }}>
        <h2 className="h-section">Projects</h2>
        <div className="row gap-3">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={types.map(t => ({ value: t, label: t === 'all' ? 'All' : MOCK.PROJECT_TYPES[t].label }))}
          />
        </div>
      </div>

      <div className="grid-3">
        {shown.map(p => {
          const pt = MOCK.PROJECT_TYPES[p.type];
          const members = p.members.map(MOCK.userById);
          return (
            <button key={p.id} className="card card-hover" style={{ textAlign: 'left', padding: 0, display: 'block', width: '100%' }} onClick={() => onPickProject(p.id)}>
              <div style={{ padding: 'var(--s-6) var(--s-6) var(--s-5)' }}>
                <div className="row gap-4" style={{ marginBottom: 'var(--s-5)' }}>
                  <div className={`proj-icon proj-icon-${pt.accent}`} style={{ width: 36, height: 36, fontSize: 'var(--fs-md)' }}>{p.icon}</div>
                  <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                    <div className="row between gap-3">
                      <Badge tone={pt.accent === 'engineering' ? 'accent' : pt.accent === 'sales' ? 'success' : pt.accent === 'support' ? 'rose' : pt.accent === 'marketing' ? 'warning' : 'violet'}>
                        <span className="badge-dot" />
                        {pt.label}
                      </Badge>
                      {p.ai !== 'off' && <AIChip>{p.ai === 'autopilot' ? 'Autopilot' : p.ai === 'suggest' ? 'Suggest' : 'Ask first'}</AIChip>}
                    </div>
                  </div>
                </div>
                <div className="h-card" style={{ marginBottom: 'var(--s-3)', lineHeight: 1.25 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginBottom: 'var(--s-5)' }}>{pt.hierarchy}</div>

                <div className="row gap-4" style={{ marginBottom: 'var(--s-5)' }}>
                  <div className="col" style={{ gap: 4, flex: 1 }}>
                    <div className="row between">
                      <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Progress</span>
                      <span className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{p.progress}%</span>
                    </div>
                    <Bar value={p.progress} variant={p.status === 'at-risk' ? 'warning' : ''} />
                  </div>
                  <div className="col center" style={{ gap: 2 }}>
                    <HealthRing value={p.health} size={32} />
                  </div>
                </div>

                <div className="row between">
                  <AvatarStack users={members} max={4} size="sm" />
                  <div className="row gap-3 muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    <I.Calendar size={12} />
                    <span>{p.due}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {/* New project tile */}
        <button className="card card-hover" onClick={onOpenAIWizard} style={{
          minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--s-4)', borderStyle: 'dashed', background: 'transparent', cursor: 'pointer',
        }}>
          <div className="ai-mark" style={{ width: 36, height: 36, borderRadius: 'var(--r-md)' }}>
            <I.Plus size={18} stroke={2.4} />
          </div>
          <div className="h-card">Start a new project</div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', textAlign: 'center', padding: '0 var(--s-7)' }}>
            Describe what you want to ship. AI will pick the right type and scaffold the work.
          </div>
        </button>
      </div>
    </div>
  );
};

window.OrgHome = OrgHome;
