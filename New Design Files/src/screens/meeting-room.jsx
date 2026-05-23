// Meeting Room — live in-meeting experience with AI co-pilot.
// Video tiles + live transcript + AI-drafted action items + chat — switchable right panel.

const MeetingRoom = () => {
  const [panel, setPanel] = useState('transcript'); // transcript | actions | chat | notes
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Live timer (00:00:00)
  const elapsed = 18 * 60 + 32 + now; // 18:32 + ticks
  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // 5 participants — one is speaking (Noor)
  const tiles = [
    { user: MOCK.userById('u2'), speaking: true,  role: 'Host', cam: true },
    { user: MOCK.userById('u3'), speaking: false, role: 'Eng',  cam: true },
    { user: MOCK.userById('u4'), speaking: false, role: 'Eng',  cam: false },
    { user: MOCK.userById('u1'), speaking: false, role: 'PM',   cam: true, self: true },
    { user: MOCK.userById('u5'), speaking: false, role: 'Design', cam: true },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: '52px 1fr 76px',
      height: '100%',
      background: 'hsl(222 25% 6%)',
      color: 'hsl(30 25% 96%)',
    }}>
      {/* Top bar */}
      <MeetingTopBar elapsed={elapsed} fmt={fmtTime} />

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', minHeight: 0 }}>
        <VideoStage tiles={tiles} />
        <MeetingSidePanel panel={panel} setPanel={setPanel} elapsed={elapsed} fmt={fmtTime} />
      </div>

      {/* Controls */}
      <MeetingControls muted={muted} setMuted={setMuted} cameraOn={cameraOn} setCameraOn={setCameraOn} />
    </div>
  );
};

// === TOP BAR =============================================
const MeetingTopBar = ({ elapsed, fmt }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    padding: '0 var(--s-7)',
    borderBottom: '1px solid hsl(222 15% 18%)',
    background: 'hsl(222 25% 7%)',
    gap: 'var(--s-6)',
  }}>
    <div className="row gap-4">
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 9px',
        background: 'hsl(354 78% 50% / 0.18)',
        border: '1px solid hsl(354 78% 50% / 0.4)',
        color: 'hsl(354 90% 78%)',
        borderRadius: 999,
        fontSize: 'var(--fs-2xs)',
        fontWeight: 600,
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: 'hsl(354 90% 65%)',
          animation: 'rec-pulse 1.6s ease-in-out infinite' }} />
        Recording
      </span>
      <strong style={{ fontSize: 'var(--fs-md)' }}>Apollo · Sprint 24 planning</strong>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'hsl(220 8% 60%)' }} className="mono">{fmt(elapsed)}</span>
    </div>
    <div style={{ flex: 1 }} />
    <div className="row gap-3">
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px 4px 8px',
        background: 'linear-gradient(120deg, hsl(222 65% 25%) 0%, hsl(264 60% 28%) 50%, hsl(192 65% 25%) 100%)',
        border: '1px solid hsl(258 55% 38%)',
        borderRadius: 999,
        fontSize: 'var(--fs-2xs)',
        fontWeight: 600,
        color: 'hsl(258 90% 82%)',
      }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--ai-gradient)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <I.Sparkle size={9} stroke={2.4} style={{ color: 'white' }} />
        </span>
        AI listening · 4 actions captured
      </span>
      <button className="btn btn-icon-sm" style={{ background: 'hsl(222 22% 14%)', border: '1px solid hsl(222 15% 22%)', color: 'inherit' }}>
        <I.Users size={13} />
      </button>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'hsl(220 8% 65%)' }}>5</span>
    </div>
    <style>{`@keyframes rec-pulse { 50% { opacity: 0.3; } }`}</style>
  </div>
);

