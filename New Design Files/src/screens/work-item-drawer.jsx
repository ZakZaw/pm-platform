// Work-item Drawer — polymorphic by project type.
// Engineering: task; Sales: deal; Support: ticket; Marketing: asset.

const WorkItemDrawer = ({ open, onClose, project, projectType, itemId }) => {
  if (!open) return null;

  // Pick the right detail content
  let body = null;
  if (projectType.id === 'engineering') {
    const t = MOCK.TASKS.find(x => x.id === itemId) || MOCK.TASKS[0];
    body = <TaskDetail task={t} />;
  } else if (projectType.id === 'sales') {
    const d = MOCK.DEALS.find(x => x.id === itemId) || MOCK.DEALS[5];
    body = <DealDetail deal={d} />;
  } else if (projectType.id === 'support') {
    const k = MOCK.TICKETS.find(x => x.id === itemId) || MOCK.TICKETS[0];
    body = <TicketDetail ticket={k} />;
  } else if (projectType.id === 'marketing') {
    body = <AssetDetail />;
  } else {
    body = <TaskDetail task={MOCK.TASKS[0]} generic />;
  }

  return (
    <Drawer open={open} onClose={onClose}>
      {body}
      <div className="row gap-3" style={{ padding: 'var(--s-4) var(--s-6)', borderTop: '1px solid var(--divider)' }}>
        <Button variant="ai" size="sm" icon={<I.Sparkle size={11} stroke={2.4} />}>Ask AI about this</Button>
        <div className="divider-v" style={{ height: 20, margin: '0 var(--s-2)' }} />
        <Button variant="ghost" size="sm" icon={<I.Comment size={12} />}>Comment</Button>
        <Button variant="ghost" size="sm" icon={<I.Attach size={12} />}>Attach</Button>
        <Button variant="ghost" size="sm" icon={<I.Link size={12} />}>Link</Button>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
    </Drawer>
  );
};

