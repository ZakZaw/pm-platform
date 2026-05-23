// Support — Queue (table with SLA timers)

const SupportQueue = ({ project, onOpenItem }) => {
  const counts = {
    All: MOCK.TICKETS.length,
    Open: MOCK.TICKETS.filter(t => t.status === 'Open').length,
    Pending: MOCK.TICKETS.filter(t => t.status === 'Pending').length,
    Breaching: MOCK.TICKETS.filter(t => t.slaState === 'danger').length,
    Mine: MOCK.TICKETS.filter(t => t.assignee === 'u7').length,
  };

  const [tab, setTab] = useState('All');

  const shown = MOCK.TICKETS.filter(t => {
    if (tab === 'All') return true;
    if (tab === 'Breaching') return t.slaState === 'danger';
    if (tab === 'Mine') return t.assignee === 'u7';
    return t.status === tab;
  });

  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Support · Queue</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Customer Support — Relay</h1>
          </div>
          <div className="row gap-4">
            <Button variant="ai" size="sm" icon={<I.Sparkle size={13} stroke={2.4} />}>Group similar tickets</Button>
            <Button variant="primary" icon={<I.Plus size={14} />}>New ticket</Button>
          </div>
        </div>
      </div>

      {/* AI recurring banner */}
      <div className="ai-card" style={{ marginBottom: 'var(--s-7)' }}>
        <div className="ai-card-body row gap-5">
          <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
          <div className="col" style={{ flex: 1, gap: 2 }}>
            <strong style={{ fontSize: 'var(--fs-md)' }}>Recurring issue detected — Okta SSO loop</strong>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>4 tickets this week with the same root cause. I drafted a bug task and a customer template.</span>
          </div>
          <Button variant="" size="sm">Review draft</Button>
          <Button variant="ai" size="sm">Send templates</Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'All', label: 'All', count: counts.All },
          { id: 'Open', label: 'Open', count: counts.Open },
          { id: 'Pending', label: 'Pending', count: counts.Pending },
          { id: 'Breaching', label: 'SLA breaching', count: counts.Breaching },
          { id: 'Mine', label: 'Assigned to me', count: counts.Mine },
        ]}
      />

      <div style={{ marginTop: 'var(--s-6)' }}>
        <div className="queue">
          <div className="queue-row queue-head">
            <div>ID</div>
            <div>Subject</div>
            <div>Customer</div>
            <div>Priority</div>
            <div>Status</div>
            <div>SLA</div>
            <div>Assignee</div>
          </div>
          {shown.map(t => {
            const u = MOCK.userById(t.assignee);
            return (
              <div key={t.id} className={`queue-row ${t.slaState === 'danger' ? 'is-urgent' : ''}`} onClick={() => onOpenItem(t.id)}>
                <div className="queue-id">{t.id}</div>
                <div>
                  <div className="queue-subj">{t.subject}</div>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>Updated {t.updated}</div>
                </div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t.customer}</div>
                <div><Priority level={t.priority} /></div>
                <div><Status status={t.status} /></div>
                <div>
                  <span className={`sla is-${t.slaState}`}>
                    <span className="sla-dot" />
                    {t.sla}
                  </span>
                </div>
                <div><Avatar user={u} size="sm" /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

window.SupportQueue = SupportQueue;
