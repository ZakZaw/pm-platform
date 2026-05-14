/* screen-meeting.jsx — Meeting Room with Live Transcript */

const TRANSCRIPT = [
  { who:"Priya Patel", color:1, time:"00:12:04", text:"Quick agenda — invite-race fix status, blocker on webhook retries, and we should size the rate-limit spec before standup ends." },
  { who:"Marcus Chen", color:2, time:"00:12:18", text:"Cool. I'm reproducing the invite race locally at 50 concurrent — confirmed two rows in invite_consumes for the same token. The fix is a SELECT FOR UPDATE." },
  { who:"Sasha Volkov", color:3, time:"00:12:36", text:"Do we have a load test? Last time we shipped a lock fix it deadlocked under contention." },
  { who:"Marcus Chen", color:2, time:"00:12:48", text:"Drafting one — we should aim for 100 concurrent for 5 minutes. I'll write the harness as part of the same PR.", isCurrent:true },
  { who:"Diego Ramos", color:4, time:"00:13:02", text:"For the webhook retries, downstream is consistently 503-ing past 100 req/s. I want to put delivery behind NATS and isolate retry storms per tenant." },
];

const ACTION_ITEMS = [
  { who:"Marcus Chen", color:2, task:"Land invite-race fix with SELECT FOR UPDATE + tx", due:"Today", confidence:0.92 },
  { who:"Marcus Chen", color:2, task:"Author load-test harness (100 concurrent, 5 min)", due:"Tomorrow", confidence:0.85 },
  { who:"Diego Ramos", color:4, task:"RFC: webhook delivery via NATS with per-tenant retry isolation", due:"Fri", confidence:0.78 },
  { who:"Sasha Volkov", color:3, task:"Review invite-race PR + verify deadlock-free", due:"Today", confidence:0.71 },
];

