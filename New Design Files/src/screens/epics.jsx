// Epics — proper Epic level for Engineering projects.
// Shows the Epic → Task hierarchy with linked tasks per epic.

const Epics = ({ project, onOpenItem, setPage }) => {
  const epics = MOCK.EPICS;
  const tasks = MOCK.TASKS;

  // Compute per-epic rollups
  const stats = epics.map(e => {
    const items = tasks.filter(t => t.epic === e.id);
    const done = items.filter(t => t.status === 'Done').length;
    const inProg = items.filter(t => t.status === 'In Progress' || t.status === 'In Review').length;
    const blocked = items.filter(t => t.status === 'Blocked').length;
    const points = items.reduce((s,t) => s + t.est, 0);
    const donePts = items.filter(t => t.status === 'Done').reduce((s,t) => s + t.est, 0);
    return { epic: e, items, done, inProg, blocked, total: items.length, points, donePts, pct: points ? Math.round((donePts / points) * 100) : 0 };
  });

  const [expanded, setExpanded] = useState({ 'EP-1': true });

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Engineering · Epics</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Epics — Apollo</h1>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              {epics.length} epics · {tasks.length} tasks · {tasks.reduce((s,t)=>s+t.est,0)} points scoped
            </p>
          </div>
          <div className="row gap-3">
            <Button variant="ai" size="sm" icon={<I.Sparkle size={13} stroke={2.4} />}>Decompose with AI</Button>
            <Button variant="primary" icon={<I.Plus size={14} />}>New epic</Button>
          </div>
        </div>
      </div>

      <div className="row gap-3" style={{ marginBottom: 'var(--s-6)' }}>
        <Chip>Status: All</Chip>
        <Chip>Owner: All</Chip>
        <Chip>Target: All</Chip>
        <div style={{ flex: 1 }} />
        <Segmented value="list" onChange={()=>{}}
          options={[{ value: 'list', label: 'List' }, { value: 'tree', label: 'Tree' }, { value: 'gantt', label: 'Timeline' }]} />
      </div>

      <div className="col gap-5">
        {stats.map(({ epic, items, done, inProg, blocked, total, points, donePts, pct }) => {
          const lead = MOCK.userById(epic.lead);
          const members = epic.members.map(MOCK.userById);
          const open = expanded[epic.id];
          return (
            <div key={epic.id} className="card">
              {/* Epic header */}
              <div style={{
                padding: 'var(--s-6) var(--s-7)',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 220px 100px 160px 32px',
                gap: 'var(--s-6)',
                alignItems: 'center',
                cursor: 'pointer',
                borderBottom: open ? '1px solid var(--divider)' : 'none',
              }} onClick={() => setExpanded({ ...expanded, [epic.id]: !open })}>
                {/* Epic icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--r-md)',
                  background: `var(--${epic.color}-soft)`,
                  color: `var(--${epic.color})`,
                  border: `1px solid var(--${epic.color}-border)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                }}>{epic.id.split('-')[1]}</div>

                {/* Name + desc */}
                <div style={{ minWidth: 0 }}>
                  <div className="row gap-3" style={{ marginBottom: 4 }}>
                    <h3 className="h-card" style={{ fontSize: 'var(--fs-lg)' }}>{epic.name}</h3>
                    <Badge tone={epic.status === 'At risk' ? 'warning' : epic.status === 'Not started' ? '' : 'success'} dot>{epic.status}</Badge>
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.45 }} className="truncate">{epic.desc}</div>
                </div>

                {/* Progress */}
                <div className="col" style={{ gap: 4 }}>
                  <div className="row between">
                    <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{donePts}/{points} pts</span>
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <Bar value={pct} variant={epic.status === 'At risk' ? 'warning' : pct >= 80 ? 'success' : ''} />
                  <div className="row gap-4" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                    <span><span className="mono" style={{ fontWeight: 600, color: 'var(--success)' }}>{done}</span> done</span>
                    <span><span className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{inProg}</span> active</span>
                    {blocked > 0 && <span><span className="mono" style={{ fontWeight: 600, color: 'var(--danger)' }}>{blocked}</span> blocked</span>}
                  </div>
                </div>

                {/* Target */}
                <div className="col" style={{ gap: 0 }}>
                  <span className="muted" style={{ fontSize: 'var(--fs-2xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', fontWeight: 600 }}>Target</span>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{epic.target}</span>
                </div>

                {/* Team */}
                <div className="row gap-3">
                  <Avatar user={lead} size="sm" />
                  <AvatarStack users={members.filter(m => m.id !== lead.id)} max={3} size="sm" />
                </div>

                <I.Chevron size={14} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 140ms', color: 'var(--text-muted)' }} />
              </div>

              {/* Linked tasks */}
              {open && (
                <div>
                  <table className="tbl tbl-clean">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>ID</th>
                        <th>Task</th>
                        <th style={{ width: 130 }}>Status</th>
                        <th style={{ width: 110 }}>Priority</th>
                        <th style={{ width: 70 }}>Pts</th>
                        <th style={{ width: 60 }}>Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(t => (
                        <tr key={t.id} onClick={() => onOpenItem(t.id)} style={{ cursor: 'pointer' }}>
                          <td className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{t.id}</td>
                          <td>
                            <div className="row gap-3">
                              <span style={{ fontWeight: 500 }}>{t.title}</span>
                              {t.branch && <Tip text={t.branch}><I.Branch size={11} style={{ color: 'var(--text-muted)' }} /></Tip>}
                            </div>
                          </td>
                          <td><Status status={t.status} /></td>
                          <td><Priority level={t.priority} /></td>
                          <td className="mono" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{t.est}</td>
                          <td><Avatar user={MOCK.userById(t.assignee)} size="sm" /></td>
                        </tr>
                      ))}
                      {/* AI suggestion row */}
                      <tr style={{ background: 'var(--ai-gradient-soft)', cursor: 'pointer' }}>
                        <td colSpan={6} style={{ padding: 'var(--s-4) var(--s-5)' }}>
                          <div className="row gap-3" style={{ color: 'var(--ai-text)', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                            <I.Sparkle size={12} stroke={2.4} />
                            <span>AI can break down 2 more tasks from this epic's description</span>
                            <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }}>Review draft →</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

window.Epics = Epics;
