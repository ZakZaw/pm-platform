/* screen-task.jsx — Task Detail (right-side drawer) */

function ActivityEntry({ kind, who, color, time, children }) {
  const icons = {
    comment: "message-square",
    status:  "git-commit",
    field:   "edit-3",
    attach:  "paperclip",
    ai:      "sparkles",
  };
  return (
    <div className="hstack" style={{alignItems:"flex-start", gap:10}}>
      {kind === "comment" ? (
        <Avatar name={who} color={color} size="sm"/>
      ) : (
        <div style={{width:22, height:22, borderRadius:"50%", background:"var(--bg-surface-2)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-tertiary)", border:"1px solid var(--border-subtle)", flexShrink:0}}>
          <Icon name={icons[kind]} size={11}/>
        </div>
      )}
      <div className="grow" style={{minWidth:0}}>
        <div className="hstack" style={{gap:6, marginBottom: kind === "comment" ? 4 : 0}}>
          <span style={{fontSize:12, fontWeight:500}}>{who}</span>
          <span className="mono dim" style={{fontSize:11}}>· {time}</span>
        </div>
        <div style={{fontSize: kind === "comment" ? 13 : 12, color: kind === "comment" ? "var(--text-primary)" : "var(--text-tertiary)", lineHeight:1.5}}>
          {children}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"100px 1fr", alignItems:"center", padding:"6px 0", gap:12}}>
      <div style={{fontSize:12, color:"var(--text-tertiary)"}}>{label}</div>
      <div style={{minWidth:0}}>{children}</div>
    </div>
  );
}

function Checkbox({ checked, label, dim }) {
  return (
    <div className="hstack" style={{gap:8, padding:"5px 0", color: checked ? "var(--text-tertiary)" : "var(--text-primary)", textDecoration: checked ? "line-through" : "none", fontSize:13}}>
      <span style={{
        width:14, height:14, borderRadius: 3,
        border: `1px solid ${checked ? "var(--accent-primary)" : "var(--border-strong)"}`,
        background: checked ? "var(--accent-primary)" : "transparent",
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
      }}>
        {checked && <Icon name="check" size={10} color="white" strokeWidth={3}/>}
      </span>
      <span>{label}</span>
    </div>
  );
}