// === VIDEO TILE STAGE ====================================
const VideoStage = ({ tiles }) => {
  // 1 large speaker tile + 4 smaller tiles row
  const speaker = tiles.find(t => t.speaking);
  const others = tiles.filter(t => t !== speaker);

  return (
    <div style={{ padding: 'var(--s-6)', display: 'grid', gridTemplateRows: '1fr 140px', gap: 'var(--s-5)', minHeight: 0 }}>
      <VideoTile {...speaker} size="lg" />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${others.length}, 1fr)`, gap: 'var(--s-4)' }}>
        {others.map(t => <VideoTile key={t.user.id} {...t} size="sm" />)}
      </div>
    </div>
  );
};

const VideoTile = ({ user, speaking, role, cam, self, size }) => {
  // Use a deterministic gradient per-user for the "video" backdrop (placeholder)
  const seed = user.color;
  const bg1 = `hsl(${seed * 45} 40% ${24 + seed * 2}%)`;
  const bg2 = `hsl(${seed * 45 + 30} 35% ${14 + seed * 2}%)`;
  return (
    <div style={{
      position: 'relative',
      borderRadius: size === 'lg' ? 16 : 10,
      background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`,
      overflow: 'hidden',
      boxShadow: speaking ? '0 0 0 3px hsl(160 65% 50%), 0 8px 24px -6px hsl(160 80% 30% / 0.4)' : '0 8px 24px -10px hsl(0 0% 0% / 0.5)',
      transition: 'box-shadow 220ms',
      minHeight: 0,
    }}>
      {/* Video / avatar fallback */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cam ? (
          // Fake video feed — silhouette + soft accent
          <div style={{
            width: size === 'lg' ? 160 : 80,
            height: size === 'lg' ? 160 : 80,
            borderRadius: '50%',
            background: `radial-gradient(circle at 50% 35%, hsl(${seed * 45} 60% 60%), hsl(${seed * 45} 50% 35%))`,
            border: '3px solid hsl(0 0% 100% / 0.08)',
            boxShadow: 'inset 0 -20px 40px hsl(0 0% 0% / 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'hsl(0 0% 100% / 0.92)',
            fontSize: size === 'lg' ? 56 : 28,
            fontWeight: 700, fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.02em',
          }}>
            {user.initials}
          </div>
        ) : (
          <div className="col center" style={{ gap: 12 }}>
            <div style={{
              width: size === 'lg' ? 72 : 44, height: size === 'lg' ? 72 : 44,
              borderRadius: '50%',
              background: 'hsl(0 0% 100% / 0.08)',
              border: '1px solid hsl(0 0% 100% / 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'hsl(0 0% 100% / 0.5)',
            }}>
              <I.Video size={size === 'lg' ? 30 : 18} />
            </div>
            {size === 'lg' && <span style={{ fontSize: 'var(--fs-xs)', color: 'hsl(0 0% 100% / 0.5)' }}>Camera off</span>}
          </div>
        )}
      </div>

      {/* Name + state pill */}
      <div style={{
        position: 'absolute', left: size === 'lg' ? 16 : 8, bottom: size === 'lg' ? 16 : 8,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px 4px 8px',
        background: 'hsl(0 0% 0% / 0.55)',
        backdropFilter: 'blur(8px)',
        borderRadius: 999,
        fontSize: size === 'lg' ? 'var(--fs-sm)' : 'var(--fs-xs)',
        fontWeight: 500,
        color: 'white',
      }}>
        {speaking && (
          <Soundbars />
        )}
        <span>{user.name}{self && ' (you)'}</span>
      </div>

      {/* Muted indicator (top-right) */}
      {!speaking && (
        <div style={{
          position: 'absolute', right: size === 'lg' ? 16 : 8, top: size === 'lg' ? 16 : 8,
          width: size === 'lg' ? 28 : 22, height: size === 'lg' ? 28 : 22,
          borderRadius: '50%',
          background: 'hsl(354 78% 50% / 0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white',
        }}>
          <I.Mic size={size === 'lg' ? 13 : 10} />
          <span style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: size === 'lg' ? 22 : 16,
            transform: 'rotate(-25deg)',
          }}>/</span>
        </div>
      )}

      {/* Role badge for speaker tile */}
      {size === 'lg' && (
        <div style={{
          position: 'absolute', top: 16, left: 16,
          padding: '4px 10px',
          background: 'hsl(0 0% 0% / 0.5)', backdropFilter: 'blur(8px)',
          borderRadius: 999, fontSize: 'var(--fs-2xs)', fontWeight: 600,
          color: 'hsl(0 0% 100% / 0.85)',
          textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)',
        }}>
          {role} · speaking
        </div>
      )}
    </div>
  );
};

