// Project Home — polymorphic header that adapts to project type.
// Used as the landing page once you select a project. Shows different KPIs
// and prompts depending on which work model the project uses.

const ProjectHome = ({ project, projectType, setPage, onOpenItem, onOpenAIPanel }) => {
  const v = projectType.vocab;
  const members = project.members.map(MOCK.userById);

  // Type-specific KPI bar
  const kpis = {
    engineering: [
      { label: 'Sprint', value: 'S24', sub: '6d left', delta: null },
      { label: 'Velocity', value: '34', sub: 'pts/wk', delta: '+8%', up: true },
      { label: 'Bugs open', value: '7', sub: '2 urgent', delta: '-3', up: true },
      { label: 'PRs in review', value: '5', sub: '2 stale', delta: null },
    ],
    sales: [
      { label: 'Pipeline', value: '$1.26m', sub: '10 active', delta: '+12%', up: true },
      { label: 'Win rate', value: '34%', sub: 'last 90d', delta: '+4pt', up: true },
      { label: 'Avg cycle', value: '21d', sub: 'qualified→won', delta: '-2d', up: true },
      { label: 'Quota', value: '68%', sub: 'of $1.8m', delta: null },
    ],
    support: [
      { label: 'Open', value: '28', sub: '4 urgent', delta: '+3', up: false },
      { label: 'SLA hit', value: '94%', sub: 'last 7d', delta: '+1pt', up: true },
      { label: 'CSAT', value: '4.7', sub: '142 responses', delta: null },
      { label: 'Avg first reply', value: '12m', sub: 'business hrs', delta: '-3m', up: true },
    ],
    marketing: [
      { label: 'Campaigns', value: '4', sub: '2 launching', delta: null },
      { label: 'Scheduled', value: '15', sub: 'next 30d', delta: '+5', up: true },
      { label: 'Reach', value: '124k', sub: 'this month', delta: '+18%', up: true },
      { label: 'CTR', value: '3.2%', sub: 'avg paid', delta: '+0.4pt', up: true },
    ],
    operations: [
      { label: 'Active runs', value: '6', sub: '0 failed', delta: null },
      { label: 'Compliance', value: '98%', sub: 'controls met', delta: '+2pt', up: true },
      { label: 'Next audit', value: 'Aug 1', sub: '10 days', delta: null },
      { label: 'Avg cycle', value: '4.2d', sub: 'per run', delta: '-0.5d', up: true },
    ],
    generic: [
      { label: 'Open', value: '12', sub: 'tasks', delta: null },
      { label: 'In progress', value: '4', sub: '', delta: null },
      { label: 'Done', value: '8', sub: 'this week', delta: '+3', up: true },
      { label: 'Members', value: members.length, sub: 'active', delta: null },
    ],
  }[projectType.id];

  return (
    <div className="main-inner">
      {/* Project hero */}
      <div className="page-head">
        <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
          <Badge tone={projectType.accent === 'engineering' ? 'accent' : projectType.accent === 'sales' ? 'success' : projectType.accent === 'support' ? 'rose' : projectType.accent === 'marketing' ? 'warning' : 'violet'}>
            <span className="badge-dot" />
            {projectType.label} project
          </Badge>
          <Chip>{v.hierarchy}</Chip>
          {project.ai !== 'off' && <AIChip>AI: {project.ai === 'autopilot' ? 'Autopilot' : project.ai === 'suggest' ? 'Suggest' : 'Ask first'}</AIChip>}
        </div>
        <div className="page-title-row">
          <div className="row gap-5">
            <div className={`proj-icon proj-icon-${projectType.accent}`} style={{ width: 52, height: 52, fontSize: 'var(--fs-xl)', borderRadius: 'var(--r-lg)' }}>{project.icon}</div>
            <div>
              <h1 className="page-title">{project.name}</h1>
              <p className="page-subtitle" style={{ marginTop: 6 }}>Led by {MOCK.userById(project.lead).name} · {members.length} members · due {project.due}</p>
            </div>
          </div>
          <div className="row gap-3">
            <AvatarStack users={members} max={5} />
            <div className="divider-v" style={{ height: 24 }} />
            <Button variant="ai" size="" icon={<I.Sparkle size={13} stroke={2.4} />} onClick={onOpenAIPanel}>Ask AI</Button>
            <Button icon={<I.Comment size={14} />}>Discuss</Button>
            <Button variant="primary" icon={<I.Plus size={14} />} onClick={() => setPage('p-main')}>New {v.item.toLowerCase()}</Button>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--s-9)' }}>
        {kpis.map((k, i) => (
          <div key={i} className="stat">
            <div className="stat-label">{k.label}</div>
            <div className="stat-row">
              <div className="stat-value">{k.value}{k.sub && <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', fontWeight: 500 }}> {k.sub}</span>}</div>
              {k.delta && <span className={`stat-delta stat-delta-${k.up ? 'up' : 'down'}`}>
                {k.up ? <I.ArrowUp size={10} stroke={3} /> : <I.ArrowDown size={10} stroke={3} />}{k.delta}
              </span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-12">
        {/* AI suggestions card */}
        <div className="col-8 col">
          <div className="row between" style={{ marginBottom: 'var(--s-5)' }}>
            <h3 className="h-card">Activity</h3>
            <Button variant="ghost" size="sm" icon={<I.Refresh size={12} />}>Refresh</Button>
          </div>
          <div className="card">
            <div className="col">
              {[
                { icon: <I.Sparkle size={14} />, ai: true, who: 'Drafted a sprint replan', time: '12m ago', body: 'Suggested cutting APL-251 to keep S24 on track.' },
                { icon: <I.Branch size={14} />, who: 'Maya Singh', time: '34m ago', body: 'Opened PR #482 on feat/magic-link → moved APL-241 to In Review.' },
                { icon: <I.Comment size={14} />, who: 'Theo Park', time: '1h ago', body: 'Commented on APL-246: "blocked on legal SSO clearance".' },
                { icon: <I.Check size={14} />, who: 'Maya Singh', time: '2h ago', body: 'Closed APL-252 — Splash skeleton loaders.' },
                { icon: <I.Sparkle size={14} />, ai: true, who: 'Estimated 4 tasks', time: '3h ago', body: 'Effort estimates with 78% confidence for APL-247..250.' },
              ].map((a, i) => (
                <div key={i} className="row gap-4" style={{ padding: 'var(--s-5) var(--s-7)', borderBottom: i === 4 ? 0 : '1px solid var(--divider)' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 'var(--r-md)', flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: a.ai ? 'var(--ai-gradient)' : 'var(--surface-2)',
                    color: a.ai ? 'white' : 'var(--text-muted)',
                  }}>{a.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div className="row gap-3" style={{ marginBottom: 2 }}>
                      <strong style={{ fontSize: 'var(--fs-sm)' }}>{a.who}</strong>
                      {a.ai && <AIChip icon={false}>AI</AIChip>}
                      <span className="muted" style={{ fontSize: 'var(--fs-xs)', marginLeft: 'auto' }}>{a.time}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{a.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="col-4 col gap-5">
          <div className="ai-card">
            <div className="ai-card-body">
              <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
                <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
                <strong>Sprint health</strong>
              </div>
              <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-5)' }}>
                {projectType.id === 'engineering'
                  ? 'Velocity is 22% below trailing avg. Two tasks likely to slip.'
                  : projectType.id === 'sales' ? 'Pipeline coverage is 2.4× target. Two large deals stalled in Proposal.'
                  : projectType.id === 'support' ? '4 tickets approaching SLA breach. 1 recurring issue detected.'
                  : 'Calendar is balanced. Webinar (Jul 15) needs final asset by Mon.'}
              </p>
              <div className="row gap-3">
                <Button variant="ai" size="sm" icon={<I.Wand size={13} />} onClick={onOpenAIPanel}>Open suggestions</Button>
                <Button size="sm" onClick={onOpenAIPanel}>Ask anything</Button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><strong>Upcoming</strong></div>
            <div className="col" style={{ padding: 'var(--s-4) var(--s-6)' }}>
              {[
                { d: '14', m: 'Aug', t: 'Sprint 24 ends', tag: 'milestone' },
                { d: '15', m: 'Aug', t: 'Apollo launch announcement', tag: 'launch' },
                { d: '22', m: 'Aug', t: 'Northwind discovery call', tag: 'meeting' },
              ].map((e, i) => (
                <div key={i} className="row gap-5" style={{ padding: 'var(--s-4) 0', borderBottom: i === 2 ? 0 : '1px solid var(--divider)' }}>
                  <div className="col center" style={{ minWidth: 38, padding: 'var(--s-2) var(--s-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', gap: 0 }}>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{e.m}</div>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{e.d}</div>
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)' }}>{e.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.ProjectHome = ProjectHome;