function ScreenTask() {
  const drawer = (
    <aside style={{
      width: 560, height: "100%",
      background: "var(--bg-base)",
      borderLeft: "1px solid var(--border-default)",
      display: "flex", flexDirection: "column",
      boxShadow: "var(--shadow-xl)",
    }}>
      {/* Drawer header */}
      <div className="hstack" style={{padding:"10px 16px", borderBottom:"1px solid var(--border-subtle)", gap:8}}>
        <span className="mono dim" style={{fontSize:11}}>ATLAS-247</span>
        <span className="dim">·</span>
        <Badge tone="info" icon="zap">Atlas 24</Badge>
        <Badge tone="purple" icon="layers">Epic — Auth hardening</Badge>
        <div className="grow"/>
        <span className="icon-btn" style={{width:24, height:24, color:"var(--text-muted)"}}><Icon name="copy" size={13}/></span>
        <span className="icon-btn" style={{width:24, height:24, color:"var(--text-muted)"}}><Icon name="arrow-up-right" size={13}/></span>
        <span className="icon-btn" style={{width:24, height:24, color:"var(--text-muted)"}}><Icon name="more-horizontal" size={13}/></span>
        <span className="icon-btn" style={{width:24, height:24, color:"var(--text-muted)"}}><Icon name="x" size={13}/></span>
      </div>

      {/* Scroll area */}
      <div style={{flex:1, overflow:"auto", display:"grid", gridTemplateColumns:"1fr 220px"}}>
        {/* Main column */}
        <div style={{padding:"18px 20px", borderRight:"1px solid var(--border-subtle)"}}>
          <div style={{fontSize:20, fontWeight:600, letterSpacing:"-0.01em", lineHeight:1.25, marginBottom:6}}>
            Fix race condition in invite token expiry
          </div>
          <div className="hstack" style={{gap:8, fontSize:12, color:"var(--text-tertiary)", marginBottom:16}}>
            <Icon name="user" size={12}/> Priya Patel reported · 2d ago
            <span>·</span>
            <Icon name="eye" size={12}/> 6 watchers
          </div>

          {/* Description */}
          <div className="subsection" style={{marginTop:0, fontSize:12, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em"}}>Description</div>
          <div style={{fontSize:13, color:"var(--text-secondary)", lineHeight:1.6}}>
            Under load, two near-simultaneous <span className="mono" style={{background:"var(--bg-surface-1)", padding:"1px 4px", borderRadius:3}}>POST /invites/accept</span> calls
            can both pass the <span className="mono" style={{background:"var(--bg-surface-1)", padding:"1px 4px", borderRadius:3}}>expires_at &gt; now()</span> check
            before either is marked consumed. The token is then redeemable twice — once for the existing org and once for a phantom seat.
            <br/><br/>
            Repro is reliable at ~30 concurrent invites. Should resolve by moving the expiry &amp; consume into a single <span className="mono" style={{background:"var(--bg-surface-1)", padding:"1px 4px", borderRadius:3}}>SELECT … FOR UPDATE</span> inside a tx.
          </div>

          {/* Acceptance */}
          <div className="subsection" style={{fontSize:12, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em"}}>Acceptance criteria</div>
          <Checkbox checked label="Reproduction script lands in /tools/repro and fails on main"/>
          <Checkbox checked label="Acceptance happens inside a transaction with row lock"/>
          <Checkbox label="Concurrent accept returns 409 with code `invite_already_consumed`"/>
          <Checkbox label="Audit log records both attempts with shared trace_id"/>
          <Checkbox label="Load test at 100 concurrent passes for 5min"/>

          {/* AI inline suggestion */}
          <div className="card-ai" style={{marginTop:18, padding:12}}>
            <div className="hstack" style={{gap:8, marginBottom:6}}>
              <AIChip>AI noticed</AIChip>
              <span className="muted" style={{fontSize:11}}>3 minutes ago</span>
            </div>
            <div style={{fontSize:13, fontWeight:500, marginBottom:4}}>Related incident from Feb</div>
            <div className="muted" style={{fontSize:12}}>INC-441 had a similar double-consume issue on coupon codes. Same fix shape — consider linking these.</div>
            <div className="hstack" style={{gap:6, marginTop:10}}>
              <Button variant="primary" size="sm">Link INC-441</Button>
              <Button variant="ghost" size="sm">Dismiss</Button>
            </div>
          </div>

          {/* Activity */}
          <div className="subsection" style={{fontSize:12, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em"}}>Activity</div>
          <div className="tabs" style={{marginBottom:14}}>
            <div className="tab is-active"><Icon name="message-square" size={12}/> Comments <span className="count">3</span></div>
            <div className="tab"><Icon name="history" size={12}/> History</div>
            <div className="tab"><Icon name="git-pull-request" size={12}/> Commits <span className="count">4</span></div>
          </div>
          <div className="vstack" style={{gap:14}}>
            <ActivityEntry kind="status" who="System" time="2d ago">
              Status changed from <Badge tone="neutral" icon="circle">To Do</Badge> to <Badge tone="info" icon="circle-dot">In Progress</Badge>
            </ActivityEntry>
            <ActivityEntry kind="comment" who="Marcus Chen" color={2} time="1d ago">
              Reproduced locally with hey at 50 concurrent. Logs show two rows in <span className="mono" style={{background:"var(--bg-surface-1)", padding:"1px 4px", borderRadius:3}}>invite_consumes</span> for the same token — confirmed.
            </ActivityEntry>
            <ActivityEntry kind="field" who="Sasha Volkov" time="22h ago">
              Linked epic to <span className="mono" style={{color:"var(--text-secondary)"}}>EPIC-12 Auth hardening</span>
            </ActivityEntry>
            <ActivityEntry kind="comment" who="Priya Patel" color={1} time="8h ago">
              Going with <span className="mono" style={{background:"var(--bg-surface-1)", padding:"1px 4px", borderRadius:3}}>SELECT FOR UPDATE</span> over advisory locks — easier to reason about and we already use the pattern in billing. Draft up in a branch shortly.
            </ActivityEntry>
            <ActivityEntry kind="ai" who="Stratos AI" time="3m ago">
              Drafted 2 follow-up tasks based on this thread: <span className="mono" style={{color:"var(--accent-primary)"}}>ATLAS-411</span> (audit log trace_id), <span className="mono" style={{color:"var(--accent-primary)"}}>ATLAS-412</span> (load test harness).
            </ActivityEntry>
          </div>
        </div>

        {/* Right meta */}
        <div style={{padding:"18px 16px"}}>
          <MetaRow label="Status"><StatusBadge status="in_progress"/></MetaRow>
          <MetaRow label="Assignee">
            <div className="hstack" style={{gap:6, padding:"3px 6px", borderRadius:"var(--radius-sm)", background:"var(--bg-hover)", width:"fit-content"}}>
              <Avatar name="Priya Patel" color={1} size="xs"/>
              <span style={{fontSize:12}}>Priya Patel</span>
            </div>
          </MetaRow>
          <MetaRow label="Reporter">
            <div className="hstack" style={{gap:6}}>
              <Avatar name="Sasha Volkov" color={3} size="xs"/>
              <span style={{fontSize:12, color:"var(--text-secondary)"}}>Sasha Volkov</span>
            </div>
          </MetaRow>
          <MetaRow label="Priority">
            <div className="hstack" style={{gap:6}}>
              <Priority level="high"/>
              <span style={{fontSize:12}}>High</span>
            </div>
          </MetaRow>
          <MetaRow label="Points"><span className="mono" style={{padding:"1px 6px", background:"var(--bg-surface-2)", borderRadius:"var(--radius-xs)", fontSize:12}}>5</span></MetaRow>
          <MetaRow label="Due"><span style={{fontSize:12}}>May 17 <span className="dim">(Fri)</span></span></MetaRow>
          <MetaRow label="Sprint"><Badge tone="info">Atlas 24</Badge></MetaRow>
          <MetaRow label="Epic">
            <div className="hstack" style={{gap:6, fontSize:12, color:"var(--accent-primary)"}}>
              <Icon name="layers" size={11}/> <span>Auth hardening</span>
            </div>
          </MetaRow>
          <MetaRow label="Labels">
            <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
              <Badge tone="neutral" dot>backend</Badge>
              <Badge tone="danger" dot>security</Badge>
              <Badge tone="warning" dot>tech-debt</Badge>
            </div>
          </MetaRow>
          <MetaRow label="Watchers"><AvatarStack people={PEOPLE.slice(0,5)} size="xs" max={5}/></MetaRow>

          <div style={{height:1, background:"var(--border-subtle)", margin:"12px 0"}}/>

          <div className="input-label">Attachments</div>
          <div className="vstack" style={{gap:6}}>
            <div className="hstack" style={{gap:8, padding:"6px 8px", background:"var(--bg-surface-1)", borderRadius:"var(--radius-md)", border:"1px solid var(--border-subtle)"}}>
              <Icon name="file-text" size={13} color="var(--text-tertiary)"/>
              <div className="grow truncate" style={{fontSize:12}}>repro_script.sh</div>
              <span className="mono dim" style={{fontSize:10}}>2.1 KB</span>
            </div>
            <div className="hstack" style={{gap:8, padding:"6px 8px", background:"var(--bg-surface-1)", borderRadius:"var(--radius-md)", border:"1px solid var(--border-subtle)"}}>
              <Icon name="image" size={13} color="var(--text-tertiary)"/>
              <div className="grow truncate" style={{fontSize:12}}>trace-graph.png</div>
              <span className="mono dim" style={{fontSize:10}}>118 KB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Composer */}
      <div style={{borderTop:"1px solid var(--border-subtle)", padding:"10px 16px", background:"var(--bg-base)"}}>
        <div style={{border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", padding:8, background:"var(--bg-surface-1)"}}>
          <div style={{fontSize:13, color:"var(--text-primary)", minHeight:36, lineHeight:1.5}}>
            Looks good — pushing branch{" "}
            <span className="mono" style={{background:"var(--bg-surface-2)", padding:"1px 4px", borderRadius:3, color:"var(--text-secondary)"}}>fix/invite-race</span>
            {" "}for review.{" "}
            <span style={{background:"var(--accent-primary-muted)", color:"var(--accent-primary)", padding:"1px 5px", borderRadius:3, fontWeight:500}}>@Marcus Chen</span>
            {" "}can you double-check the load test threshold?<span style={{display:"inline-block", width:1.5, height:14, background:"var(--accent-primary)", marginLeft:1, animation:"blink 1s infinite"}}/>
          </div>
          {/* Mention popover */}
          <div className="menu" style={{position:"relative", marginTop:6, padding:4, boxShadow:"none"}}>
            <div className="menu-section">People in Atlas</div>
            <div className="menu-item is-selected">
              <Avatar name="Marcus Chen" color={2} size="xs"/>
              <div className="vstack" style={{minWidth:0}}>
                <span>Marcus Chen</span>
                <span className="mono dim" style={{fontSize:10}}>marcus@nimbus.co · online</span>
              </div>
            </div>
            <div className="menu-item">
              <Avatar name="Marcus Hill" color={6} size="xs"/>
              <div className="vstack"><span>Marcus Hill</span><span className="mono dim" style={{fontSize:10}}>marcus.h@nimbus.co</span></div>
            </div>
          </div>
          <div className="hstack" style={{justifyContent:"space-between", marginTop:8, paddingTop:8, borderTop:"1px solid var(--border-subtle)"}}>
            <div className="hstack" style={{gap:2}}>
              {["bold","italic","code","list","link","paperclip","at-sign","sparkles"].map(n => (
                <span key={n} style={{width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:4, color: n === "sparkles" ? "var(--ai-violet)" : "var(--text-muted)", cursor:"pointer"}}><Icon name={n} size={13}/></span>
              ))}
            </div>
            <div className="hstack" style={{gap:6}}>
              <span className="muted mono" style={{fontSize:11}}>⌘⏎ to send</span>
              <Button variant="primary" size="sm">Comment</Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-03</span>
        <span className="mock-name">Task Detail</span>
        <span className="mock-desc">Drawer overlays the board · ⌘. to close</span>
      </div>
      <div className="mock">
        <div style={{display:"grid", gridTemplateColumns:"1fr 560px", height: 760, background:"var(--bg-base)"}}>
          {/* Dimmed board behind */}
          <div style={{position:"relative", overflow:"hidden", background:"var(--bg-app)"}}>
            <div style={{padding:"14px 18px", borderBottom:"1px solid var(--border-subtle)", display:"flex", alignItems:"center", gap:10}}>
              <Icon name="kanban" size={14} color="var(--text-tertiary)"/>
              <span style={{fontSize:14, fontWeight:600}}>Sprint 24</span>
              <span className="mono dim" style={{fontSize:11}}>· 14 tasks · 26/41pt</span>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10, padding:14}}>
              {["todo","in_progress","in_review","blocked"].map(s => (
                <div key={s} className="vstack" style={{gap:8}}>
                  <StatusBadge status={s}/>
                  {Array.from({length: 3}).map((_, i) => (
                    <div key={i} style={{height: 76, background:"var(--bg-surface-1)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-md)"}}/>
                  ))}
                </div>
              ))}
            </div>
            {/* dim overlay */}
            <div style={{position:"absolute", inset:0, background:"rgba(15,17,23,0.55)"}}/>
          </div>
          {drawer}
        </div>
      </div>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

window.ScreenTask = ScreenTask;
