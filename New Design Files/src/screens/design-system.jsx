// Design System Spec — tokens + primitives, organized into sections.

const DesignSystem = () => {
  return (
    <div className="main-inner" style={{ maxWidth: 1200 }}>
      <div className="page-head">
        <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
          <AIChip>v1.0 · live tokens</AIChip>
        </div>
        <h1 className="page-title">Design system</h1>
        <p className="page-subtitle" style={{ marginTop: 8 }}>
          Tokens and primitives that power the PMO platform. Every value is theme-aware — switch the toggle in the sidebar to see dark mode.
        </p>
      </div>

      {/* === COLOR === */}
      <DSSection title="Color" eyebrow="Tokens · 01">
        <div className="grid-3">
          <SwatchGroup title="Surfaces" tokens={['--bg','--bg-subtle','--surface','--surface-2','--surface-hover']} />
          <SwatchGroup title="Text" tokens={['--text','--text-secondary','--text-muted','--text-subtle']} />
          <SwatchGroup title="Borders" tokens={['--border','--border-strong','--divider']} />
        </div>
        <h4 className="h-card" style={{ fontSize: 'var(--fs-md)', margin: 'var(--s-7) 0 var(--s-4)' }}>Accent — Deep cobalt blue</h4>
        <div className="grid-4">
          {['--accent','--accent-bright','--accent-soft','--accent-soft-2'].map(t => <Swatch key={t} token={t} />)}
        </div>
        <h4 className="h-card" style={{ fontSize: 'var(--fs-md)', margin: 'var(--s-7) 0 var(--s-4)' }}>Status — Jewel-toned, used surgically</h4>
        <div className="grid-4">
          {['--success','--warning','--danger','--info','--violet','--teal','--rose','--amber'].map(t => <Swatch key={t} token={t} />)}
        </div>
        <h4 className="h-card" style={{ fontSize: 'var(--fs-md)', margin: 'var(--s-7) 0 var(--s-4)' }}>AI surface — Iridescent</h4>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="ai-shimmer-bg" style={{ height: 80 }} />
          <div className="card-body row gap-5">
            <code className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>--ai-gradient</code>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Used for AI surfaces, badges, generation buttons. Subtle motion (8s shimmer) signals "this is AI".</span>
          </div>
        </div>
      </DSSection>

      {/* === TYPOGRAPHY === */}
      <DSSection title="Typography" eyebrow="Tokens · 02">
        <div className="card card-pad">
          <div className="col gap-7">
            {[
              { label: 'Display · 36px / 700', tag: 'h1', size: 'var(--fs-4xl)', weight: 700, sample: 'Build with confidence' },
              { label: 'Title · 28px / 700',   tag: 'h1', size: 'var(--fs-3xl)', weight: 700, sample: 'Sprint 24 · Apollo Onboarding' },
              { label: 'Section · 22px / 600', tag: 'h2', size: 'var(--fs-2xl)', weight: 600, sample: 'Pipeline by stage' },
              { label: 'Card · 16px / 600',    tag: 'h3', size: 'var(--fs-lg)',  weight: 600, sample: 'Magic-link & token flow' },
              { label: 'Body · 14px / 400',    tag: 'p',  size: 'var(--fs-base)',weight: 400, sample: 'A unified workspace for any team that runs projects — engineering, product, sales, support.' },
              { label: 'Small · 12px / 400',   tag: 'p',  size: 'var(--fs-sm)',  weight: 400, sample: 'Updated 4 minutes ago by Maya Singh' },
            ].map((t, i) => (
              <div key={i} className="row gap-7" style={{ alignItems: 'baseline' }}>
                <div className="mono" style={{ width: 200, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{t.label}</div>
                <div style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: 1.2, letterSpacing: t.weight >= 600 ? '-0.015em' : 0 }}>{t.sample}</div>
              </div>
            ))}
            <div className="row gap-7" style={{ alignItems: 'baseline', borderTop: '1px solid var(--divider)', paddingTop: 'var(--s-6)' }}>
              <div className="mono" style={{ width: 200, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Mono · JetBrains Mono</div>
              <div className="mono" style={{ fontSize: 'var(--fs-lg)', fontWeight: 500 }}>APL-241 · $124,000 · 78%</div>
            </div>
          </div>
        </div>
      </DSSection>

      {/* === SPACING / RADIUS / SHADOW === */}
      <DSSection title="Spacing, radius & shadow" eyebrow="Tokens · 03">
        <div className="grid-3">
          <div className="card card-pad">
            <h4 className="eyebrow" style={{ marginBottom: 'var(--s-5)' }}>Spacing (4px base)</h4>
            <div className="col gap-3">
              {[['s-2','4px'],['s-3','6px'],['s-4','8px'],['s-5','12px'],['s-6','16px'],['s-7','20px'],['s-8','24px'],['s-9','32px'],['s-10','40px']].map(([k, v]) => (
                <div key={k} className="row gap-4" style={{ fontSize: 'var(--fs-xs)' }}>
                  <span className="mono muted" style={{ width: 40 }}>{k}</span>
                  <div style={{ width: v, height: 16, background: 'var(--accent)', borderRadius: 2 }} />
                  <span className="mono muted" style={{ marginLeft: 'auto' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <h4 className="eyebrow" style={{ marginBottom: 'var(--s-5)' }}>Radius</h4>
            <div className="col gap-4">
              {[['r-xs','4px'],['r-sm','6px'],['r-md','8px'],['r-lg','12px'],['r-xl','16px'],['r-2xl','20px']].map(([k, v]) => (
                <div key={k} className="row gap-4" style={{ fontSize: 'var(--fs-xs)' }}>
                  <span className="mono muted" style={{ width: 60 }}>{k}</span>
                  <div style={{ width: 28, height: 28, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: `var(--${k})` }} />
                  <span className="mono muted" style={{ marginLeft: 'auto' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <h4 className="eyebrow" style={{ marginBottom: 'var(--s-5)' }}>Shadow</h4>
            <div className="col gap-5">
              {['shadow-xs','shadow-sm','shadow-md','shadow-lg','shadow-xl','shadow-accent'].map(k => (
                <div key={k} className="row gap-4">
                  <span className="mono muted" style={{ fontSize: 'var(--fs-xs)', width: 90 }}>{k}</span>
                  <div style={{ width: 60, height: 28, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: `var(--${k})` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DSSection>

      {/* === BUTTONS === */}
      <DSSection title="Buttons" eyebrow="Primitives · 04">
        <div className="card card-pad">
          <div className="col gap-6">
            <Row label="Primary">
              <Button variant="primary">Save changes</Button>
              <Button variant="primary" size="sm">Save</Button>
              <Button variant="primary" icon={<I.Plus size={13} />}>New task</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </Row>
            <Row label="Default">
              <Button>Cancel</Button>
              <Button size="sm">Cancel</Button>
              <Button icon={<I.Filter size={13} />}>Filter</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" icon={<I.Trash size={12} />}>Delete</Button>
            </Row>
            <Row label="AI">
              <Button variant="ai" icon={<I.Sparkle size={13} stroke={2.4} />}>Draft sprint plan</Button>
              <Button variant="ai" size="sm" icon={<I.Sparkle size={11} stroke={2.4} />}>Ask AI</Button>
            </Row>
            <Row label="Icon only">
              <Button className="btn-icon" icon={<I.Bell size={14} />} />
              <Button variant="ghost" className="btn-icon" icon={<I.More size={14} />} />
            </Row>
          </div>
        </div>
      </DSSection>

      {/* === INPUT / FORM === */}
      <DSSection title="Inputs & form" eyebrow="Primitives · 05">
        <div className="card card-pad grid-2">
          <div className="col gap-5">
            <div><label className="label">Project name</label><input className="input" defaultValue="Apollo onboarding" /></div>
            <div><label className="label">Description</label><textarea className="textarea" rows={3} defaultValue="Two-sprint passwordless auth rewrite across web + iOS." /></div>
            <div>
              <label className="label">Search</label>
              <div className="input-wrap"><I.Search size={14} className="input-icon" /><input className="input" placeholder="Filter tasks..." /></div>
            </div>
          </div>
          <div className="col gap-5">
            <div>
              <label className="label">Status</label>
              <select className="input"><option>In Progress</option><option>Done</option><option>Todo</option></select>
            </div>
            <div className="row gap-4">
              <label className="row gap-3" style={{ fontSize: 'var(--fs-sm)' }}><input type="checkbox" className="cb" defaultChecked /> Notify channel</label>
              <label className="row gap-3" style={{ fontSize: 'var(--fs-sm)' }}><input type="checkbox" className="cb" /> Lock scope</label>
            </div>
            <div className="row gap-4">
              <span style={{ fontSize: 'var(--fs-sm)' }}>Autopilot</span>
              <Switch on onChange={() => {}} />
            </div>
            <div className="row gap-3 flex-wrap">
              <Chip onRemove={() => {}}>passwordless</Chip>
              <Chip onRemove={() => {}}>auth</Chip>
              <Chip>+ add</Chip>
            </div>
          </div>
        </div>
      </DSSection>

      {/* === BADGES / STATUS / PRIORITY === */}
      <DSSection title="Badges, status, priority" eyebrow="Primitives · 06">
        <div className="card card-pad col gap-6">
          <Row label="Badges">
            <Badge>Default</Badge>
            <Badge tone="accent">Engineering</Badge>
            <Badge tone="success">Closed Won</Badge>
            <Badge tone="warning">At risk</Badge>
            <Badge tone="danger" dot>Urgent</Badge>
            <Badge tone="violet">In Review</Badge>
            <Badge tone="rose">Bug</Badge>
            <AIChip>AI · 78% conf</AIChip>
          </Row>
          <Row label="Status pills">
            {['Todo','In Progress','In Review','Done','Blocked'].map(s => <Status key={s} status={s} />)}
          </Row>
          <Row label="Priority">
            {['urgent','high','medium','low'].map(p => <Priority key={p} level={p} />)}
          </Row>
        </div>
      </DSSection>

      {/* === AVATARS === */}
      <DSSection title="Avatars" eyebrow="Primitives · 07">
        <div className="card card-pad col gap-5">
          <Row label="Sizes">
            <Avatar user={MOCK.MEMBERS[0]} size="xs" />
            <Avatar user={MOCK.MEMBERS[0]} size="sm" />
            <Avatar user={MOCK.MEMBERS[0]} />
            <Avatar user={MOCK.MEMBERS[0]} size="md" />
            <Avatar user={MOCK.MEMBERS[0]} size="lg" />
            <Avatar user={MOCK.MEMBERS[0]} size="xl" />
          </Row>
          <Row label="Color tags">
            {MOCK.MEMBERS.slice(0, 8).map(m => <Avatar key={m.id} user={m} />)}
          </Row>
          <Row label="Stack">
            <AvatarStack users={MOCK.MEMBERS} max={4} />
            <AvatarStack users={MOCK.MEMBERS} max={5} size="sm" />
          </Row>
        </div>
      </DSSection>

      {/* === CARDS & DATA === */}
      <DSSection title="Cards & data" eyebrow="Primitives · 08">
        <div className="grid-3">
          <div className="card">
            <div className="card-header"><strong>Velocity</strong><Badge tone="success" dot>+8%</Badge></div>
            <div className="card-body">
              <div className="mono" style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700 }}>34 pts</div>
              <Sparkline data={[22,24,26,25,28,30,28,32,30,33,34]} color="var(--success)" />
            </div>
          </div>
          <div className="ai-card">
            <div className="ai-card-body">
              <div className="row gap-4" style={{ marginBottom: 'var(--s-3)' }}>
                <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
                <strong style={{ fontSize: 'var(--fs-md)' }}>AI card</strong>
              </div>
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>For suggestions, drafts, and decisions. Iridescent border + soft gradient backdrop.</p>
            </div>
          </div>
          <div className="card card-pad">
            <div className="empty">
              <div className="empty-icon"><I.Folder size={20} /></div>
              <div className="empty-title">No tasks yet</div>
              <div className="empty-desc">Drag items here or let AI draft a sprint plan from your description.</div>
            </div>
          </div>
        </div>
      </DSSection>

      {/* === MOTION === */}
      <DSSection title="Motion" eyebrow="Tokens · 09">
        <div className="card card-pad row gap-7" style={{ flexWrap: 'wrap' }}>
          <Duration label="Instant · 80ms" v={80} />
          <Duration label="Fast · 140ms" v={140} />
          <Duration label="Base · 200ms" v={200} />
          <Duration label="Slow · 320ms" v={320} />
        </div>
      </DSSection>
    </div>
  );
};

const DSSection = ({ eyebrow, title, children }) => (
  <section style={{ marginBottom: 'var(--s-12)' }}>
    <div style={{ marginBottom: 'var(--s-5)' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
      <h2 className="h-section">{title}</h2>
    </div>
    {children}
  </section>
);

const Row = ({ label, children }) => (
  <div className="row gap-5" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
    <span className="mono muted" style={{ width: 100, fontSize: 'var(--fs-xs)', flexShrink: 0 }}>{label}</span>
    <div className="row gap-3" style={{ flexWrap: 'wrap', flex: 1 }}>{children}</div>
  </div>
);

const Swatch = ({ token }) => (
  <div className="row gap-4">
    <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: `var(${token})`, border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }} />
    <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
      <code className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{token}</code>
    </div>
  </div>
);

const SwatchGroup = ({ title, tokens }) => (
  <div className="card card-pad">
    <h4 className="eyebrow" style={{ marginBottom: 'var(--s-5)' }}>{title}</h4>
    <div className="col gap-4">{tokens.map(t => <Swatch key={t} token={t} />)}</div>
  </div>
);

const Duration = ({ label, v }) => {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPos(p => p === 0 ? 1 : 0), v + 800);
    return () => clearInterval(t);
  }, [v]);
  return (
    <div className="col gap-3" style={{ alignItems: 'flex-start' }}>
      <span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{label}</span>
      <div style={{ width: 140, height: 30, padding: 3, borderRadius: 999, background: 'var(--surface-2)' }}>
        <div style={{ width: 24, height: 24, borderRadius: 999, background: 'var(--accent)',
          transform: `translateX(${pos * 110}px)`, transition: `transform ${v}ms var(--ease-out)` }} />
      </div>
    </div>
  );
};

window.DesignSystem = DesignSystem;
