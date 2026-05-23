// AI Wizard — pick a project type, then describe.
// This is one of the two "distinctive moments" — type-aware AI generation.

const AIWizard = ({ open, onClose, onCreate }) => {
  const [step, setStep] = useState(0); // 0 describe, 1 pick type (AI suggests), 2 review
  const [desc, setDesc] = useState('');
  const [type, setType] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [suggestedType, setSuggestedType] = useState(null);

  useEffect(() => {
    if (!open) { setStep(0); setDesc(''); setType(null); setSuggestedType(null); }
  }, [open]);

  const examples = [
    { desc: 'Ship a passwordless auth rewrite in 2 sprints', type: 'engineering' },
    { desc: 'Q3 outbound to mid-market fintech in NY/Boston', type: 'sales' },
    { desc: 'Spring brand refresh — blog, social, paid', type: 'marketing' },
    { desc: 'Customer support for our new mobile launch', type: 'support' },
  ];

  const goAnalyze = () => {
    setStep(1);
    setThinking(true);
    // Naive keyword heuristic mock
    setTimeout(() => {
      const d = desc.toLowerCase();
      let guess = 'generic';
      if (/sprint|epic|ship|api|backend|frontend|auth|deploy|rewrite|migrate|feature/.test(d)) guess = 'engineering';
      else if (/sales|outbound|deal|pipeline|prospect|account|quota|crm|revenue/.test(d)) guess = 'sales';
      else if (/support|ticket|customer success|sla|helpdesk|complaint/.test(d)) guess = 'support';
      else if (/campaign|brand|content|blog|social|email|launch|marketing|seo/.test(d)) guess = 'marketing';
      else if (/runbook|sop|workflow|checklist|operations|audit|compliance/.test(d)) guess = 'operations';
      setSuggestedType(guess);
      setType(guess);
      setThinking(false);
    }, 1100);
  };

  if (!open) return null;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 820, height: 'min(660px, 92vh)' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: 0, paddingBottom: 0 }}>
          <div className="row gap-4">
            <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
            <div className="col" style={{ gap: 2 }}>
              <strong style={{ fontSize: 'var(--fs-lg)' }}>New project with AI</strong>
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Describe it once · AI picks the type · scaffolds the work</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><I.X size={16} /></button>
        </div>

        {/* Stepper */}
        <div className="row gap-3" style={{ padding: '0 var(--s-7) var(--s-5)' }}>
          {[
            { id: 0, label: 'Describe' },
            { id: 1, label: 'Type & shape' },
            { id: 2, label: 'Review' },
          ].map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="row gap-3" style={{
                fontSize: 'var(--fs-sm)', fontWeight: 500,
                color: step >= s.id ? 'var(--text)' : 'var(--text-muted)',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: step > s.id ? 'var(--accent)' : step === s.id ? 'var(--ai-gradient)' : 'var(--surface-2)',
                  color: step >= s.id ? 'white' : 'var(--text-muted)',
                  fontSize: 'var(--fs-xs)', fontWeight: 600,
                }}>
                  {step > s.id ? <I.Check size={11} stroke={3} /> : s.id + 1}
                </div>
                <span>{s.label}</span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />}
            </React.Fragment>
          ))}
        </div>

        <div className="modal-body" style={{ flex: 1, minHeight: 0 }}>
          {step === 0 && (
            <div>
              <label className="label">What are you trying to accomplish?</label>
              <textarea className="textarea" style={{ minHeight: 120, fontSize: 'var(--fs-md)' }}
                placeholder="e.g. Launch passwordless auth across web + iOS in 6 weeks. Two engineers, one designer."
                value={desc} onChange={e => setDesc(e.target.value)} autoFocus />
              <div style={{ marginTop: 'var(--s-7)' }}>
                <div className="eyebrow" style={{ marginBottom: 'var(--s-4)' }}>Try one</div>
                <div className="col gap-2">
                  {examples.map((ex, i) => (
                    <button key={i} className="card" style={{ padding: 'var(--s-4) var(--s-5)', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setDesc(ex.desc)}>
                      <div className="row gap-4 between">
                        <span style={{ fontSize: 'var(--fs-md)' }}>{ex.desc}</span>
                        <Badge tone={ex.type === 'engineering' ? 'accent' : ex.type === 'sales' ? 'success' : ex.type === 'marketing' ? 'warning' : 'rose'}>
                          {MOCK.PROJECT_TYPES[ex.type].label}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              {thinking ? (
                <div className="col center" style={{ padding: 'var(--s-12) var(--s-8)', gap: 'var(--s-5)' }}>
                  <div className="ai-mark" style={{ width: 48, height: 48, borderRadius: 'var(--r-md)' }}>
                    <I.Sparkle size={22} stroke={2.4} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: 'var(--fs-lg)' }}>Reading your description…</strong>
                    <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>Choosing the right work model for this project</div>
                  </div>
                  <div className="bar" style={{ width: 240 }}>
                    <div className="bar-fill bar-fill-ai" style={{ width: '70%' }} />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="row gap-4" style={{ padding: 'var(--s-4) var(--s-5)', background: 'var(--ai-gradient-soft)',
                    border: '1px solid var(--ai-border)', borderRadius: 'var(--r-md)', marginBottom: 'var(--s-6)' }}>
                    <I.Sparkle size={14} stroke={2.4} style={{ color: 'var(--ai-text)' }} />
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ai-text)' }}>
                      <strong>Recommended:</strong> {MOCK.PROJECT_TYPES[suggestedType]?.label} — your description mentions {
                        suggestedType === 'engineering' ? 'sprints and shipping' :
                        suggestedType === 'sales' ? 'a quarterly outbound motion' :
                        suggestedType === 'marketing' ? 'campaigns and channels' :
                        suggestedType === 'support' ? 'customer issues' :
                        'recurring work'
                      }. You can override.
                    </span>
                  </div>
                  <div className="type-pick">
                    {Object.values(MOCK.PROJECT_TYPES).map(pt => {
                      const Icon = I[pt.iconKey];
                      const selected = type === pt.id;
                      return (
                        <button key={pt.id} className={`type-pick-card ${selected ? 'is-selected' : ''}`} onClick={() => setType(pt.id)}>
                          <div className={`type-pick-icon proj-icon-${pt.accent}`}><Icon size={18} /></div>
                          <div className="type-pick-name">{pt.label}</div>
                          <div className="type-pick-desc">{pt.blurb}</div>
                          <div className="type-pick-tags">
                            {pt.tags.map(t => <Chip key={t}>{t}</Chip>)}
                          </div>
                          {pt.id === suggestedType && (
                            <div style={{ position: 'absolute', top: 8, right: 8 }}>
                              <AIChip icon={false}>★ Picked</AIChip>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && type && (
            <div>
              <div className="ai-card" style={{ marginBottom: 'var(--s-6)' }}>
                <div className="ai-card-body">
                  <div className="row gap-4" style={{ marginBottom: 'var(--s-5)' }}>
                    <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
                    <strong>AI-drafted plan</strong>
                    <AIChip>3 epics · 18 tasks · 2 sprints</AIChip>
                  </div>
                  <div className="col gap-2">
                    {[
                      { name: 'Magic-link & token flow',  desc: '6 tasks · 28 pts', tag: 'engineering' },
                      { name: 'Welcome screen redesign',   desc: '5 tasks · 18 pts', tag: 'engineering' },
                      { name: 'Notification preferences',  desc: '4 tasks · 14 pts', tag: 'engineering' },
                    ].map((g, i) => (
                      <div key={i} className="row gap-4 between" style={{ padding: 'var(--s-4)', background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 500 }}>{g.name}</div>
                          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{g.desc}</div>
                        </div>
                        <Button variant="ghost" size="sm" icon={<I.Edit size={12} />}>Edit</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col gap-4">
                <div className="row gap-4">
                  <div style={{ flex: 1 }}>
                    <label className="label">Project name</label>
                    <input className="input" defaultValue={desc.split(/[—.,]/)[0].slice(0, 60)} />
                  </div>
                  <div style={{ width: 180 }}>
                    <label className="label">AI control</label>
                    <select className="input"><option>Suggest</option><option>Autopilot</option><option>Ask me first</option><option>Off</option></select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          <div style={{ flex: 1 }} />
          {step === 0 && <Button variant="primary" disabled={!desc.trim()} onClick={goAnalyze} icon={<I.Sparkle size={13} stroke={2.4} />}>Analyze</Button>}
          {step === 1 && !thinking && <Button variant="primary" disabled={!type} onClick={() => setStep(2)} icon={<I.Arrow size={13} />}>Continue</Button>}
          {step === 2 && <Button variant="ai" onClick={() => onCreate(type)} icon={<I.Sparkle size={13} stroke={2.4} />}>Create project</Button>}
        </div>
      </div>
    </div>
  );
};

window.AIWizard = AIWizard;
