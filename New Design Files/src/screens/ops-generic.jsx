// Operations — Runbook list (workflows with recurrence + run history)
// Generic — Simple board (Todo / Doing / Done)

const OperationsRunbook = ({ project, onOpenItem }) => {
  const workflows = [
    { id: 'WF-12', name: 'Vendor security review', recur: 'On-demand', last: '2 days ago', state: 'Complete', steps: 8, runs: 14, owner: 'u1', next: '—' },
    { id: 'WF-09', name: 'SOC 2 control snapshot', recur: 'Quarterly', last: '12 days ago', state: 'Running', steps: 22, runs: 4, owner: 'u3', next: 'Aug 01' },
    { id: 'WF-07', name: 'Onboarding new employee', recur: 'On-demand', last: '1 day ago', state: 'Complete', steps: 14, runs: 28, owner: 'u1', next: '—' },
    { id: 'WF-04', name: 'Customer offboarding (GDPR)', recur: 'On-demand', last: '5 days ago', state: 'Complete', steps: 7, runs: 9, owner: 'u7', next: '—' },
    { id: 'WF-02', name: 'Monthly backup verification', recur: 'Monthly', last: '6 hours ago', state: 'Scheduled', steps: 5, runs: 18, owner: 'u3', next: 'Aug 22' },
    { id: 'WF-01', name: 'Incident postmortem', recur: 'On-demand', last: '18 days ago', state: 'Complete', steps: 6, runs: 3, owner: 'u1', next: '—' },
  ];

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Operations · Runbooks</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>SOC 2 Audit Workflow</h1>
          </div>
          <div className="row gap-4">
            <Button variant="ai" size="sm" icon={<I.Sparkle size={13} stroke={2.4} />}>Author from template</Button>
            <Button variant="primary" icon={<I.Plus size={14} />}>New workflow</Button>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 70 }}>ID</th>
              <th>Workflow</th>
              <th style={{ width: 120 }}>Recurrence</th>
              <th style={{ width: 110 }}>Last run</th>
              <th style={{ width: 100 }}>Steps</th>
              <th style={{ width: 90 }}>Runs</th>
              <th style={{ width: 130 }}>Next</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 60 }}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map(w => (
              <tr key={w.id} onClick={() => onOpenItem(w.id)} style={{ cursor: 'pointer' }}>
                <td className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{w.id}</td>
                <td><strong>{w.name}</strong></td>
                <td><Badge>{w.recur}</Badge></td>
                <td className="muted">{w.last}</td>
                <td>
                  <div className="row gap-3">
                    <div className="bar" style={{ width: 50 }}><div className="bar-fill bar-fill-success" style={{ width: w.state === 'Complete' ? '100%' : '62%' }} /></div>
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>{w.steps}</span>
                  </div>
                </td>
                <td className="mono">{w.runs}</td>
                <td className="muted">{w.next}</td>
                <td>
                  <Status status={w.state} />
                </td>
                <td><Avatar user={MOCK.userById(w.owner)} size="sm" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GenericBoard = ({ project }) => {
  const tasks = {
    Todo: [
      { id: 'T-09', title: 'Phone screen — Backend candidate Riya', who: 'u1' },
      { id: 'T-08', title: 'Reach out to Margaret (referral)', who: 'u5' },
      { id: 'T-07', title: 'Update JD for Senior PM', who: 'u1' },
    ],
    Doing: [
      { id: 'T-06', title: 'Final round panel — Diego', who: 'u1' },
      { id: 'T-05', title: 'Take-home review × 3', who: 'u5' },
    ],
    Done: [
      { id: 'T-04', title: 'Offer signed — Naomi', who: 'u1' },
      { id: 'T-03', title: 'Recruiter sync', who: 'u1' },
    ],
  };
  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Generic · Simple board</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Q3 Hiring Pipeline</h1>
          </div>
          <Button variant="primary" icon={<I.Plus size={14} />}>New task</Button>
        </div>
      </div>
      <div className="kanban" style={{ paddingBottom: 0 }}>
        {Object.entries(tasks).map(([k, items]) => (
          <div key={k} className="kanban-col">
            <div className="kanban-col-head">
              <div className="kanban-col-title">
                <span className="kanban-col-title-dot" style={{ background: k === 'Done' ? 'var(--success)' : k === 'Doing' ? 'var(--accent-bright)' : 'var(--text-muted)' }} />
                <span>{k}</span>
                <span className="muted mono" style={{ fontSize: 'var(--fs-xs)', marginLeft: 4 }}>{items.length}</span>
              </div>
              <button className="btn btn-ghost btn-icon-sm"><I.Plus size={12} /></button>
            </div>
            <div className="kanban-col-body">
              {items.map(t => (
                <div key={t.id} className="card-task">
                  <div className="card-task-head">
                    <span className="card-task-id">{t.id}</span>
                  </div>
                  <div className="card-task-title">{t.title}</div>
                  <div className="card-task-meta">
                    <span className="meta-spacer" />
                    <Avatar user={MOCK.userById(t.who)} size="xs" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { OperationsRunbook, GenericBoard });
