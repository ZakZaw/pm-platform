// Messages / Meetings — lighter stubs to round out the shell.

const Messages = () => {
  const channels = [
    { id: 'apollo', name: '#apollo', sub: 'project', unread: 4 },
    { id: 'standup', name: '#standup-eng', sub: 'team', unread: 0 },
    { id: 'design', name: '#design-crit', sub: 'topic', unread: 2 },
    { id: 'sales', name: '#orbital-deals', sub: 'project', unread: 0 },
    { id: 'general', name: '#general', sub: 'org', unread: 0 },
  ];
  const [active, setActive] = useState('apollo');

  return (
    <div className="main-inner" style={{ padding: 0, height: '100%', display: 'flex' }}>
      {/* Channel list */}
      <aside style={{ width: 240, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', padding: 'var(--s-5) var(--s-4)', overflowY: 'auto' }}>
        <div className="eyebrow" style={{ padding: '0 var(--s-4) var(--s-3)' }}>Channels</div>
        {channels.map(c => (
          <button key={c.id} className={`nav-item ${active === c.id ? 'is-active' : ''}`} onClick={() => setActive(c.id)}>
            <I.Hash size={14} className="nav-icon" />
            <span>{c.name}</span>
            {c.unread > 0 && <span className="nav-count" style={{ background: 'var(--accent)', color: 'white' }}>{c.unread}</span>}
          </button>
        ))}
        <div className="eyebrow" style={{ padding: 'var(--s-5) var(--s-4) var(--s-3)' }}>Direct messages</div>
        {MOCK.MEMBERS.slice(0,4).map(m => (
          <button key={m.id} className="nav-item">
            <Avatar user={m} size="xs" />
            <span>{m.name}</span>
          </button>
        ))}
      </aside>

      {/* Thread */}
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="row between" style={{ padding: 'var(--s-5) var(--s-7)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <strong style={{ fontSize: 'var(--fs-lg)' }}>#apollo</strong>
            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>5 members · pinned: launch checklist</div>
          </div>
          <div className="row gap-3">
            <Button size="sm" variant="ghost" icon={<I.Search size={12} />} />
            <Button size="sm" variant="ghost" icon={<I.Pin size={12} />} />
            <Button size="sm" icon={<I.Video size={12} />}>Start meeting</Button>
          </div>
        </div>

        <div className="col gap-6" style={{ flex: 1, overflowY: 'auto', padding: 'var(--s-7)' }}>
          {[
            { who: 'u2', t: '9:14 AM', body: 'Pushing magic-link branch through review today. Anyone got bandwidth for a code review?' },
            { who: 'u4', t: '9:16 AM', body: 'I can take it after my standup. Drop the PR.' },
            { who: 'u2', t: '9:18 AM', body: 'Thanks. Linking the task: [[task:APL-241]]', card: true },
            { who: 'ai', t: '9:19 AM', body: 'I noticed APL-241 has been In Progress for 4 days. Want me to add a daily check-in reminder until it merges?' },
            { who: 'u1', t: '9:22 AM', body: 'Skip the reminder — Noor handles it.' },
          ].map((m, i) => {
            if (m.who === 'ai') return (
              <div key={i} className="row gap-4">
                <div className="ai-mark" style={{ width: 32, height: 32 }}><I.Sparkle size={14} stroke={2.4} /></div>
                <div style={{ flex: 1 }}>
                  <div className="row gap-3" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>AI assistant</strong>
                    <AIChip icon={false}>suggestion</AIChip>
                    <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{m.t}</span>
                  </div>
                  <div style={{ padding: 'var(--s-4) var(--s-5)', borderRadius: 'var(--r-md)', background: 'var(--ai-gradient-soft)', border: '1px solid var(--ai-border)', color: 'var(--ai-text)', fontSize: 'var(--fs-sm)' }}>{m.body}</div>
                </div>
              </div>
            );
            const u = MOCK.userById(m.who);
            return (
              <div key={i} className="row gap-4">
                <Avatar user={u} size="md" />
                <div style={{ flex: 1 }}>
                  <div className="row gap-3" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>{u.name}</strong>
                    <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{m.t}</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.55 }}>{m.body}</div>
                  {m.card && (
                    <div className="card" style={{ marginTop: 'var(--s-3)', padding: 'var(--s-4) var(--s-5)', maxWidth: 420 }}>
                      <div className="row gap-3" style={{ marginBottom: 4 }}>
                        <span className="mono muted" style={{ fontSize: 'var(--fs-xs)' }}>APL-241</span>
                        <Status status="In Progress" />
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>Magic-link email template + retry logic</div>
                      <div className="row gap-3" style={{ marginTop: 'var(--s-3)' }}>
                        <Avatar user={MOCK.userById('u3')} size="xs" />
                        <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Theo Park · 5 pts</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div style={{ padding: 'var(--s-5) var(--s-7)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="row gap-3" style={{ padding: 'var(--s-3) var(--s-4)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)' }}>
            <input className="input" placeholder="Message #apollo · type / for AI" style={{ border: 0, height: 32, padding: '0 var(--s-3)', background: 'transparent' }} />
            <Button size="sm" variant="ghost" icon={<I.Attach size={12} />} />
            <Button size="sm" variant="ai" icon={<I.Sparkle size={11} stroke={2.4} />}>AI</Button>
            <Button size="sm" variant="primary" icon={<I.Send size={12} />}>Send</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Meetings = ({ setPage }) => {
  const meetings = [
    { id: 'm1', title: 'Apollo · Sprint 24 planning', when: 'Today · 10:00 AM', dur: '15m', attendees: ['u1','u2','u3','u4','u5'], live: true },
    { id: 'm2', title: 'Q3 sales pipeline review', when: 'Today · 2:00 PM', dur: '45m', attendees: ['u1','u6'] },
    { id: 'm3', title: 'Brand refresh — final review', when: 'Tomorrow · 11:00 AM', dur: '30m', attendees: ['u8','u5','u1'] },
    { id: 'm4', title: 'Customer interview — Helix', when: 'Tomorrow · 3:30 PM', dur: '45m', attendees: ['u1','u7'] },
  ];
  return (
    <div className="main-inner">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Workspace</div>
            <h1 className="page-title">Meetings</h1>
            <p className="page-subtitle" style={{ marginTop: 8 }}>Live transcription · AI summary · auto-drafted action items</p>
          </div>
          <Button variant="primary" icon={<I.Plus size={14} />}>Schedule</Button>
        </div>
      </div>

      <div className="grid-12">
        <div className="col-8 col gap-5">
          {meetings.map(m => (
            <div key={m.id} className={`card ${m.live ? '' : ''}`}>
              <div className="card-body row gap-5">
                <div className="col center" style={{ width: 56, padding: 'var(--s-4)', background: m.live ? 'var(--ai-gradient-soft)' : 'var(--surface-2)', borderRadius: 'var(--r-md)', gap: 2 }}>
                  <I.Video size={16} style={{ color: m.live ? 'var(--ai-text)' : 'var(--text-muted)' }} />
                  <span className="mono" style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600 }}>{m.dur}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="row gap-3" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 'var(--fs-md)' }}>{m.title}</strong>
                    {m.live && <Badge tone="danger" dot>Live</Badge>}
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{m.when}</div>
                </div>
                <AvatarStack users={m.attendees.map(MOCK.userById)} max={4} size="sm" />
                <Button variant={m.live ? 'ai' : ''} size="sm" icon={m.live ? <I.Play size={12} /> : null} onClick={() => m.live && setPage && setPage('meeting-room')}>
                  {m.live ? 'Join' : 'Open'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="col-4">
          <div className="ai-card">
            <div className="ai-card-body">
              <div className="row gap-4" style={{ marginBottom: 'var(--s-4)' }}>
                <div className="ai-mark"><I.Mic size={14} stroke={2.4} /></div>
                <strong>Last meeting summary</strong>
              </div>
              <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-5)' }}>
                <strong style={{ color: 'var(--text)' }}>Apollo planning · 38m</strong><br />
                Discussed magic-link rollout phasing. Decided to ship to 5% beta first. 4 action items, 2 risks identified.
              </p>
              <div className="col gap-2" style={{ marginBottom: 'var(--s-5)' }}>
                {['Theo — verify SSO mapping by Wed', 'Maya — push retry-logic PR', 'Aria — review with security', 'Noor — schedule beta rollout'].map((a, i) => (
                  <div key={i} className="row gap-3" style={{ fontSize: 'var(--fs-sm)' }}>
                    <input className="cb" type="checkbox" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
              <Button variant="ai" size="sm" icon={<I.Play size={12} />} onClick={() => setPage && setPage('meeting-room')}>Join live meeting</Button>
              <Button size="sm" icon={<I.Play size={12} />}>Replay with chapters</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Messages, Meetings });