const Soundbars = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: 12 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width: 2, background: 'hsl(160 65% 60%)', borderRadius: 1,
        animation: `soundbar 0.8s ${i * 0.12}s ease-in-out infinite`,
      }} />
    ))}
    <style>{`@keyframes soundbar { 0%, 100% { height: 4px; } 50% { height: 11px; } }`}</style>
  </span>
);

// === SIDE PANEL ==========================================
const MeetingSidePanel = ({ panel, setPanel, elapsed, fmt }) => {
  return (
    <div style={{
      background: 'hsl(222 22% 9%)',
      borderLeft: '1px solid hsl(222 15% 18%)',
      display: 'flex', flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', padding: '12px 16px 0',
        gap: 4, borderBottom: '1px solid hsl(222 15% 18%)',
      }}>
        {[
          { id: 'transcript', label: 'Transcript', icon: <I.Mic size={12} /> },
          { id: 'actions', label: 'Actions', icon: <I.Sparkle size={12} stroke={2.4} />, badge: 4, ai: true },
          { id: 'chat', label: 'Chat', icon: <I.Comment size={12} /> },
          { id: 'notes', label: 'Notes', icon: <I.Edit size={12} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setPanel(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 12px',
            color: panel === t.id ? 'white' : 'hsl(220 8% 65%)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 500,
            borderBottom: panel === t.id ? `2px solid ${t.ai ? 'hsl(264 80% 70%)' : 'var(--accent-bright)'}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'color 140ms',
            position: 'relative',
          }}>
            {t.icon}
            <span>{t.label}</span>
            {t.badge != null && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: t.ai ? 'var(--ai-gradient)' : 'var(--accent)',
                color: 'white',
                padding: '1px 5px',
                borderRadius: 999,
                marginLeft: 2,
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {panel === 'transcript' && <TranscriptPanel elapsed={elapsed} fmt={fmt} />}
        {panel === 'actions' && <ActionsPanel />}
        {panel === 'chat' && <ChatPanel />}
        {panel === 'notes' && <NotesPanel />}
      </div>
    </div>
  );
};

// === TRANSCRIPT ==========================================
const TranscriptPanel = ({ elapsed, fmt }) => {
  const lines = [
    { who: 'u2', t: 6,   body: "Okay, picking up where we left off. The magic-link branch is in review — Maya, can you cover where we are with the retry logic?" },
    { who: 'u4', t: 24,  body: "Yeah, the retry path works end-to-end but I'm still seeing edge cases on iOS when the link is tapped from a non-default mail client." },
    { who: 'u3', t: 58,  body: "That sounds like the same universal-link issue we hit in S22. I can pair on it tomorrow morning." },
    { who: 'u2', t: 95,  body: "Let's do that. Aria — any concerns from product side?", highlight: 'decision' },
    { who: 'u1', t: 108, body: "My only worry is timing. We're 6 days out and APL-246 is still blocked on legal SSO clearance. Should we cut it from this sprint?" },
    { who: 'u2', t: 142, body: "I think we have to. AI already flagged it earlier this morning.", highlight: 'action' },
    { who: 'u3', t: 158, body: "Agreed. I'll move 246 to Sprint 25 and pull APL-251 forward.", highlight: 'action' },
    { who: 'ai', t: 165, body: "Captured: move APL-246 to Sprint 25, pull APL-251 into Sprint 24. Want me to apply now?", aiAction: true },
    { who: 'u5', t: 188, body: "Quick design note — the empty-state illustrations are ready for review. I'll drop them in #design-crit." },
  ];

  return (
    <div style={{ padding: 'var(--s-5) var(--s-6)' }}>
      <div style={{ position: 'sticky', top: 0, background: 'hsl(222 22% 9%)', paddingBottom: 'var(--s-4)', marginBottom: 'var(--s-4)', zIndex: 1 }}>
        <div className="row gap-3">
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 8px',
            background: 'hsl(160 65% 40% / 0.18)',
            border: '1px solid hsl(160 65% 40% / 0.4)',
            color: 'hsl(160 60% 70%)',
            borderRadius: 999,
            fontSize: 'var(--fs-2xs)',
            fontWeight: 600,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'hsl(160 65% 55%)' }} />
            Live · auto-scrolling
          </span>
          <div style={{ flex: 1 }} />
          <button style={{ color: 'hsl(220 8% 65%)', fontSize: 'var(--fs-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <I.Search size={11} /> Find
          </button>
        </div>
      </div>

      <div className="col gap-5">
        {lines.map((l, i) => {
          if (l.who === 'ai') {
            return (
              <div key={i} className="row gap-3" style={{ alignItems: 'flex-start' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'var(--ai-gradient)',
                  backgroundSize: '200% 200%',
                  animation: 'ai-shimmer 6s ease-in-out infinite',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}><I.Sparkle size={11} stroke={2.4} style={{ color: 'white' }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-3" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 'var(--fs-xs)', color: 'hsl(258 90% 82%)' }}>AI</strong>
                    <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'hsl(220 8% 55%)' }}>{fmt(l.t)}</span>
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    background: 'linear-gradient(120deg, hsl(222 65% 22%) 0%, hsl(264 60% 25%) 50%, hsl(192 65% 22%) 100%)',
                    border: '1px solid hsl(258 55% 38%)',
                    borderRadius: 8,
                    fontSize: 'var(--fs-sm)',
                    color: 'hsl(258 90% 88%)',
                    lineHeight: 1.5,
                  }}>{l.body}</div>
                  {l.aiAction && (
                    <div className="row gap-2" style={{ marginTop: 6 }}>
                      <button style={{
                        padding: '4px 10px', borderRadius: 6,
                        background: 'var(--ai-gradient)', color: 'white',
                        fontSize: 'var(--fs-xs)', fontWeight: 600,
                      }}>Apply now</button>
                      <button style={{
                        padding: '4px 10px', borderRadius: 6,
                        background: 'hsl(222 15% 14%)', color: 'hsl(220 8% 80%)',
                        fontSize: 'var(--fs-xs)', fontWeight: 500,
                      }}>Edit</button>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          const u = MOCK.userById(l.who);
          return (
            <div key={i} className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <Avatar user={u} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row gap-3" style={{ marginBottom: 2 }}>
                  <strong style={{ fontSize: 'var(--fs-xs)' }}>{u.name}</strong>
                  <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'hsl(220 8% 55%)' }}>{fmt(l.t)}</span>
                  {l.highlight === 'decision' && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'hsl(264 70% 30%)', color: 'hsl(264 80% 85%)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Decision</span>
                  )}
                  {l.highlight === 'action' && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'hsl(35 90% 35%)', color: 'hsl(35 95% 85%)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Action</span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.55, color: 'hsl(30 15% 88%)' }}>{l.body}</div>
              </div>
            </div>
          );
        })}
        {/* Live caption indicator */}
        <div className="row gap-3" style={{ opacity: 0.6 }}>
          <Avatar user={MOCK.userById('u2')} size="sm" />
          <div style={{ flex: 1 }}>
            <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Noor Idris is speaking…</span>
            <TypingDotsDark />
          </div>
        </div>
      </div>
    </div>
  );
};

const TypingDotsDark = () => (
  <span className="row gap-2" style={{ alignItems: 'center', height: 10, marginTop: 4 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width: 4, height: 4, borderRadius: 999,
        background: 'hsl(160 65% 60%)',
        animation: `typing-dot 1.2s ${i * 0.16}s ease-in-out infinite`,
      }} />
    ))}
  </span>
);

// === ACTIONS PANEL =======================================
const ActionsPanel = () => {
  const actions = [
    { owner: 'u3', text: 'Pair with Maya on iOS universal-link issue', when: 'Tomorrow AM', confidence: 92, ts: '00:58' },
    { owner: 'u3', text: 'Move APL-246 to Sprint 25 (blocked on legal SSO)', when: 'Now', confidence: 98, ts: '02:38', applied: true },
    { owner: 'u3', text: 'Pull APL-251 (JWT v2 migration) into Sprint 24', when: 'Now', confidence: 96, ts: '02:38', applied: true },
    { owner: 'u5', text: 'Share empty-state illustrations in #design-crit', when: 'Today', confidence: 88, ts: '03:08' },
  ];
  const decisions = [
    { text: 'Sprint 24 scope reduced — APL-246 cut, APL-251 pulled in', ts: '02:38' },
    { text: 'Magic-link retry edge cases require iOS pair session', ts: '01:35' },
  ];

  return (
    <div style={{ padding: 'var(--s-5) var(--s-6)' }}>
      <div style={{ marginBottom: 'var(--s-7)' }}>
        <div className="row gap-3" style={{ marginBottom: 'var(--s-4)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 9px',
            background: 'var(--ai-gradient)',
            backgroundSize: '200% 200%',
            animation: 'ai-shimmer 6s ease-in-out infinite',
            color: 'white',
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            <I.Sparkle size={9} stroke={2.4} />
            AI-captured
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'hsl(220 8% 65%)' }}>Tap an action to assign or apply</span>
        </div>

        <div className="eyebrow" style={{ marginBottom: 'var(--s-3)', color: 'hsl(220 8% 55%)' }}>Action items · {actions.length}</div>
        <div className="col gap-2">
          {actions.map((a, i) => {
            const u = MOCK.userById(a.owner);
            return (
              <div key={i} style={{
                padding: '10px 12px',
                background: a.applied ? 'hsl(160 50% 14% / 0.5)' : 'hsl(222 22% 13%)',
                border: '1px solid ' + (a.applied ? 'hsl(160 50% 28%)' : 'hsl(222 15% 22%)'),
                borderRadius: 8,
              }}>
                <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                  <input className="cb" type="checkbox" defaultChecked={a.applied} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'hsl(30 25% 96%)', lineHeight: 1.4 }}>{a.text}</div>
                    <div className="row gap-3" style={{ marginTop: 6, fontSize: 'var(--fs-2xs)', color: 'hsl(220 8% 60%)' }}>
                      <Avatar user={u} size="xs" />
                      <span>{u.name.split(' ')[0]}</span>
                      <span>·</span>
                      <span>{a.when}</span>
                      <span>·</span>
                      <span className="mono">{a.ts}</span>
                      <span style={{ marginLeft: 'auto' }}>{a.confidence}% conf</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 'var(--s-3)', color: 'hsl(220 8% 55%)' }}>Decisions · {decisions.length}</div>
        <div className="col gap-2">
          {decisions.map((d, i) => (
            <div key={i} style={{
              padding: '10px 12px',
              background: 'hsl(264 30% 16% / 0.5)',
              border: '1px solid hsl(264 35% 28%)',
              borderRadius: 8,
            }}>
              <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                <I.Flag size={12} style={{ color: 'hsl(264 80% 75%)', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'hsl(30 25% 96%)', lineHeight: 1.4 }}>{d.text}</div>
                  <div className="mono" style={{ marginTop: 4, fontSize: 'var(--fs-2xs)', color: 'hsl(220 8% 60%)' }}>{d.ts}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        marginTop: 'var(--s-7)',
        padding: 'var(--s-4)',
        background: 'linear-gradient(120deg, hsl(222 65% 18%) 0%, hsl(264 60% 20%) 50%, hsl(192 65% 18%) 100%)',
        border: '1px solid hsl(258 55% 38%)',
        borderRadius: 8,
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'hsl(258 90% 88%)', fontWeight: 500, marginBottom: 4 }}>
          When the meeting ends
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'hsl(258 70% 75%)', lineHeight: 1.5 }}>
          AI will draft an email summary, create the 2 unassigned action items as tasks, and update APL-246 + APL-251.
        </div>
      </div>
    </div>
  );
};

// === CHAT PANEL ==========================================
const ChatPanel = () => {
  const msgs = [
    { who: 'u4', t: '02:14', body: 'Dropping the PR link: github.com/lattice/apollo/pull/482' },
    { who: 'u1', t: '02:32', body: 'Can someone confirm we still need the Okta fallback in S25?' },
    { who: 'u3', t: '02:36', body: '+1 to keeping it for v1' },
    { who: 'u5', t: '03:08', body: '🎨 illustrations: figma.com/file/empty-states-v3' },
  ];
  return (
    <div style={{ padding: 'var(--s-5) var(--s-6)', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="col gap-4" style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--s-5)' }}>
        {msgs.map((m, i) => {
          const u = MOCK.userById(m.who);
          return (
            <div key={i} className="row gap-3">
              <Avatar user={u} size="sm" />
              <div style={{ flex: 1 }}>
                <div className="row gap-3" style={{ marginBottom: 2 }}>
                  <strong style={{ fontSize: 'var(--fs-xs)' }}>{u.name.split(' ')[0]}</strong>
                  <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'hsl(220 8% 55%)' }}>{m.t}</span>
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'hsl(30 15% 88%)' }}>{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        padding: 'var(--s-3)',
        background: 'hsl(222 22% 13%)',
        border: '1px solid hsl(222 15% 22%)',
        borderRadius: 8,
        display: 'flex', gap: 8,
      }}>
        <input
          placeholder="Send to everyone…"
          style={{
            flex: 1, background: 'transparent', border: 0,
            color: 'inherit', fontSize: 'var(--fs-sm)', padding: '4px 6px',
          }}
        />
        <button style={{ color: 'hsl(220 8% 70%)' }}><I.Send size={14} /></button>
      </div>
    </div>
  );
};

const NotesPanel = () => (
  <div style={{ padding: 'var(--s-5) var(--s-6)' }}>
    <div style={{
      padding: 'var(--s-5)',
      background: 'hsl(222 22% 12%)',
      border: '1px solid hsl(222 15% 20%)',
      borderRadius: 8,
      fontSize: 'var(--fs-sm)',
      lineHeight: 1.6,
      color: 'hsl(30 15% 88%)',
      minHeight: 240,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: 'white' }}>Apollo · Sprint 24 planning</div>
      <p style={{ marginBottom: 12, color: 'hsl(220 8% 65%)' }}>July 23 · 5 attendees · 18 min</p>
      <p style={{ marginBottom: 12 }}>Scope debate around magic-link retry edges on iOS. Pair session needed for universal-link handler.</p>
      <p style={{ marginBottom: 12 }}>APL-246 cut from S24 due to legal SSO clearance delay. APL-251 (JWT v2) brought in to backfill.</p>
      <p style={{ color: 'hsl(160 65% 60%)', fontStyle: 'italic' }}>
        💡 AI suggests including velocity context in the email digest — receivers will want to know we're still on track for the launch.
      </p>
    </div>
  </div>
);

// === CONTROLS ============================================
const MeetingControls = ({ muted, setMuted, cameraOn, setCameraOn }) => {
  const Btn = ({ on, off, icon, label, danger, ai, onClick }) => (
    <button onClick={onClick} title={label} style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      gap: 4,
      padding: '6px 10px',
      background: danger ? 'hsl(354 78% 45%)' :
                  ai ? 'var(--ai-gradient)' :
                  on === false ? 'hsl(354 78% 30%)' : 'hsl(222 22% 14%)',
      border: '1px solid ' + (danger ? 'hsl(354 78% 55%)' : on === false ? 'hsl(354 70% 40%)' : 'hsl(222 15% 22%)'),
      borderRadius: 10,
      color: 'white',
      cursor: 'pointer',
      minWidth: 56,
      transition: 'background 140ms',
    }}>
      {icon}
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </button>
  );

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '0 var(--s-7)',
      borderTop: '1px solid hsl(222 15% 18%)',
      background: 'hsl(222 25% 7%)',
      gap: 'var(--s-3)',
    }}>
      <div className="row gap-3">
        <Btn on={!muted} icon={<I.Mic size={18} />} label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)} />
        <Btn on={cameraOn} icon={<I.Video size={18} />} label={cameraOn ? 'Stop video' : 'Start video'} onClick={() => setCameraOn(!cameraOn)} />
        <Btn icon={<I.Layers size={18} />} label="Share" />
        <Btn icon={<I.Comment size={18} />} label="React" />
      </div>

      <div style={{ flex: 1 }} />

      <div className="row gap-3">
        <Btn ai icon={<I.Sparkle size={18} stroke={2.4} />} label="Ask AI" />
        <Btn icon={<I.Cog size={18} />} label="More" />
        <Btn danger icon={<I.Phone size={18} style={{ transform: 'rotate(135deg)' }} />} label="Leave" />
      </div>
    </div>
  );
};

window.MeetingRoom = MeetingRoom;