function ScreenMeeting() {
  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-07</span>
        <span className="mock-name">Meeting Room</span>
        <span className="mock-desc">Atlas standup · 12 min in · live transcript + AI action items</span>
      </div>
      <div className="mock" style={{height: 760, background:"#000"}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 380px", height:"100%"}}>
          {/* Video stage */}
          <div style={{position:"relative", padding:16, display:"flex", flexDirection:"column", gap:12, background:"linear-gradient(180deg, #0A0C13, #14161F)"}}>
            {/* Active speaker */}
            <div style={{flex:1, position:"relative", borderRadius:"var(--radius-lg)", overflow:"hidden", background:"radial-gradient(ellipse at 30% 40%, #2A2F45, #0F1117)", border:"2px solid var(--accent-primary)", boxShadow:"0 0 0 4px rgba(91,106,240,0.18)"}}>
              {/* Faux video — large avatar */}
              <div style={{position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center"}}>
                <div className="avatar av-2" style={{width:140, height:140, fontSize:48, border:"3px solid rgba(255,255,255,0.10)"}}>MC</div>
              </div>
              {/* HUD */}
              <div style={{position:"absolute", top:12, left:12, display:"flex", gap:8}}>
                <div style={{padding:"4px 8px", background:"rgba(0,0,0,0.55)", color:"#fff", borderRadius:"var(--radius-sm)", fontSize:11, fontWeight:500, display:"flex", alignItems:"center", gap:6}}>
                  <span style={{width:6, height:6, borderRadius:"50%", background:"var(--status-danger)"}}/> REC
                  <span className="mono">00:12:48</span>
                </div>
                <div style={{padding:"4px 8px", background:"rgba(0,0,0,0.55)", color:"#fff", borderRadius:"var(--radius-sm)", fontSize:11}}>
                  Atlas standup
                </div>
              </div>
              <div style={{position:"absolute", bottom:12, left:12, padding:"4px 10px", background:"rgba(0,0,0,0.6)", borderRadius:"var(--radius-sm)", color:"#fff", fontSize:12, display:"flex", alignItems:"center", gap:8}}>
                <Icon name="mic" size={11} color="var(--status-success)"/> Marcus Chen <span className="dim mono" style={{fontSize:10}}>(speaking)</span>
              </div>
              {/* Voice level animation */}
              <div style={{position:"absolute", bottom:12, right:12, display:"flex", alignItems:"flex-end", gap:2, height:18}}>
                {[6,12,16,10,14,8,12].map((h, i) => (
                  <span key={i} style={{width:3, height:h, background:"var(--status-success)", borderRadius:1, opacity:0.85}}/>
                ))}
              </div>
            </div>

            {/* Participant strip */}
            <div style={{display:"flex", gap:8}}>
              {[
                { who:"Priya Patel", color:1, status:"mic", muted:false },
                { who:"Sasha Volkov", color:3, status:"mic", muted:false },
                { who:"Diego Ramos", color:4, status:"mic", muted:true },
                { who:"Hana Sato", color:5, status:"mic", muted:true },
                { who:"Aria Khan", color:7, status:"mic", muted:false },
              ].map((p, i) => (
                <div key={i} style={{flex:1, aspectRatio:"16/10", borderRadius:"var(--radius-md)", background:"radial-gradient(ellipse at 30% 40%, #2A2F45, #0F1117)", border:"1px solid var(--border-default)", position:"relative", overflow:"hidden"}}>
                  <div style={{position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center"}}>
                    <Avatar name={p.who} color={p.color} size="lg"/>
                  </div>
                  <div style={{position:"absolute", bottom:4, left:6, padding:"1px 6px", background:"rgba(0,0,0,0.6)", borderRadius:"var(--radius-xs)", color:"#fff", fontSize:10, display:"flex", alignItems:"center", gap:4}}>
                    <Icon name={p.muted ? "mic-off" : "mic"} size={9} color={p.muted ? "var(--status-danger)" : "var(--status-success)"}/>
                    {p.who.split(" ")[0]}
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div style={{display:"flex", justifyContent:"center", gap:8, padding:"6px 0"}}>
              {[
                { icon:"mic", on:true },
                { icon:"video", on:true },
                { icon:"monitor", on:false, label:"Share" },
                { icon:"hand", on:false, label:"Raise" },
                { icon:"sparkles", on:true, label:"AI", ai:true },
                { icon:"more-horizontal", on:false },
                { icon:"phone-off", on:false, danger:true },
              ].map((b, i) => (
                <button key={i} style={{
                  height:36, padding: b.label ? "0 14px" : 0, width: b.label ? "auto" : 36,
                  borderRadius:"var(--radius-pill)",
                  background: b.danger ? "var(--status-danger)" : b.ai ? "linear-gradient(135deg, var(--ai-violet), var(--accent-primary))" : b.on ? "var(--bg-surface-2)" : "var(--bg-surface-1)",
                  color: b.danger || b.ai ? "#fff" : "var(--text-secondary)",
                  border:`1px solid ${b.danger ? "transparent" : b.ai ? "rgba(122,107,255,0.4)" : "var(--border-default)"}`,
                  display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:500, cursor:"pointer",
                }}>
                  <Icon name={b.icon} size={14}/>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right side panel */}
          <aside style={{borderLeft:"1px solid var(--border-default)", background:"var(--bg-base)", display:"flex", flexDirection:"column", minHeight:0}}>
            <div className="tabs" style={{padding:"0 12px"}}>
              <div className="tab is-active"><Icon name="captions" size={12}/> Transcript</div>
              <div className="tab"><Icon name="check-square" size={12}/> Action items <span className="count">4</span></div>
              <div className="tab"><Icon name="users" size={12}/> People <span className="count">6</span></div>
            </div>

            {/* Transcript */}
            <div style={{flex:1, overflow:"auto", padding:14, minHeight:0}}>
              <div className="hstack" style={{gap:6, marginBottom:10, padding:"6px 8px", background:"var(--bg-surface-1)", borderRadius:"var(--radius-md)"}}>
                <span style={{width:6, height:6, borderRadius:"50%", background:"var(--status-danger)", animation:"pulse 1.4s infinite"}}/>
                <span style={{fontSize:11, fontWeight:500}}>Live transcription</span>
                <span className="mono dim" style={{fontSize:10}}>en-US · 96% conf</span>
                <span className="grow"/>
                <Icon name="search" size={12} color="var(--text-muted)"/>
              </div>
              <div className="vstack" style={{gap:14}}>
                {TRANSCRIPT.map((t, i) => (
                  <div key={i} className="hstack" style={{alignItems:"flex-start", gap:8, opacity: t.isCurrent ? 1 : 0.85}}>
                    <Avatar name={t.who} color={t.color} size="xs"/>
                    <div className="grow" style={{minWidth:0}}>
                      <div className="hstack" style={{gap:6, marginBottom:2}}>
                        <span style={{fontSize:12, fontWeight:500}}>{t.who}</span>
                        <span className="mono dim" style={{fontSize:10}}>{t.time}</span>
                      </div>
                      <div style={{fontSize:12.5, color: t.isCurrent ? "var(--text-primary)" : "var(--text-secondary)", lineHeight:1.55}}>
                        {t.text}{t.isCurrent && <span style={{display:"inline-block", width:1.5, height:12, background:"var(--accent-primary)", marginLeft:2, verticalAlign:"middle", animation:"blink 1s infinite"}}/>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI action items */}
              <div style={{marginTop:18, paddingTop:14, borderTop:"1px solid var(--border-subtle)"}}>
                <div className="hstack" style={{gap:8, marginBottom:10}}>
                  <AIChip>AI drafting</AIChip>
                  <span style={{fontSize:11, color:"var(--text-tertiary)"}}>4 action items detected · review at end</span>
                </div>
                <div className="vstack" style={{gap:8}}>
                  {ACTION_ITEMS.map((a, i) => (
                    <div key={i} className="card-ai" style={{padding:"8px 10px"}}>
                      <div className="hstack" style={{gap:8, marginBottom:4}}>
                        <Icon name="check-square" size={11} color="var(--ai-violet)"/>
                        <Avatar name={a.who} color={a.color} size="xs"/>
                        <span style={{fontSize:11, color:"var(--text-secondary)", fontWeight:500}}>{a.who.split(" ")[0]}</span>
                        <span className="grow"/>
                        <Badge tone={a.due === "Today" ? "warning" : "neutral"}>{a.due}</Badge>
                      </div>
                      <div style={{fontSize:12, lineHeight:1.4}}>{a.task}</div>
                      <div className="hstack" style={{gap:8, marginTop:6, fontSize:10, color:"var(--text-muted)"}}>
                        <span style={{flex:1, height:3, background:"var(--bg-surface-2)", borderRadius:2, overflow:"hidden"}}>
                          <span style={{display:"block", width:`${a.confidence*100}%`, height:"100%", background:"var(--ai-violet)"}}/>
                        </span>
                        <span className="mono">{Math.round(a.confidence*100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }`}</style>
    </div>
  );
}

window.ScreenMeeting = ScreenMeeting;
