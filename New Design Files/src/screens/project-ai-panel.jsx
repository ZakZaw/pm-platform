// Project AI Panel — slide-in drawer for project-scoped AI conversations.
// Shows AI capabilities, recent decisions, and a chat interface scoped to the project.

const ProjectAIPanel = ({ open, onClose, project, projectType }) => {
  const [input, setInput] = useState('');
  const [thread, setThread] = useState([
    {
      role: 'ai', t: 'Just now',
      body: `I'm watching ${project.name.split(' — ')[0]}. Currently tracking ${
        projectType.id === 'engineering' ? '12 tasks across 4 epics in Sprint 24'
        : projectType.id === 'sales' ? '10 deals worth $1.26m'
        : projectType.id === 'support' ? '8 open tickets · 4 within SLA risk'
        : projectType.id === 'marketing' ? '15 assets scheduled · 4 campaigns'
        : 'this project'
      }. Ask me anything, or try a suggestion below.`,
    },
  ]);

  const suggestedAsks = {
    engineering: [
      { label: 'Is Sprint 24 on track?', icon: <I.Trend size={11} /> },
      { label: 'Who is overloaded this week?', icon: <I.Users size={11} /> },
      { label: 'Draft a sprint replan', icon: <I.Refresh size={11} /> },
      { label: 'Summarize blockers', icon: <I.Bolt size={11} /> },
    ],
    sales: [
      { label: 'Which deals are at risk?', icon: <I.TrendDown size={11} /> },
      { label: 'Forecast Q3 close', icon: <I.Trend size={11} /> },
      { label: 'Draft check-in for stalled deals', icon: <I.Mail size={11} /> },
      { label: 'Top 3 actions to close more', icon: <I.Bolt size={11} /> },
    ],
    support: [
      { label: 'What\'s breaching SLA?', icon: <I.Clock size={11} /> },
      { label: 'Find recurring issues', icon: <I.Refresh size={11} /> },
      { label: 'Weekly summary for #leads', icon: <I.Mail size={11} /> },
      { label: 'CSAT breakdown', icon: <I.Trend size={11} /> },
    ],
    marketing: [
      { label: 'Draft next week\'s content', icon: <I.Edit size={11} /> },
      { label: 'Which channel is underperforming?', icon: <I.TrendDown size={11} /> },
      { label: 'Repurpose top blog into 5 tweets', icon: <I.Refresh size={11} /> },
      { label: 'Summarize campaign performance', icon: <I.Trend size={11} /> },
    ],
    operations: [
      { label: 'Which runs are overdue?', icon: <I.Clock size={11} /> },
      { label: 'Draft new SOP from recent runs', icon: <I.Edit size={11} /> },
      { label: 'Compliance gap analysis', icon: <I.Lock size={11} /> },
      { label: 'Schedule recurring runs', icon: <I.Refresh size={11} /> },
    ],
    generic: [
      { label: 'Summarize this week', icon: <I.Trend size={11} /> },
      { label: 'Who needs help?', icon: <I.Users size={11} /> },
      { label: 'Draft a status update', icon: <I.Edit size={11} /> },
    ],
  }[projectType.id] || [];

  const recentDecisions = [
    { t: '2h ago', body: 'Estimated 4 tasks in epic "Notification center" (78% conf)', applied: true },
    { t: '5h ago', body: 'Drafted check-in email for Cobalt Logistics deal', applied: false },
    { t: 'Yesterday', body: 'Replanned Sprint 24 — moved APL-251 to Sprint 25', applied: true },
  ];

  const send = (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', t: 'Just now', body: text };
    setInput('');
    setThread([...thread, userMsg, { role: 'ai', t: 'Just now', body: '...', loading: true }]);
    setTimeout(() => {
      setThread(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'ai', t: 'Just now',
          body: `Looking at ${project.name.split(' — ')[0]}: I'd start by reviewing the burndown — Sprint 24 is 22% below trailing average. Two tasks (APL-246, APL-251) are at risk of slipping. Want me to draft a replan?`,
          suggestions: ['Draft replan', 'Show burndown', 'Talk to Noor about APL-246'],
        };
        return next;
      });
    }, 800);
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-scrim" onClick={onClose} style={{ zIndex: 800, background: 'hsl(220 25% 12% / 0.25)' }} />
      <aside className="drawer" style={{ width: 480 }}>
        {/* Header — iridescent */}
        <div style={{
          padding: 'var(--s-6) var(--s-7)',
          background: 'var(--ai-gradient-soft)',
          borderBottom: '1px solid var(--ai-border)',
          display: 'flex', alignItems: 'center', gap: 'var(--s-4)',
        }}>
          <div className="ai-mark" style={{ width: 36, height: 36, borderRadius: 'var(--r-md)' }}><I.Sparkle size={16} stroke={2.4} /></div>
          <div className="col" style={{ gap: 2, flex: 1 }}>
            <strong style={{ fontSize: 'var(--fs-md)' }}>Project AI</strong>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ai-text)' }}>
              Scoped to {project.name.split(' — ')[0]} · {projectType.label}
            </span>
          </div>
          <Badge tone="ai">{project.ai === 'autopilot' ? 'Autopilot' : project.ai === 'suggest' ? 'Suggest' : project.ai === 'ask' ? 'Ask first' : 'Off'}</Badge>
          <button className="btn btn-ghost btn-icon-sm" onClick={onClose}><I.X size={14} /></button>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-6) var(--s-7)' }}>
          <div className="col gap-6">
            {thread.map((m, i) => (
              <div key={i} className="row gap-4" style={{ alignItems: 'flex-start' }}>
                {m.role === 'ai'
                  ? <div className="ai-mark" style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', flexShrink: 0 }}><I.Sparkle size={12} stroke={2.4} /></div>
                  : <Avatar user={MOCK.userById('u1')} size="md" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-3" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>{m.role === 'ai' ? 'Project AI' : 'You'}</strong>
                    <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{m.t}</span>
                  </div>
                  <div style={{
                    padding: 'var(--s-4) var(--s-5)',
                    borderRadius: 'var(--r-md)',
                    background: m.role === 'ai' ? 'var(--ai-gradient-soft)' : 'var(--surface-2)',
                    border: m.role === 'ai' ? '1px solid var(--ai-border)' : '1px solid var(--border-subtle)',
                    color: m.role === 'ai' ? 'var(--ai-text)' : 'var(--text)',
                    fontSize: 'var(--fs-sm)', lineHeight: 1.55,
                  }}>
                    {m.loading ? <TypingDots /> : m.body}
                  </div>
                  {m.suggestions && (
                    <div className="row gap-3" style={{ marginTop: 'var(--s-4)', flexWrap: 'wrap' }}>
                      {m.suggestions.map((s, j) => (
                        <button key={j} className="btn btn-sm" onClick={() => send(s)}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Suggested asks (shown above first user turn) */}
          {thread.length === 1 && (
            <div style={{ marginTop: 'var(--s-7)' }}>
              <div className="eyebrow" style={{ marginBottom: 'var(--s-4)' }}>Try asking</div>
              <div className="col gap-2">
                {suggestedAsks.map((s, i) => (
                  <button key={i} className="card card-hover" onClick={() => send(s.label)}
                    style={{ padding: 'var(--s-4) var(--s-5)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 'var(--s-4)', width: '100%', cursor: 'pointer' }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 'var(--r-sm)',
                      background: 'var(--ai-gradient-soft)',
                      color: 'var(--ai-text)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{s.icon}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', flex: 1 }}>{s.label}</span>
                    <I.Arrow size={12} style={{ color: 'var(--text-subtle)' }} />
                  </button>
                ))}
              </div>

              <div className="eyebrow" style={{ marginTop: 'var(--s-7)', marginBottom: 'var(--s-4)' }}>Recent AI activity</div>
              <div className="col gap-2">
                {recentDecisions.map((d, i) => (
                  <div key={i} style={{ padding: 'var(--s-4) var(--s-5)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
                    <div className="row gap-3" style={{ marginBottom: 2 }}>
                      <I.Sparkle size={11} stroke={2.4} style={{ color: 'var(--ai-text)' }} />
                      <span style={{ fontSize: 'var(--fs-sm)' }}>{d.body}</span>
                      {d.applied && <Badge tone="success" dot>Applied</Badge>}
                    </div>
                    <div className="muted" style={{ fontSize: 'var(--fs-xs)', paddingLeft: 'var(--s-7)' }}>{d.t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: 'var(--s-5) var(--s-7)', borderTop: '1px solid var(--divider)' }}>
          <div className="row gap-3" style={{
            padding: 'var(--s-3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface)',
          }}>
            <input
              className="input"
              placeholder={`Ask anything about ${project.name.split(' — ')[0]}…`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              style={{ border: 0, height: 28, padding: '0 var(--s-3)', background: 'transparent' }}
              autoFocus
            />
            <button className="btn btn-ghost btn-icon-sm" title="Attach"><I.Attach size={12} /></button>
            <button className="btn btn-ai btn-icon-sm" onClick={() => send(input)} disabled={!input.trim()}>
              <I.Send size={11} />
            </button>
          </div>
          <div className="row between" style={{ marginTop: 'var(--s-3)' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-2xs)' }}>
              <I.Lock size={9} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              Reversible within 24h · scoped to this project
            </span>
            <span className="muted" style={{ fontSize: 'var(--fs-2xs)' }}><span className="kbd">↵</span> send</span>
          </div>
        </div>
      </aside>
    </>
  );
};

const TypingDots = () => (
  <span className="row gap-2" style={{ alignItems: 'center', height: 18 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width: 5, height: 5, borderRadius: 999,
        background: 'currentColor', opacity: 0.6,
        animation: `typing-dot 1.2s ${i * 0.16}s ease-in-out infinite`,
      }} />
    ))}
    <style>{`@keyframes typing-dot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.3; } 30% { transform: translateY(-3px); opacity: 1; } }`}</style>
  </span>
);

window.ProjectAIPanel = ProjectAIPanel;