// === TASK DETAIL (Engineering) =============================
const TaskDetail = ({ task, generic }) => {
  const u = MOCK.userById(task.assignee);
  const epic = MOCK.EPICS.find(e => e.id === task.epic);
  return (
    <>
      <div className="drawer-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-3" style={{ marginBottom: 'var(--s-3)' }}>
            <span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{task.id}</span>
            {!generic && epic && <Badge tone="violet">{epic.name}</Badge>}
            {task.branch && <Badge><I.Branch size={10} /> {task.branch}</Badge>}
          </div>
          <h2 className="h-card" style={{ fontSize: 'var(--fs-xl)', lineHeight: 1.25 }}>{task.title}</h2>
        </div>
        <div className="row gap-3">
          <Button variant="ghost" size="sm" icon={<I.Eye size={12} />}>4</Button>
          <Button variant="ghost" size="sm" icon={<I.More size={12} />} />
          <button className="btn btn-ghost btn-icon-sm" onClick={() => {}}><I.X size={14} /></button>
        </div>
      </div>
      <div className="drawer-body">
        <div className="col gap-2" style={{ marginBottom: 'var(--s-7)' }}>
          <div className="drawer-prop"><span className="label-key">Status</span><Status status={task.status} /></div>
          <div className="drawer-prop"><span className="label-key">Priority</span><Priority level={task.priority} /></div>
          <div className="drawer-prop"><span className="label-key">Assignee</span><div className="row gap-3"><Avatar user={u} size="sm" /><span>{u.name}</span></div></div>
          <div className="drawer-prop"><span className="label-key">Estimate</span><span className="mono">{task.est} points · 78% conf</span></div>
          <div className="drawer-prop"><span className="label-key">Sprint</span><span>Sprint 24 (6d left)</span></div>
          <div className="drawer-prop"><span className="label-key">Reporter</span><div className="row gap-3"><Avatar user={MOCK.userById('u1')} size="sm" /><span>Aria Chen</span></div></div>
        </div>

        {/* AI breakdown */}
        <div className="ai-card" style={{ marginBottom: 'var(--s-7)' }}>
          <div className="ai-card-body">
            <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
              <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
              <strong>AI breakdown</strong>
              <span style={{ marginLeft: 'auto' }}><AIChip icon={false}>78% confidence</AIChip></span>
            </div>
            <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-4)', lineHeight: 1.6 }}>
              Generate one-time magic links, send via transactional email, handle resend + token expiry + rate-limiting per user.
            </div>
            <div className="eyebrow" style={{ marginBottom: 'var(--s-3)' }}>Acceptance criteria</div>
            <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 'var(--fs-sm)', lineHeight: 1.7 }}>
              <li>Magic link expires after 15 minutes</li>
              <li>Rate limit 5 requests / 10 min per email</li>
              <li>Retry button with exponential backoff</li>
              <li>Telemetry for delivery + open + click</li>
            </ul>
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 'var(--s-3)' }}>Activity</div>
        <div className="col gap-4">
          {[
            { ai: true, who: 'AI', t: '12m ago', body: 'Estimated 5 points based on similar auth flow tasks (APL-104, APL-189).' },
            { who: 'Maya Singh', t: '34m ago', body: 'Opened PR #482 — feat/magic-link' },
            { who: 'Theo Park', t: '2h ago', body: 'Linked external ref: stripe.com/docs/magic-link-best-practices' },
          ].map((a, i) => (
            <div key={i} className="row gap-4">
              {a.ai
                ? <div className="ai-mark" style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)' }}><I.Sparkle size={11} stroke={2.4} /></div>
                : <Avatar user={MOCK.MEMBERS.find(m => m.name === a.who) || MOCK.userById('u2')} size="sm" />}
              <div style={{ flex: 1 }}>
                <div className="row gap-3" style={{ marginBottom: 2 }}>
                  <strong style={{ fontSize: 'var(--fs-sm)' }}>{a.who}</strong>
                  <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{a.t}</span>
                </div>
                <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{a.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// === DEAL DETAIL (Sales) ===================================
const DealDetail = ({ deal }) => {
  const owner = MOCK.userById(deal.owner);
  const fmt = (n) => '$' + (n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : n);
  const stageProgress = ['prospect','qualified','proposal','negotiation','won'];
  const stageIdx = stageProgress.indexOf(deal.stage);
  return (
    <>
      <div className="drawer-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-3" style={{ marginBottom: 'var(--s-3)' }}>
            <span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{deal.id}</span>
            <Badge tone="success">{deal.company}</Badge>
          </div>
          <h2 className="h-card" style={{ fontSize: 'var(--fs-xl)', lineHeight: 1.25 }}>{deal.name}</h2>
          <div className="row gap-5" style={{ marginTop: 'var(--s-3)' }}>
            <div className="mono" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt(deal.amount)}</div>
            <div className="col" style={{ gap: 0 }}>
              <div className="muted" style={{ fontSize: 'var(--fs-2xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>Close</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{deal.close}</div>
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon-sm"><I.X size={14} /></button>
      </div>
      <div className="drawer-body">
        {/* Stage tracker */}
        <div style={{ marginBottom: 'var(--s-7)' }}>
          <div className="eyebrow" style={{ marginBottom: 'var(--s-3)' }}>Stage</div>
          <div className="row" style={{ gap: 4 }}>
            {stageProgress.map((s, i) => (
              <div key={s} className="col" style={{ flex: 1, gap: 4 }}>
                <div style={{
                  height: 4, borderRadius: 999,
                  background: i <= stageIdx ? MOCK.DEAL_STAGES.find(x=>x.id===s).hue : 'var(--surface-2)',
                }} />
                <div style={{ fontSize: 'var(--fs-xs)', color: i <= stageIdx ? 'var(--text)' : 'var(--text-subtle)', fontWeight: i === stageIdx ? 600 : 400 }}>
                  {MOCK.DEAL_STAGES.find(x=>x.id===s).name}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col gap-2" style={{ marginBottom: 'var(--s-7)' }}>
          <div className="drawer-prop"><span className="label-key">Owner</span><div className="row gap-3"><Avatar user={owner} size="sm" /><span>{owner.name}</span></div></div>
          <div className="drawer-prop"><span className="label-key">Source</span><span>Outbound · Email</span></div>
          <div className="drawer-prop"><span className="label-key">Champion</span><span>Mia Patel · VP Engineering</span></div>
          <div className="drawer-prop"><span className="label-key">Forecast</span><Badge tone="success">Commit</Badge></div>
          <div className="drawer-prop"><span className="label-key">Probability</span><div className="row gap-3"><div className="bar" style={{ width: 80 }}><div className="bar-fill" style={{ width: '60%' }} /></div><span className="mono" style={{ fontSize: 'var(--fs-xs)' }}>60%</span></div></div>
        </div>

        <div className="ai-card" style={{ marginBottom: 'var(--s-7)' }}>
          <div className="ai-card-body">
            <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
              <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
              <strong>AI deal coach</strong>
            </div>
            <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-5)', lineHeight: 1.6 }}>
              Stalled 9 days in Proposal — median time-in-stage is 4d. Quote sent Mon, no response.
            </div>
            <div className="col gap-2">
              <Button variant="ai" size="sm" icon={<I.Mail size={12} />}>Draft check-in email</Button>
              <Button size="sm">Suggest discount tiers</Button>
            </div>
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 'var(--s-3)' }}>Recent activity</div>
        <div className="col gap-4">
          {[
            { icon: <I.Mail />, t: 'Aug 2', body: 'Sent proposal — Cobalt-pricing-v2.pdf' },
            { icon: <I.Phone />, t: 'Jul 28', body: 'Discovery call — 45 min · transcribed' },
            { icon: <I.Sparkle />, ai: true, t: 'Jul 25', body: 'Drafted account research — competitors, tech stack' },
          ].map((a, i) => (
            <div key={i} className="row gap-4">
              <div style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', background: a.ai ? 'var(--ai-gradient)' : 'var(--surface-2)', color: a.ai ? 'white' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{React.cloneElement(a.icon, { size: 12 })}</div>
              <div style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>{a.body}</div>
              <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{a.t}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// === TICKET DETAIL (Support) ===============================
const TicketDetail = ({ ticket }) => {
  return (
    <>
      <div className="drawer-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-3" style={{ marginBottom: 'var(--s-3)' }}>
            <span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>{ticket.id}</span>
            <Priority level={ticket.priority} />
            <Status status={ticket.status} />
            <span className={`sla is-${ticket.slaState}`}><span className="sla-dot" /><span>SLA {ticket.sla}</span></span>
          </div>
          <h2 className="h-card" style={{ fontSize: 'var(--fs-xl)', lineHeight: 1.3 }}>{ticket.subject}</h2>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>{ticket.customer}</div>
        </div>
        <button className="btn btn-ghost btn-icon-sm"><I.X size={14} /></button>
      </div>
      <div className="drawer-body">
        <div className="ai-card" style={{ marginBottom: 'var(--s-7)' }}>
          <div className="ai-card-body">
            <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
              <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
              <strong>AI suggestions</strong>
              <span style={{ marginLeft: 'auto' }}><AIChip icon={false}>3 similar tickets</AIChip></span>
            </div>
            <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-5)', lineHeight: 1.6 }}>
              This matches 3 other recent SSO loop tickets after Okta config changes. Suggested resolution: clear session cookies + re-link IdP.
            </div>
            <div className="row gap-3">
              <Button variant="ai" size="sm">Reply with template</Button>
              <Button size="sm">Link to bug task</Button>
            </div>
          </div>
        </div>

        <div className="col gap-5">
          {[
            { who: ticket.customer.split(' · ')[0], t: '4m ago', incoming: true, body: 'Same issue happened to two more people on my team this morning. We need this resolved ASAP — can you escalate?' },
            { who: 'AI (suggested reply)', ai: true, t: '3m ago', body: 'Hi Sara — totally hear the urgency. I\'m escalating this to engineering now. As a temporary workaround, please ask affected users to clear their browser cookies for our domain and re-authenticate via Okta…' },
            { who: 'Lin Wei', t: '32m ago', body: 'Created bug task APL-260 and looped in Theo. Will follow up here within 1 hour.' },
            { who: ticket.customer.split(' · ')[0], t: '1h ago', incoming: true, body: 'After we rotated Okta certs yesterday, users get stuck in an infinite redirect loop on /sso/callback. Have already cleared cache.' },
          ].map((c, i) => (
            <div key={i} className="row gap-4" style={{ flexDirection: c.incoming ? 'row' : 'row-reverse' }}>
              {c.ai
                ? <div className="ai-mark" style={{ width: 28, height: 28 }}><I.Sparkle size={12} stroke={2.4} /></div>
                : <Avatar user={MOCK.userById(c.incoming ? 'u4' : 'u7')} size="md" />}
              <div style={{ flex: 1, maxWidth: '76%' }}>
                <div className="row gap-3" style={{ marginBottom: 4, justifyContent: c.incoming ? 'flex-start' : 'flex-end' }}>
                  <strong style={{ fontSize: 'var(--fs-sm)' }}>{c.who}</strong>
                  <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{c.t}</span>
                </div>
                <div style={{
                  padding: 'var(--s-4) var(--s-5)', borderRadius: 'var(--r-md)',
                  background: c.ai ? 'var(--ai-gradient-soft)' : c.incoming ? 'var(--surface-2)' : 'var(--accent-soft)',
                  border: c.ai ? '1px solid var(--ai-border)' : '1px solid var(--border-subtle)',
                  fontSize: 'var(--fs-sm)', lineHeight: 1.55,
                  color: c.ai ? 'var(--ai-text)' : 'var(--text)',
                }}>{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// === ASSET DETAIL (Marketing) ==============================
const AssetDetail = () => (
  <>
    <div className="drawer-head">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-3" style={{ marginBottom: 'var(--s-3)' }}>
          <Badge tone="info"><I.Hash size={10} />Blog</Badge>
          <Badge>Apollo Launch</Badge>
        </div>
        <h2 className="h-card" style={{ fontSize: 'var(--fs-xl)', lineHeight: 1.3 }}>How AI plans your sprints — deep dive</h2>
        <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>Scheduled · Jul 8, 9:00 AM</div>
      </div>
      <button className="btn btn-ghost btn-icon-sm"><I.X size={14} /></button>
    </div>
    <div className="drawer-body">
      <div style={{ marginBottom: 'var(--s-7)' }}>
        <div style={{
          aspectRatio: '16 / 9', borderRadius: 'var(--r-md)',
          background: 'repeating-linear-gradient(45deg, var(--surface-2) 0px, var(--surface-2) 14px, var(--bg-subtle) 14px, var(--bg-subtle) 28px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)',
        }}>cover image · 1600×900</div>
      </div>
      <div className="col gap-2" style={{ marginBottom: 'var(--s-7)' }}>
        <div className="drawer-prop"><span className="label-key">Channels</span><div className="row gap-2"><Chip>Blog</Chip><Chip>Newsletter</Chip><Chip>LinkedIn</Chip></div></div>
        <div className="drawer-prop"><span className="label-key">Owner</span><div className="row gap-3"><Avatar user={MOCK.userById('u8')} size="sm" /><span>Kai Holm</span></div></div>
        <div className="drawer-prop"><span className="label-key">Status</span><Status status="In Review" /></div>
        <div className="drawer-prop"><span className="label-key">Target reach</span><span className="mono">12k</span></div>
      </div>

      <div className="ai-card">
        <div className="ai-card-body">
          <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
            <div className="ai-mark"><I.Sparkle size={14} stroke={2.4} /></div>
            <strong>AI brief generated</strong>
          </div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>
            Angle: explain how our planner learns from past sprints, with three concrete velocity wins. Include code-level screenshots, 1100 words, CTA to free trial.
          </div>
        </div>
      </div>
    </div>
  </>
);

Object.assign(window, { WorkItemDrawer });
