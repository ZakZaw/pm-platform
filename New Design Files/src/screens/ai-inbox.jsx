// AI Inbox — feed of suggestion cards. This is the OTHER distinctive moment.

const AIInbox = ({ setPage, onPickProject }) => {
  const [filter, setFilter] = useState('all');
  const [dismissed, setDismissed] = useState({});

  const feed = MOCK.AI_FEED.filter(f =>
    !dismissed[f.id] && (filter === 'all' || f.kind === filter)
  );

  const kindMeta = {
    replan:  { label: 'Sprint health', icon: <I.Refresh size={11} />, tone: 'accent' },
    risk:    { label: 'Risk',          icon: <I.Bolt size={11} />,    tone: 'warning' },
    insight: { label: 'Weekly insight',icon: <I.Trend size={11} />,   tone: 'violet' },
    meeting: { label: 'Meeting',       icon: <I.Mic size={11} />,     tone: 'info' },
  };

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>AI Workspace</div>
            <h1 className="page-title">AI Inbox</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              Suggestions, drafts, and decisions waiting for your call. Everything reversible within 24 hours.
            </p>
          </div>
          <div className="row gap-3">
            <Button variant="ghost" icon={<I.Refresh size={13} />}>Refresh</Button>
            <Button icon={<I.Cog size={13} />}>AI settings</Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="row gap-3" style={{ marginBottom: 'var(--s-6)' }}>
        <Segmented
          value={filter} onChange={setFilter}
          options={[
            { value: 'all', label: 'All · ' + MOCK.AI_FEED.length },
            { value: 'replan', label: 'Sprint health' },
            { value: 'risk', label: 'Risk' },
            { value: 'insight', label: 'Insights' },
            { value: 'meeting', label: 'Meetings' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Across {new Set(MOCK.AI_FEED.map(f=>f.project)).size} projects</span>
      </div>

      <div className="col gap-5">
        {feed.map(item => {
          const proj = MOCK.projectById(item.project);
          const pt = MOCK.PROJECT_TYPES[proj.type];
          const meta = kindMeta[item.kind];
          return (
            <div key={item.id} className="ai-card">
              <div className="ai-card-head" style={{ borderBottom: 0, paddingBottom: 0 }}>
                <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
                <div className="col" style={{ gap: 4, flex: 1 }}>
                  <div className="row gap-3">
                    <Badge tone={meta.tone}><span>{meta.icon}</span><span>{meta.label}</span></Badge>
                    <Badge>{pt.label} · {proj.name.split(' — ')[0]}</Badge>
                    {item.urgency === 'high' && <Badge tone="danger" dot>Needs attention</Badge>}
                    <span className="muted" style={{ fontSize: 'var(--fs-xs)', marginLeft: 'auto' }}>{item.when}</span>
                  </div>
                </div>
              </div>

              <div className="ai-card-body" style={{ paddingTop: 'var(--s-4)' }}>
                <h3 className="h-card" style={{ marginBottom: 'var(--s-3)' }}>{item.title}</h3>
                <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--s-6)', maxWidth: 720 }}>
                  {item.body}
                </p>

                <div className="row gap-3" style={{ flexWrap: 'wrap', marginBottom: 'var(--s-5)' }}>
                  {item.suggestions.map((s, i) => (
                    <Button key={i} variant={s.primary ? 'ai' : ''} size="sm">
                      {s.primary && <I.Sparkle size={11} stroke={2.4} />}
                      {s.label}
                    </Button>
                  ))}
                </div>

                <div className="row between" style={{ paddingTop: 'var(--s-5)', borderTop: '1px solid var(--ai-border)' }}>
                  <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    <I.Sparkle size={10} stroke={2.4} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                    {item.reason}
                  </span>
                  <div className="row gap-3">
                    <Button variant="ghost" size="sm" onClick={() => onPickProject(item.project)}>Open project</Button>
                    <Button variant="ghost" size="sm" onClick={() => setDismissed({ ...dismissed, [item.id]: true })}>Dismiss</Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {feed.length === 0 && (
          <div className="card" style={{ padding: 'var(--s-11)', textAlign: 'center' }}>
            <div className="ai-mark" style={{ width: 48, height: 48, margin: '0 auto var(--s-5)' }}><I.Sparkle size={20} stroke={2.4} /></div>
            <strong style={{ fontSize: 'var(--fs-lg)' }}>Inbox zero</strong>
            <div className="muted" style={{ marginTop: 6 }}>All suggestions handled. AI keeps watch in the background.</div>
          </div>
        )}
      </div>
    </div>
  );
};

window.AIInbox = AIInbox;
