/* app.jsx — Main artifact shell with left nav + section router */

const SECTIONS = [
  { id: "tokens",     label: "Design tokens",   group: "Foundations", num: "01" },
  { id: "components", label: "Components",      group: "Foundations", num: "02" },
  { id: "shell",      label: "App shell",       group: "Screens",     num: "03" },
  { id: "kanban",     label: "Kanban board",    group: "Screens",     num: "04" },
  { id: "task",       label: "Task detail",     group: "Screens",     num: "05" },
  { id: "ai_wizard",  label: "AI wizard",       group: "Screens",     num: "06" },
  { id: "ai_suggest", label: "AI suggestion",   group: "Screens",     num: "07" },
  { id: "roadmap",    label: "Roadmap",         group: "Screens",     num: "08" },
  { id: "meeting",    label: "Meeting room",    group: "Screens",     num: "09" },
  { id: "dashboard",  label: "Dashboard",       group: "Screens",     num: "10" },
  { id: "chat",       label: "Chat channel",    group: "Screens",     num: "11" },
];

const RENDERERS = {
  tokens:     () => <SectionTokens />,
  components: () => <SectionComponents />,
  shell:      () => <ScreenShell />,
  kanban:     () => <ScreenKanban />,
  task:       () => <ScreenTask />,
  ai_wizard:  () => <ScreenAIWizard />,
  ai_suggest: () => <ScreenAISuggest />,
  roadmap:    () => <ScreenRoadmap />,
  meeting:    () => <ScreenMeeting />,
  dashboard:  () => <ScreenDashboard />,
  chat:       () => <ScreenChat />,
};

function App() {
  const [active, setActive] = React.useState(() => {
    const h = (location.hash || "").replace("#", "");
    return SECTIONS.some(s => s.id === h) ? h : "tokens";
  });
  const [theme, setTheme] = React.useState("dark");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  React.useEffect(() => {
    location.hash = active;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [active]);

  const current = SECTIONS.find(s => s.id === active) || SECTIONS[0];
  const Renderer = RENDERERS[active] || (() => <div>Coming soon…</div>);

  const groups = [...new Set(SECTIONS.map(s => s.group))];

  return (
    <div className="frame">
      <aside className="frame-nav">
        <div className="brand">
          <div className="brand-logo" />
          <div className="vstack" style={{lineHeight:1.1}}>
            <span className="brand-name">Stratos</span>
            <span style={{fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)"}}>DS · v0.4</span>
          </div>
        </div>

        {groups.map(g => (
          <div key={g}>
            <div className="nav-section">{g}</div>
            {SECTIONS.filter(s => s.group === g).map(s => (
              <div
                key={s.id}
                className={`nav-item ${s.id === active ? "active" : ""}`}
                onClick={() => setActive(s.id)}
              >
                <Icon name={s.id === active ? "square-dot" : "square"} size={12} color="var(--text-muted)"/>
                <span>{s.label}</span>
                <span className="nav-num">{s.num}</span>
              </div>
            ))}
          </div>
        ))}

        <div style={{marginTop:"var(--space-6)", padding:"var(--space-3)", fontSize:11, color:"var(--text-muted)", borderTop:"1px solid var(--border-subtle)"}}>
          <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:6}}>
            <Icon name="info" size={11}/>
            <span>Use ↑↓ in left nav to navigate.</span>
          </div>
          <div style={{fontFamily:"var(--font-mono)"}}>11 sections · 38 components</div>
        </div>
      </aside>

      <main className="frame-main">
        <div className="frame-header">
          <div>
            <div className="frame-kicker">{current.group} · {current.num}</div>
            <h1 className="frame-title">{current.label}</h1>
            <div className="frame-subtitle">{SECTION_BLURBS[active]}</div>
          </div>
          <div className="hstack" style={{gap:"var(--space-3)"}}>
            <a
              href="board.html"
              style={{
                display:"inline-flex", alignItems:"center", gap:6,
                padding:"6px 12px",
                background:"var(--bg-surface-1)",
                border:"1px solid var(--border-default)",
                borderRadius:"var(--radius-pill)",
                fontSize:12, fontWeight:500,
                color:"var(--text-primary)",
                textDecoration:"none",
              }}
            >
              <Icon name="layout-dashboard" size={12}/> Board view
              <Icon name="arrow-up-right" size={11} color="var(--text-muted)"/>
            </a>
            <div className="theme-toggle">
              <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
                <Icon name="moon" size={11}/> Dark
              </button>
              <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
                <Icon name="sun" size={11}/> Light
              </button>
            </div>
          </div>
        </div>

        <Renderer />

        <div style={{height:"var(--space-12)"}} />
      </main>
    </div>
  );
}

const SECTION_BLURBS = {
  tokens:     "The atomic vocabulary — color, type, spacing, radius, elevation. Everything else is composed from these.",
  components: "Building blocks of the product UI. Every interactive state is rendered explicitly so engineering can match it.",
  shell:      "The persistent chrome — sidebar, top bar, content area. Collapsible to give power users more room.",
  kanban:     "Active sprint at a glance. Five status columns, dense cards, sprint goal banner with burndown sparkline.",
  task:       "Right-side drawer for editing the full task: status, metadata, description, criteria, activity, comments.",
  ai_wizard:  "Plain-English project intake. Three steps from prompt to confirmed epic/story/task tree.",
  ai_suggest: "The reusable AI insight card. Gradient border, sparkle mark, three actions, undo timer variant.",
  roadmap:    "Quarterly timeline with epic bars, milestone diamonds, dependencies, today line.",
  meeting:    "Live video call with speaker-labeled transcript and AI-drafted action items.",
  dashboard:  "Health-at-a-glance project surface: burndown, velocity, workload, AI weekly insight.",
  chat:       "Project channel with threads, embedded task previews, AI digest bot.",
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
