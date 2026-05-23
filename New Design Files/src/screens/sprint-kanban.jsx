// Engineering — Sprint Kanban

const SprintKanban = ({ project, onOpenItem }) => {
  const cols = [
    { id: 'Todo', name: 'Todo', dot: 'var(--text-muted)' },
    { id: 'In Progress', name: 'In Progress', dot: 'var(--accent-bright)' },
    { id: 'In Review', name: 'In Review', dot: 'var(--violet)' },
    { id: 'Blocked', name: 'Blocked', dot: 'var(--danger)' },
    { id: 'Done', name: 'Done', dot: 'var(--success)' },
  ];

  const epicById = (id) => MOCK.EPICS.find(e => e.id === id);

  return (
    <div className="main-inner" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 'var(--s-7) var(--s-9)' }}>
      <div className="page-head" style={{ marginBottom: 'var(--s-6)' }}>
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Engineering · Sprint board</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Sprint 24 · Apollo Onboarding</h1>
          </div>
          <div className="row gap-4">
            {/* Burndown chip */}
            <div className="row gap-4" style={{ padding: 'var(--s-3) var(--s-5)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div className="col" style={{ gap: 0 }}>
                <div className="muted" style={{ fontSize: 'var(--fs-2xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', fontWeight: 600 }}>Burndown</div>
                <div className="row gap-3">
                  <Sparkline data={MOCK.SPRINT.burndown} color="var(--accent)" width={88} height={20} />
                  <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{MOCK.SPRINT.completed}/{MOCK.SPRINT.planned} pts</span>
                </div>
              </div>
              <div className="divider-v" style={{ alignSelf: 'stretch' }} />
              <div className="col center" style={{ gap: 2 }}>
                <div className="mono" style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>{MOCK.SPRINT.daysLeft}d</div>
                <div className="muted" style={{ fontSize: 'var(--fs-2xs)' }}>left</div>
              </div>
            </div>
            <Segmented value="board" onChange={() => {}}
              options={[{ value: 'board', label: 'Board' }, { value: 'list', label: 'List' }, { value: 'cal', label: 'Calendar' }]} />
            <Button variant="ai" size="sm" icon={<I.Sparkle size={13} stroke={2.4} />}>Suggest sprint replan</Button>
            <Button variant="primary" icon={<I.Plus size={14} />}>New task</Button>
          </div>
        </div>
      </div>

      <div className="row gap-4" style={{ marginBottom: 'var(--s-6)' }}>
        <Chip>Epic: All</Chip>
        <Chip>Assignee: All</Chip>
        <Chip>Priority: All</Chip>
        <div style={{ flex: 1 }} />
        <AvatarStack users={MOCK.MEMBERS.slice(0, 5)} max={5} size="sm" />
      </div>

      <div className="kanban" style={{ flex: 1, minHeight: 0 }}>
        {cols.map(c => {
          const items = MOCK.TASKS.filter(t => t.status === c.id);
          const pts = items.reduce((a, b) => a + b.est, 0);
          return (
            <div key={c.id} className="kanban-col">
              <div className="kanban-col-head">
                <div className="kanban-col-title">
                  <span className="kanban-col-title-dot" style={{ background: c.dot }} />
                  <span>{c.name}</span>
                  <span className="muted mono" style={{ fontSize: 'var(--fs-xs)', marginLeft: 4 }}>{items.length}</span>
                </div>
                <div className="row gap-3">
                  <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{pts}p</span>
                  <button className="btn btn-ghost btn-icon-sm"><I.Plus size={12} /></button>
                </div>
              </div>
              <div className="kanban-col-body">
                {items.map(t => {
                  const u = MOCK.userById(t.assignee);
                  const epic = epicById(t.epic);
                  return (
                    <div key={t.id} className="card-task" onClick={() => onOpenItem(t.id)}>
                      <div className="card-task-head">
                        <span className="badge" style={{
                          background: `var(--${epic.color}-soft)`, color: `var(--${epic.color})`,
                          borderColor: `var(--${epic.color}-border)`, fontSize: 'var(--fs-2xs)', height: 18, padding: '0 6px',
                        }}>{epic.name}</span>
                        <span className="card-task-id">{t.id}</span>
                      </div>
                      <div className="card-task-title">{t.title}</div>
                      <div className="card-task-meta">
                        <Priority level={t.priority} label={false} />
                        {t.branch && <Tip text={t.branch}><I.Branch size={11} /></Tip>}
                        {t.comments > 0 && <span className="row gap-2"><I.Comment size={11} />{t.comments}</span>}
                        {t.attach > 0 && <span className="row gap-2"><I.Attach size={11} />{t.attach}</span>}
                        <span className="meta-spacer" />
                        <span className="card-task-est">{t.est}p</span>
                        <Avatar user={u} size="xs" />
                      </div>
                    </div>
                  );
                })}
                {/* AI-drafted hint */}
                {c.id === 'Todo' && (
                  <button className="card-task" style={{
                    borderStyle: 'dashed', background: 'var(--ai-gradient-soft)',
                    borderColor: 'var(--ai-border)',
                  }}>
                    <div className="row gap-3" style={{ color: 'var(--ai-text)', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                      <I.Sparkle size={12} stroke={2.4} />
                      <span>AI drafted 2 more tasks</span>
                      <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }}>Review →</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

window.SprintKanban = SprintKanban;
