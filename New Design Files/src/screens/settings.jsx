// Settings — org / project / AI control mode

const Settings = ({ project, projectType }) => {
  const [tab, setTab] = useState('ai');

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Settings</div>
            <h1 className="page-title">Workspace settings</h1>
          </div>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          <div className="col gap-2">
            <SettingsNav active={tab} onClick={setTab} items={[
              { id: 'org', label: 'Organization', icon: <I.Generic size={14} /> },
              { id: 'members', label: 'Members & roles', icon: <I.Users size={14} /> },
              { id: 'branding', label: 'Branding', icon: <I.Star size={14} /> },
              { id: 'sso', label: 'SSO & SAML', icon: <I.Lock size={14} /> },
              { id: 'audit', label: 'Audit log', icon: <I.Eye size={14} /> },
            ]} />
            <div className="muted eyebrow" style={{ padding: 'var(--s-5) var(--s-4) var(--s-3)' }}>Project</div>
            <SettingsNav active={tab} onClick={setTab} items={[
              { id: 'ai', label: 'AI control mode', icon: <I.Sparkle size={14} />, highlight: true },
              { id: 'workflow', label: 'Workflow & fields', icon: <I.Layers size={14} /> },
              { id: 'integrations', label: 'Integrations', icon: <I.Branch size={14} /> },
              { id: 'sharing', label: 'Sharing & access', icon: <I.Link size={14} /> },
            ]} />
          </div>
        </div>

        <div className="settings-pane">
          {tab === 'ai' && <AISettings />}
          {tab === 'integrations' && <IntegrationsSettings />}
          {tab === 'workflow' && <WorkflowSettings projectType={projectType} />}
          {tab === 'org' && <OrgSettings />}
          {tab === 'members' && <MembersSettings />}
          {tab !== 'ai' && tab !== 'integrations' && tab !== 'workflow' && tab !== 'org' && tab !== 'members' && (
            <div className="card card-pad">
              <h3 className="h-card">{tab}</h3>
              <p className="muted" style={{ marginTop: 8 }}>Settings panel.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingsNav = ({ items, active, onClick }) => (
  <div className="col">
    {items.map(i => (
      <button key={i.id} className={`nav-item ${active === i.id ? 'is-active' : ''}`} onClick={() => onClick(i.id)} style={{ marginBottom: 2 }}>
        <span className="nav-icon">{i.icon}</span>
        <span>{i.label}</span>
        {i.highlight && <span className="ai-pulse" />}
      </button>
    ))}
  </div>
);

const AISettings = () => {
  const [mode, setMode] = useState('suggest');
  const modes = [
    { id: 'autopilot', label: 'Autopilot', icon: <I.Bolt size={14} />, desc: 'AI takes actions automatically. Everything reversible within 24 h.' },
    { id: 'suggest', label: 'Suggest', icon: <I.Sparkle size={14} />, desc: 'AI proposes, you approve. Drafts appear in your inbox.', recommended: true },
    { id: 'ask', label: 'Ask Me First', icon: <I.Comment size={14} />, desc: 'AI must confirm every write. Heavy oversight.' },
    { id: 'off', label: 'Off', icon: <I.X size={14} />, desc: 'No AI writes. Manual planning and estimation.' },
  ];
  return (
    <>
      <div className="card" style={{ marginBottom: 'var(--s-6)' }}>
        <div className="card-header">
          <strong>AI control mode</strong>
          <Badge tone="ai" dot>Per project</Badge>
        </div>
        <div className="card-body">
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-7)' }}>
            Choose how proactive AI is in this project. You can change this anytime; the audit log records every AI write.
          </p>
          <div className="col gap-3">
            {modes.map(m => (
              <label key={m.id} className={`card`} style={{
                padding: 'var(--s-5) var(--s-6)', cursor: 'pointer',
                borderColor: mode === m.id ? 'var(--accent)' : 'var(--border)',
                boxShadow: mode === m.id ? '0 0 0 3px var(--accent-soft)' : 'none',
              }}>
                <div className="row gap-5">
                  <input type="radio" name="ai-mode" checked={mode === m.id} onChange={() => setMode(m.id)} style={{ accentColor: 'var(--accent)' }} />
                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--r-md)',
                    background: m.id === 'autopilot' ? 'var(--ai-gradient)' : 'var(--surface-2)',
                    color: m.id === 'autopilot' ? 'white' : 'var(--text-muted)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div className="row gap-3" style={{ marginBottom: 2 }}>
                      <strong style={{ fontSize: 'var(--fs-md)' }}>{m.label}</strong>
                      {m.recommended && <Badge tone="accent">Recommended</Badge>}
                    </div>
                    <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{m.desc}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><strong>Granular AI permissions</strong></div>
        <div className="card-body col gap-4">
          {[
            ['Generate tasks from descriptions', true],
            ['Estimate effort & confidence', true],
            ['Draft replans when velocity drops', true],
            ['Reassign on member leave', false],
            ['Send check-in emails on stalled deals', false],
            ['Auto-tag tickets from content', true],
          ].map(([label, on], i) => (
            <SwitchRow key={i} label={label} initial={on} />
          ))}
        </div>
      </div>
    </>
  );
};

const SwitchRow = ({ label, initial }) => {
  const [on, setOn] = useState(initial);
  return (
    <div className="row between">
      <span style={{ fontSize: 'var(--fs-sm)' }}>{label}</span>
      <Switch on={on} onChange={setOn} />
    </div>
  );
};

const IntegrationsSettings = () => {
  const ints = [
    { name: 'GitHub', icon: <I.Branch />, status: 'Connected', state: 'on', desc: '3 repos · branch & PR sync' },
    { name: 'Slack', icon: <I.Slack />, status: 'Connected', state: 'on', desc: '#apollo · #orbital · #relay-support' },
    { name: 'Zendesk', icon: <I.Support />, status: 'Connected', state: 'on', desc: 'Bidirectional · 124 mappings' },
    { name: 'GitLab', icon: <I.Branch />, status: 'Not connected', state: 'off', desc: 'Branch & PR sync' },
    { name: 'REST API', icon: <I.Code />, status: 'OpenAPI v1.4', state: 'on', desc: '2 webhooks · 4 API keys' },
    { name: 'No-code automations', icon: <I.Bolt />, status: '12 active', state: 'on', desc: 'Triggers & actions' },
  ];
  return (
    <div className="card">
      <div className="card-header"><strong>Integrations</strong><Button size="sm" icon={<I.Plus size={12} />}>Add</Button></div>
      <div className="card-body col gap-3" style={{ padding: 'var(--s-5)' }}>
        {ints.map(i => (
          <div key={i.name} className="row gap-5" style={{ padding: 'var(--s-4) var(--s-5)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{i.icon}</div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 'var(--fs-md)' }}>{i.name}</strong>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{i.desc}</div>
            </div>
            <Badge tone={i.state === 'on' ? 'success' : ''} dot>{i.status}</Badge>
            <Button size="sm" variant="ghost">Configure</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const WorkflowSettings = ({ projectType }) => (
  <div className="card">
    <div className="card-header"><strong>{projectType.label} workflow</strong><Button size="sm" icon={<I.Plus size={12} />}>Add status</Button></div>
    <div className="card-body">
      <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-6)' }}>
        Drag to reorder. {projectType.vocab.items} flow through these statuses left → right.
      </p>
      <div className="row gap-3" style={{ overflowX: 'auto' }}>
        {projectType.statuses.map((s, i) => (
          <React.Fragment key={s}>
            <div className="card" style={{ padding: 'var(--s-4) var(--s-5)', minWidth: 140 }}>
              <div className="row gap-3">
                <span className="badge-dot" style={{ background: i === 0 ? 'var(--text-muted)' : i === projectType.statuses.length - 1 ? 'var(--success)' : 'var(--accent-bright)' }} />
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{s}</span>
              </div>
            </div>
            {i < projectType.statuses.length - 1 && <I.Arrow size={14} style={{ color: 'var(--text-subtle)', alignSelf: 'center' }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  </div>
);

const OrgSettings = () => (
  <div className="card">
    <div className="card-header"><strong>Organization</strong></div>
    <div className="card-body col gap-5">
      <div><label className="label">Name</label><input className="input" defaultValue="Lattice Labs" /></div>
      <div><label className="label">URL slug</label><div className="input-group"><span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>pmo.app/</span><input className="input" defaultValue="lattice" style={{ width: 180 }} /></div></div>
      <div><label className="label">Default timezone</label><select className="input" style={{ width: 240 }}><option>America/Los_Angeles</option></select></div>
    </div>
  </div>
);

const MembersSettings = () => (
  <div className="card">
    <div className="card-header"><strong>Members</strong><Button size="sm" icon={<I.Plus size={12} />}>Invite</Button></div>
    <div className="card-body" style={{ padding: 0 }}>
      <table className="tbl">
        <thead><tr><th>Member</th><th>Role</th><th>Timezone</th><th>Skills</th><th>Capacity</th></tr></thead>
        <tbody>
          {MOCK.MEMBERS.map(m => (
            <tr key={m.id}>
              <td><div className="row gap-3"><Avatar user={m} size="sm" /><strong>{m.name}</strong></div></td>
              <td><Badge>{m.role}</Badge></td>
              <td className="muted">{m.tz}</td>
              <td><span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>—</span></td>
              <td><div className="row gap-3"><Bar value={70 + (m.color * 4) % 30} /><span className="mono" style={{ fontSize: 'var(--fs-xs)', minWidth: 32 }}>80%</span></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

window.Settings = Settings;
