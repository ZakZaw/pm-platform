// Main App — handles routing between screens, drawer state, project selection.

const App = () => {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "density": "comfortable",
    "ai_intensity": "confident"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply theme + density at root
  useEffect(() => {
    document.documentElement.dataset.theme = t.theme;
    document.documentElement.dataset.density = t.density === 'comfortable' ? '' : t.density;
    document.documentElement.dataset.aiIntensity = t.ai_intensity;
  }, [t]);

  const org = MOCK.ORGS[0];

  // Read initial state from URL hash (used by the canvas index to deep-link)
  // Format: #screen=...&project=...&drawer=...&wizard=1
  const parseHash = () => {
    const h = window.location.hash.slice(1);
    if (!h) return {};
    return Object.fromEntries(new URLSearchParams(h));
  };
  const initial = parseHash();

  const [projectId, setProjectId] = useState(initial.project || 'p_apollo');
  const project = MOCK.projectById(projectId) || MOCK.PROJECTS[0];
  const projectType = MOCK.PROJECT_TYPES[project.type];

  // Page state
  const [page, setPage] = useState(initial.screen || 'home');
  const [drawerItem, setDrawerItem] = useState(initial.drawer || null);
  const [wizardOpen, setWizardOpen] = useState(initial.wizard === '1');
  const [aiPanelOpen, setAIPanelOpen] = useState(initial.ai === '1');

  // When the user picks a project, route to its home + load it
  const onPickProject = (id) => {
    setProjectId(id);
    setPage('p-main');  // jump straight to the main view (showcase the type-specific UI)
  };
  const onSwitchProject = (id) => {
    setProjectId(id);
    setPage('p-main');
  };
  const onOpenItem = (itemId) => setDrawerItem(itemId);

  // Decide which screen to render
  const main = (() => {
    if (page === 'home')      return <OrgHome projects={MOCK.PROJECTS} onPickProject={onPickProject} onOpenAIWizard={() => setWizardOpen(true)} />;
    if (page === 'roadmap')   return <Roadmap />;
    if (page === 'dashboard') return <Dashboard />;
    if (page === 'inbox')     return <AIInbox setPage={setPage} onPickProject={onPickProject} />;
    if (page === 'my-work')   return <MyWork setPage={setPage} onPickProject={onPickProject} onOpenItem={onOpenItem} />;
    if (page === 'messages')  return <Messages />;
    if (page === 'meetings')  return <Meetings setPage={setPage} />;
    if (page === 'meeting-room') return <MeetingRoom />;
    if (page === 'settings' || page === 'p-settings') return <Settings project={project} projectType={projectType} />;
    if (page === 'design-system') return <DesignSystem />;
    if (page === 'p-home')    return <ProjectHome project={project} projectType={projectType} setPage={setPage} onOpenItem={onOpenItem} onOpenAIPanel={() => setAIPanelOpen(true)} />;
    if (page === 'p-epics')   return <Epics project={project} onOpenItem={onOpenItem} setPage={setPage} />;
    if (page === 'p-main') {
      if (projectType.id === 'engineering') return <SprintKanban project={project} onOpenItem={onOpenItem} />;
      if (projectType.id === 'sales')       return <SalesPipeline project={project} onOpenItem={onOpenItem} />;
      if (projectType.id === 'support')     return <SupportQueue project={project} onOpenItem={onOpenItem} />;
      if (projectType.id === 'marketing')   return <MarketingCalendar project={project} onOpenItem={onOpenItem} />;
      if (projectType.id === 'operations')  return <OperationsRunbook project={project} onOpenItem={onOpenItem} />;
      return <GenericBoard project={project} />;
    }
    // Other project sub-pages fallback to home
    if (page.startsWith('p-')) return <ProjectHome project={project} projectType={projectType} setPage={setPage} onOpenItem={onOpenItem} />;
    return <OrgHome projects={MOCK.PROJECTS} onPickProject={onPickProject} onOpenAIWizard={() => setWizardOpen(true)} />;
  })();

  return (
    <div className="app">
      <Shell
        org={org}
        project={project}
        projectType={projectType}
        page={page}
        setPage={setPage}
        projects={MOCK.PROJECTS}
        onSwitchProject={onSwitchProject}
        onOpenAIWizard={() => setWizardOpen(true)}
        theme={t.theme}
        setTheme={(theme) => setTweak('theme', theme)}
        aiCount={MOCK.AI_FEED.length}
      />
      <Topbar
        org={org} project={project} projectType={projectType}
        page={page} setPage={setPage}
        onOpenAIWizard={() => setWizardOpen(true)}
        onAskAI={() => setAIPanelOpen(true)}
      />
      <main className="main">
        {main}
      </main>

      <WorkItemDrawer
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        project={project}
        projectType={projectType}
        itemId={drawerItem}
      />
      <ProjectAIPanel
        open={aiPanelOpen}
        onClose={() => setAIPanelOpen(false)}
        project={project}
        projectType={projectType}
      />
      <AIWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(type) => {
          setWizardOpen(false);
          // Find a project of that type to demo
          const target = MOCK.PROJECTS.find(p => p.type === type) || MOCK.PROJECTS[0];
          onPickProject(target.id);
        }}
      />

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Appearance">
          <TweakRadio
            label="Theme"
            value={t.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <TweakRadio
            label="Density"
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Balanced' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Project type">
          <TweakSelect
            label="Active project"
            value={projectId}
            onChange={(v) => onSwitchProject(v)}
            options={MOCK.PROJECTS.map(p => ({ value: p.id, label: `${MOCK.PROJECT_TYPES[p.type].label} · ${p.name.split(' — ')[0]}` }))}
          />
        </TweakSection>
        <TweakSection title="Jump to screen">
          <TweakSelect
            label="Screen"
            value={page}
            onChange={setPage}
            options={[
              { value: 'home', label: 'Org Home / Project picker' },
              { value: 'p-main', label: 'Project main view (type-specific)' },
              { value: 'p-home', label: 'Project home' },
              { value: 'p-epics', label: 'Epics (engineering only)' },
              { value: 'inbox', label: 'AI Inbox' },
              { value: 'roadmap', label: 'Portfolio Roadmap' },
              { value: 'dashboard', label: 'Org Dashboard' },
              { value: 'my-work', label: 'My Work' },
              { value: 'messages', label: 'Messages' },
              { value: 'meetings', label: 'Meetings list' },
              { value: 'meeting-room', label: 'Meeting room (live)' },
              { value: 'settings', label: 'Settings' },
              { value: 'design-system', label: 'Design system spec' },
            ]}
          />
          <TweakButton onClick={() => setWizardOpen(true)}>Open AI project wizard</TweakButton>
          <TweakButton onClick={() => setAIPanelOpen(true)}>Open project AI panel</TweakButton>
          <TweakButton onClick={() => onOpenItem(projectType.id === 'engineering' ? 'APL-241' : projectType.id === 'sales' ? 'D-122' : projectType.id === 'support' ? 'T-1426' : 'asset')}>
            Open work-item drawer
          </TweakButton>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
