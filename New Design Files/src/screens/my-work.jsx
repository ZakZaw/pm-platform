// My Work — cross-project list (today / week / overdue)

const MyWork = ({ setPage, onPickProject, onOpenItem }) => {
  // Build a combined list from various sources for the demo
  const items = [
    { kind: 'task', project: 'p_apollo', id: 'APL-246', title: 'SSO error mapping for enterprise', status: 'Blocked', due: 'Overdue 2d', urgent: true },
    { kind: 'task', project: 'p_apollo', id: 'APL-251', title: 'Migrate sessions to JWT v2', status: 'Todo', due: 'Today', urgent: false },
    { kind: 'deal', project: 'p_orbital', id: 'D-122', title: 'Annual renewal + add-on — Cobalt', status: 'Proposal', due: 'Today', urgent: false },
    { kind: 'ticket', project: 'p_relay', id: 'T-1426', title: 'SSO loop after Okta config change', status: 'Open', due: 'SLA in 48m', urgent: true },
    { kind: 'review', project: 'p_apollo', id: 'PR-482', title: 'Review PR: feat/magic-link', status: 'In Review', due: 'Tomorrow' },
    { kind: 'task', project: 'p_canopy', id: 'CAN-12', title: 'Approve email — Beta invite wave 2', status: 'In Review', due: 'Thu' },
    { kind: 'meeting', project: 'p_apollo', id: 'MTG-1', title: 'Apollo standup', status: '', due: 'Tomorrow 10:00' },
  ];
  const sections = [
    { name: 'Overdue', filter: i => i.due.startsWith('Overdue') || i.due.includes('48m'), tone: 'danger' },
    { name: 'Today',   filter: i => i.due === 'Today', tone: 'accent' },
    { name: 'This week', filter: i => !i.due.startsWith('Overdue') && !i.due.includes('48m') && i.due !== 'Today' },
  ];

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Aria Chen</div>
            <h1 className="page-title">My Work</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>{items.length} items across {new Set(items.map(i=>i.project)).size} projects</p>
          </div>
          <div className="row gap-3">
            <Segmented value="all" onChange={()=>{}} options={[{ value: 'all', label: 'All' }, { value: 'tasks', label: 'Tasks' }, { value: 'deals', label: 'Deals' }, { value: 'tickets', label: 'Tickets' }]} />
          </div>
        </div>
      </div>

      <div className="col gap-7">
        {sections.map(sec => {
          const list = items.filter(sec.filter);
          if (!list.length) return null;
          return (
            <div key={sec.name}>
              <div className="row gap-3" style={{ marginBottom: 'var(--s-4)' }}>
                <h3 className="h-card" style={{ fontSize: 'var(--fs-md)' }}>{sec.name}</h3>
                <Badge tone={sec.tone || ''}>{list.length}</Badge>
              </div>
              <div className="card">
                {list.map((it, i) => {
                  const proj = MOCK.projectById(it.project);
                  const pt = MOCK.PROJECT_TYPES[proj.type];
                  return (
                    <div key={i} className="row gap-5" onClick={() => { onPickProject(it.project); onOpenItem && onOpenItem(it.id); }} style={{
                      padding: 'var(--s-5) var(--s-7)',
                      borderBottom: i === list.length - 1 ? 0 : '1px solid var(--divider)',
                      cursor: 'pointer',
                    }}>
                      <input type="checkbox" className="cb" onClick={e => e.stopPropagation()} />
                      <span className="mono muted" style={{ fontSize: 'var(--fs-xs)', minWidth: 64 }}>{it.id}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row gap-3">
                          <span style={{ fontSize: 'var(--fs-md)', fontWeight: 500 }} className="truncate">{it.title}</span>
                          {it.urgent && <Badge tone="danger" dot>Urgent</Badge>}
                        </div>
                        <div className="row gap-3" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                          <div className={`proj-icon proj-icon-${pt.accent}`} style={{ width: 14, height: 14, fontSize: 7, borderRadius: 3 }}>{proj.icon}</div>
                          <span>{proj.name.split(' — ')[0]}</span>
                          <span>·</span>
                          <span>{pt.label}</span>
                        </div>
                      </div>
                      {it.status && <Status status={it.status} />}
                      <span className="muted mono" style={{ fontSize: 'var(--fs-xs)', minWidth: 100, textAlign: 'right' }}>{it.due}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

window.MyWork = MyWork;
