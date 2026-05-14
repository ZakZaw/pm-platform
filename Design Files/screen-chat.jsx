/* screen-chat.jsx — Chat channel */

function ChatMessage({ who, color, time, children, isAI, embedTask, threadCount, reactions }) {
  return (
    <div className="hstack" style={{alignItems:"flex-start", gap:10, padding:"8px 18px", borderRadius:"var(--radius-md)"}}>
      {isAI ? (
        <span style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,var(--ai-violet),var(--accent-primary))",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon name="sparkles" size={15} color="#fff"/>
        </span>
      ) : (
        <Avatar name={who} color={color} size="md"/>
      )}
      <div className="grow" style={{minWidth:0}}>
        <div className="hstack" style={{gap:8, marginBottom:2}}>
          <span style={{fontSize:13, fontWeight:600}}>{who}</span>
          {isAI && <Badge tone="purple" icon="sparkles">App</Badge>}
          <span className="mono dim" style={{fontSize:10}}>{time}</span>
        </div>
        <div style={{fontSize:13.5, color:"var(--text-secondary)", lineHeight:1.55}}>{children}</div>
        {embedTask && (
          <div className="card" style={{marginTop:8, padding:10, maxWidth: 460}}>
            <div className="hstack" style={{justifyContent:"space-between", marginBottom:6}}>
              <span className="hstack" style={{gap:6}}>
                <span className="mono dim" style={{fontSize:11}}>{embedTask.id}</span>
                <Priority level={embedTask.prio}/>
              </span>
              <StatusBadge status={embedTask.status}/>
            </div>
            <div style={{fontSize:13, fontWeight:500, marginBottom:8}}>{embedTask.title}</div>
            <div className="hstack" style={{gap:8, fontSize:11, color:"var(--text-tertiary)"}}>
              <Avatar name={embedTask.who} color={embedTask.color} size="xs"/>
              <span>{embedTask.who}</span>
              <span>·</span>
              <span>Due {embedTask.due}</span>
              <span>·</span>
              <span className="mono">{embedTask.pts}pt</span>
            </div>
          </div>
        )}
        {threadCount > 0 && (
          <div className="hstack" style={{gap:6, marginTop:6, padding:"4px 8px", background:"var(--bg-surface-1)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-md)", width:"fit-content", cursor:"pointer", fontSize:12}}>
            <AvatarStack people={PEOPLE.slice(0, threadCount)} size="xs" max={3}/>
            <span style={{color:"var(--accent-primary)", fontWeight:500}}>{threadCount} replies</span>
            <span className="dim">· last 8m ago</span>
            <Icon name="chevron-right" size={11} color="var(--text-muted)"/>
          </div>
        )}
        {reactions && (
          <div className="hstack" style={{gap:4, marginTop:6}}>
            {reactions.map(([emoji, count, me], i) => (
              <span key={i} className="hstack" style={{gap:4, padding:"1px 6px", background: me ? "var(--accent-primary-muted)" : "var(--bg-surface-1)", border:`1px solid ${me ? "rgba(91,106,240,0.4)" : "var(--border-subtle)"}`, borderRadius:"var(--radius-pill)", fontSize:11, cursor:"pointer"}}>
                <span style={{fontSize:12}}>{emoji}</span>
                <span className="mono" style={{color: me ? "var(--accent-primary)" : "var(--text-tertiary)", fontWeight:500}}>{count}</span>
              </span>
            ))}
            <span className="hstack" style={{padding:"1px 6px", background:"transparent", border:"1px dashed var(--border-default)", borderRadius:"var(--radius-pill)", fontSize:11, color:"var(--text-muted)", cursor:"pointer"}}>
              <Icon name="smile-plus" size={11}/>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenChat() {
  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-09</span>
        <span className="mock-name">Chat Channel</span>
        <span className="mock-desc">#eng-atlas · 12 online · day digest from Stratos AI</span>
      </div>
      <div className="mock" style={{height: 760}}>
        <div className="app" style={{gridTemplateColumns:"220px 1fr"}}>
          <ShellSidebar collapsed={false}/>
          <ShellTopbar collapsed={false} onToggle={()=>{}} project="Atlas — Public API"/>
          <section className="app-main">
            {/* Channel header */}
            <div className="page-header" style={{padding:"10px 18px"}}>
              <div className="hstack" style={{gap:10}}>
                <Icon name="hash" size={14} color="var(--text-tertiary)"/>
                <span className="page-title">eng-atlas</span>
                <span className="muted mono" style={{fontSize:11}}>· Engineering chatter for Atlas — Public API</span>
              </div>
              <span className="grow"/>
              <div className="hstack" style={{gap:6}}>
                <AvatarStack people={PEOPLE.slice(0, 6)} max={5} size="sm"/>
                <span className="muted" style={{fontSize:11}}>12 online</span>
                <div className="divider-y" style={{height:18}}/>
                <Button variant="ghost" size="md" icon="bell"/>
                <Button variant="ghost" size="md" icon="pin"/>
                <Button variant="ghost" size="md" icon="more-horizontal"/>
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1, overflow:"auto", display:"flex", flexDirection:"column", padding:"8px 0"}}>
              {/* Day separator */}
              <div style={{display:"flex", alignItems:"center", gap:10, padding:"6px 18px"}}>
                <div style={{flex:1, height:1, background:"var(--border-subtle)"}}/>
                <div style={{padding:"2px 10px", background:"var(--bg-surface-1)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-pill)", fontSize:11, color:"var(--text-tertiary)", fontWeight:500}}>Today · Wed May 14</div>
                <div style={{flex:1, height:1, background:"var(--border-subtle)"}}/>
              </div>

              <ChatMessage who="Priya Patel" color={1} time="9:02 AM" reactions={[["👀", 3, false]]}>
                Morning team — pushed the invite-race fix to <span className="mono" style={{background:"var(--bg-surface-1)", padding:"1px 4px", borderRadius:3, color:"var(--text-secondary)"}}>fix/invite-race</span>. Marcus, would love a second pair of eyes on the load test threshold before I merge.
              </ChatMessage>

              <ChatMessage who="Marcus Chen" color={2} time="9:08 AM" threadCount={4}>
                On it. One question on the lock granularity — are we locking the token row or the whole invites table? Let's not nuke throughput.
              </ChatMessage>

              <ChatMessage who="Sasha Volkov" color={3} time="9:14 AM"
                embedTask={{ id:"ATLAS-302", prio:"urgent", status:"blocked", title:"Webhook retries flooding when downstream 503s", who:"Diego Ramos", color:4, due:"May 17", pts:5 }}>
                Friendly bump — this has been sitting in Blocked for 5 days now. Diego, anything I can do to unblock?
              </ChatMessage>

              <ChatMessage who="Diego Ramos" color={4} time="9:21 AM" reactions={[["👍", 2, true], ["🙏", 1, false]]}>
                Waiting on infra capacity for the NATS cluster. Should clear today — Aria pinged me last night.
              </ChatMessage>

              <ChatMessage isAI who="Stratos" color={5} time="9:30 AM" reactions={[["✨", 5, true], ["💯", 2, false]]}>
                <div style={{marginBottom:6}}><strong>Atlas — daily digest</strong></div>
                <div className="vstack" style={{gap:4, fontSize:13}}>
                  <div className="hstack" style={{gap:6}}>
                    <Icon name="check-circle" size={12} color="var(--status-success)"/>
                    <span><strong>3 tasks shipped</strong> yesterday · 9 story points</span>
                  </div>
                  <div className="hstack" style={{gap:6}}>
                    <Icon name="git-pull-request" size={12} color="var(--accent-primary)"/>
                    <span><strong>4 PRs awaiting review</strong> · oldest: 18h (ATLAS-258)</span>
                  </div>
                  <div className="hstack" style={{gap:6}}>
                    <Icon name="alert-triangle" size={12} color="var(--status-warning)"/>
                    <span><strong>1 blocker aging</strong> · ATLAS-302 · 5 days</span>
                  </div>
                  <div className="hstack" style={{gap:6}}>
                    <Icon name="users" size={12} color="var(--ai-cyan)"/>
                    <span><strong>Marcus is at 95% capacity</strong> · consider reassigning ATLAS-330</span>
                  </div>
                </div>
                <div className="hstack" style={{gap:6, marginTop:10}}>
                  <Button variant="ai" size="sm" icon="arrow-right">Open insight</Button>
                  <Button variant="ghost" size="sm">Mute digest</Button>
                </div>
              </ChatMessage>

              <ChatMessage who="Hana Sato" color={5} time="9:42 AM">
                Heads up — design crit for the onboarding wizard is at 11. I'll share the mocks 30 min before. 🔗 <a style={{color:"var(--accent-primary)"}}>figma.com/file/atlas-onb</a>
              </ChatMessage>

              <ChatMessage who="Aria Khan" color={7} time="9:51 AM" threadCount={2}
                embedTask={{ id:"ATLAS-302", prio:"urgent", status:"in_progress", title:"Webhook retries flooding when downstream 503s", who:"Diego Ramos", color:4, due:"May 17", pts:5 }}>
                NATS cluster is live — unblocking <span style={{background:"var(--accent-primary-muted)", color:"var(--accent-primary)", padding:"1px 5px", borderRadius:3, fontWeight:500}}>@Diego Ramos</span>. Moved to In Progress.
              </ChatMessage>

              {/* Typing */}
              <div className="hstack" style={{gap:8, padding:"4px 18px", color:"var(--text-tertiary)", fontSize:12}}>
                <Avatar name="Marcus Chen" color={2} size="xs"/>
                <span><strong>Marcus</strong> is typing</span>
                <span className="hstack" style={{gap:2, marginLeft:2}}>
                  <span style={{width:4, height:4, borderRadius:"50%", background:"var(--text-muted)", animation:"bounce 1.2s infinite"}}/>
                  <span style={{width:4, height:4, borderRadius:"50%", background:"var(--text-muted)", animation:"bounce 1.2s infinite 0.15s"}}/>
                  <span style={{width:4, height:4, borderRadius:"50%", background:"var(--text-muted)", animation:"bounce 1.2s infinite 0.3s"}}/>
                </span>
              </div>
            </div>

            {/* Composer */}
            <div style={{padding:"10px 18px 16px", borderTop:"1px solid var(--border-subtle)"}}>
              <div style={{border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)", background:"var(--bg-surface-1)", padding:"8px 10px"}}>
                <div style={{fontSize:13, color:"var(--text-muted)", padding:"4px 0"}}>Message #eng-atlas</div>
                <div className="hstack" style={{justifyContent:"space-between", paddingTop:6, borderTop:"1px solid var(--border-subtle)"}}>
                  <div className="hstack" style={{gap:2}}>
                    {["bold","italic","strikethrough","link","list","code","paperclip","at-sign","smile","sparkles"].map(n => (
                      <span key={n} style={{width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:4, color: n === "sparkles" ? "var(--ai-violet)" : "var(--text-muted)", cursor:"pointer"}}>
                        <Icon name={n} size={13}/>
                      </span>
                    ))}
                  </div>
                  <Button variant="primary" size="sm" icon="send-horizontal" state="disabled">Send</Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-3px); } }`}</style>
    </div>
  );
}

window.ScreenChat = ScreenChat;
