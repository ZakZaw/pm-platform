// App Shell — sidebar adapts to active project type.

const Shell = ({
  org, project, projectType,
  page, setPage,
  projects, onSwitchProject,
  onOpenAIWizard,
  theme, setTheme,
  aiCount,
}) => {
  // Build the navigation. Some items are shared org-level, others swap based on project type.
  const orgNav = [
    { id: 'home',      label: 'Org Home',       icon: <I.Home /> },
    { id: 'roadmap',   label: 'Portfolio Roadmap', icon: <I.Map /> },
    { id: 'dashboard', label: 'Dashboard',      icon: <I.Chart /> },
    { id: 'inbox',     label: 'AI Inbox',       icon: <I.Sparkle />, aiPulse: aiCount > 0, count: aiCount },
    { id: 'my-work',   label: 'My Work',        icon: <I.Check /> },
    { id: 'messages',  label: 'Messages',       icon: <I.Comment /> },
    { id: 'meetings',  label: 'Meetings',       icon: <I.Video /> },
  ];

  const v = projectType?.vocab;
  const projectNav = project && projectType ? [
    { id: 'p-home',   label: 'Overview',        icon: <I.Folder /> },
    { id: 'p-main',   label: v.board,           icon: projectType.id === 'sales' ? <I.Sales /> :
                                                       projectType.id === 'support' ? <I.Support /> :
                                                       projectType.id === 'marketing' ? <I.Calendar /> :
                                                       projectType.id === 'operations' ? <I.Ops /> :
                                                       <I.Layers /> },
    ...(projectType.id === 'engineering' ? [{ id: 'p-epics', label: 'Epics', icon: <I.Box /> }] : []),
    { id: 'p-list',   label: v.items,           icon: <I.Generic /> },
    ...(projectType.id === 'engineering' ? [{ id: 'p-backlog', label: 'Backlog', icon: <I.Layers /> }] : []),
    ...(projectType.id === 'engineering' ? [{ id: 'p-burn', label: 'Burndown', icon: <I.TrendDown /> }] : []),
    ...(projectType.id === 'sales' ? [{ id: 'p-forecast', label: 'Forecast', icon: <I.Trend /> }] : []),
    ...(projectType.id === 'support' ? [{ id: 'p-sla', label: 'SLA timers', icon: <I.Clock /> }] : []),
    ...(projectType.id === 'marketing' ? [{ id: 'p-channels', label: 'Channel mix', icon: <I.Hash /> }] : []),
    { id: 'p-people', label: 'People',         icon: <I.Users /> },
    { id: 'p-settings', label: 'Project settings', icon: <I.Cog /> },
  ] : [];

  return (
    <aside className="sidebar">
      {/* Org header */}
      <div className="sidebar-org">
        <div className="sidebar-logo"><span>{org.logo}</span></div>
        <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <div className="sidebar-org-name truncate">{org.name}</div>
          <div className="sidebar-org-slug truncate">{'/' + org.slug}</div>
        </div>
        <button className="btn btn-ghost btn-icon-sm" aria-label="Switch org"><I.ChevronDown size={14} /></button>
      </div>

      <div className="sidebar-scroll">

        {/* New project AI button */}
        <div className="sidebar-section">
          <button className="btn btn-ai btn-block" onClick={onOpenAIWizard} style={{ height: 36 }}>
            <I.Sparkle size={14} stroke={2.4} />
            <span>New project with AI</span>
            <span className="kbd" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.18)', borderColor: 'transparent', color: 'white' }}>⌘N</span>
          </button>
        </div>

        {/* Org-level nav */}
        <div className="sidebar-section">
          <div className="sidebar-label">Workspace</div>
          {orgNav.map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'is-active' : ''}`} onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {n.aiPulse && <span className="ai-pulse" />}
              {n.count != null && !n.aiPulse && <span className="nav-count">{n.count}</span>}
            </button>
          ))}
        </div>

        {/* Active project */}
        {project && (
          <>
            <div className="sidebar-section" style={{ marginTop: 'var(--s-5)' }}>
              <div className="sidebar-label">
                <span>Active Project</span>
                <button className="btn btn-ghost btn-icon-sm" onClick={() => setPage('home')} title="All projects"><I.Generic size={12} /></button>
              </div>
            </div>
            <div className="proj-card" onClick={() => setPage('p-home')}>
              <div className={`proj-icon proj-icon-${projectType.accent}`}>{project.icon}</div>
              <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
                <div className="proj-card-name truncate">{project.name.split(' — ')[0]}</div>
                <div className="proj-card-type">{projectType.label}</div>
              </div>
            </div>
            <div className="sidebar-section">
              {projectNav.map(n => (
                <button key={n.id} className={`nav-item ${page === n.id ? 'is-active' : ''}`} onClick={() => setPage(n.id)}>
                  <span className="nav-icon">{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              ))}
            </div>

            {/* Other projects switcher */}
            <div className="sidebar-section">
              <div className="sidebar-label">
                <span>Other Projects</span>
              </div>
              {projects.filter(p => p.id !== project.id).slice(0, 4).map(p => {
                const pt = MOCK.PROJECT_TYPES[p.type];
                return (
                  <button key={p.id} className="nav-item" onClick={() => onSwitchProject(p.id)}>
                    <div className={`proj-icon proj-icon-${pt.accent}`} style={{ width: 18, height: 18, fontSize: 9, borderRadius: 4 }}>{p.icon}</div>
                    <span className="truncate">{p.name.split(' — ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-foot">
        <Avatar user={MOCK.userById('u1')} size="md" />
        <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <div className="sidebar-foot-name truncate">Aria Chen</div>
          <div className="sidebar-foot-mail truncate">aria@lattice.co</div>
        </div>
        <button className="btn btn-ghost btn-icon-sm" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle theme">
          {theme === 'light' ? <I.Moon size={14} /> : <I.Sun size={14} />}
        </button>
      </div>
    </aside>
  );
};

const Topbar = ({ org, project, projectType, page, setPage, onOpenAIWizard, onAskAI }) => {
  // Build breadcrumbs from page + project context.
  const crumbs = [];
  crumbs.push({ label: org.name, onClick: () => setPage('home') });
  if (page === 'home') crumbs.push({ label: 'Projects', current: true });
  else if (page === 'roadmap') crumbs.push({ label: 'Portfolio Roadmap', current: true });
  else if (page === 'dashboard') crumbs.push({ label: 'Dashboard', current: true });
  else if (page === 'inbox') crumbs.push({ label: 'AI Inbox', current: true });
  else if (page === 'my-work') crumbs.push({ label: 'My Work', current: true });
  else if (page === 'settings') crumbs.push({ label: 'Settings', current: true });
  else if (page === 'design-system') crumbs.push({ label: 'Design system', current: true });
  else if (page === 'messages') crumbs.push({ label: 'Messages', current: true });
  else if (page === 'meetings') crumbs.push({ label: 'Meetings', current: true });
  else if (page === 'meeting-room') {
    crumbs.push({ label: 'Meetings', onClick: () => setPage('meetings') });
    crumbs.push({ label: 'In meeting', current: true });
  }
  else if (page.startsWith('p-') && project) {
    crumbs.push({ label: project.name, onClick: () => setPage('p-home') });
    const v = projectType.vocab;
    const labels = {
      'p-home': 'Overview',
      'p-main': v.board,
      'p-list': v.items,
      'p-epics': 'Epics',
      'p-backlog': 'Backlog',
      'p-burn': 'Burndown',
      'p-forecast': 'Forecast',
      'p-sla': 'SLA timers',
      'p-channels': 'Channel mix',
      'p-people': 'People',
      'p-ai': 'Project AI',
      'p-settings': 'Project settings',
    };
    if (page !== 'p-home') crumbs.push({ label: labels[page] || page, current: true });
    else crumbs[crumbs.length - 1].current = true;
  }

  return (
    <header className="topbar">
      <nav className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="crumbs-sep">/</span>}
            {c.current
              ? <strong>{c.label}</strong>
              : <button className="btn-ghost" style={{ color: 'inherit', cursor: 'pointer', padding: 0 }} onClick={c.onClick}>{c.label}</button>}
          </React.Fragment>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <button className="search">
        <I.Search size={14} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search projects, tasks, people…</span>
        <span className="kbd">⌘K</span>
      </button>

      <button className="btn btn-ghost btn-icon" title="Notifications"><I.Bell size={16} /></button>
      <button className="btn btn-ai btn-sm" onClick={onAskAI || onOpenAIWizard}>
        <I.Sparkle size={13} stroke={2.4} />
        <span>Ask AI</span>
      </button>
    </header>
  );
};

Object.assign(window, { Shell, Topbar });
