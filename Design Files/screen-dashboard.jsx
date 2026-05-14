/* screen-dashboard.jsx — Project Dashboard widgets */

function BurndownChart({ width = 320, height = 140 }) {
  const days = 14;
  const ideal = Array.from({length: days+1}, (_, i) => 41 - (41 / days) * i);
  const actual = [41, 39, 36, 34, 33, 31, 28, 28, 26, 24, 22, null, null, null, null];
  const xStep = width / days;
  const max = 45;
  const y = v => height - (v / max) * (height - 20) - 10;

  return (
    <svg width={width} height={height} style={{display:"block"}}>
      <defs>
        <linearGradient id="bd-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.20"/>
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* Grid */}
      {[10, 20, 30, 40].map(v => (
        <g key={v}>
          <line x1="0" y1={y(v)} x2={width} y2={y(v)} stroke="var(--border-subtle)" strokeDasharray="2 3"/>
          <text x="2" y={y(v) - 2} fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">{v}</text>
        </g>
      ))}
      {/* Ideal */}
      <path d={ideal.map((v, i) => `${i === 0 ? "M" : "L"} ${i * xStep} ${y(v)}`).join(" ")} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 4" fill="none"/>
      {/* Actual area */}
      <path d={`${actual.filter(v => v !== null).map((v, i) => `${i === 0 ? "M" : "L"} ${i * xStep} ${y(v)}`).join(" ")} L ${(actual.filter(v => v !== null).length - 1) * xStep} ${height} L 0 ${height} Z`} fill="url(#bd-fill)"/>
      <path d={actual.filter(v => v !== null).map((v, i) => `${i === 0 ? "M" : "L"} ${i * xStep} ${y(v)}`).join(" ")} stroke="var(--accent-primary)" strokeWidth="1.75" fill="none" strokeLinecap="round"/>
      {/* Today marker */}
      <circle cx={10 * xStep} cy={y(22)} r="3" fill="var(--accent-primary)"/>
      <line x1={10 * xStep} y1={0} x2={10 * xStep} y2={height} stroke="var(--accent-primary)" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 3"/>
    </svg>
  );
}

function VelocityChart({ width = 320, height = 140 }) {
  const sprints = [
    { name:"S18", pts:32, comm:35 },
    { name:"S19", pts:38, comm:38 },
    { name:"S20", pts:30, comm:36 },
    { name:"S21", pts:42, comm:40 },
    { name:"S22", pts:36, comm:39 },
    { name:"S23", pts:41, comm:42 },
    { name:"S24", pts:26, comm:41, current:true },
  ];
  const bw = width / sprints.length - 6;
  const max = 50;
  return (
    <svg width={width} height={height}>
      {[10,20,30,40,50].map(v => (
        <g key={v}>
          <line x1="20" y1={height - (v/max)*(height-20)} x2={width} y2={height - (v/max)*(height-20)} stroke="var(--border-subtle)" strokeDasharray="2 3"/>
          <text x="0" y={height - (v/max)*(height-20) - 2} fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">{v}</text>
        </g>
      ))}
      {sprints.map((s, i) => {
        const x = 22 + i * (bw + 6);
        const hCom = (s.comm/max)*(height-20);
        const hP = (s.pts/max)*(height-20);
        return (
          <g key={s.name}>
            <rect x={x} y={height - hCom} width={bw} height={hCom} fill={s.current ? "rgba(91,106,240,0.20)" : "var(--bg-surface-3)"} rx="2"/>
            <rect x={x} y={height - hP} width={bw} height={hP} fill={s.current ? "var(--accent-primary)" : "var(--accent-primary)"} opacity={s.current ? 1 : 0.7} rx="2"/>
            <text x={x + bw/2} y={height - 4} fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-mono)">{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function HealthGauge({ score = 78 }) {
  const r = 56, c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  const color = score >= 75 ? "var(--status-success)" : score >= 50 ? "var(--status-warning)" : "var(--status-danger)";
  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={r} fill="none" stroke="var(--bg-surface-3)" strokeWidth="10"/>
      <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 80 80)"/>
      <text x="80" y="78" textAnchor="middle" fontSize="34" fontWeight="600" fill="var(--text-primary)" fontFamily="var(--font-ui)">{score}</text>
      <text x="80" y="98" textAnchor="middle" fontSize="11" fill="var(--text-tertiary)" fontFamily="var(--font-mono)">/ 100</text>
    </svg>
  );
}

function WorkloadHeat() {
  const days = ["M","T","W","T","F","M","T","W","T","F"];
  const people = ["Priya","Marcus","Sasha","Diego","Hana","Aria"];
  const load = [
    [3,4,5,5,4, 4,3,5,5,3],
    [4,5,5,4,4, 5,5,5,4,4],
    [2,3,3,3,2, 3,3,4,3,2],
    [5,5,5,5,5, 5,5,5,5,5],
    [3,4,4,4,3, 3,4,4,3,3],
    [1,2,3,2,2, 2,3,3,2,1],
  ];
  const shade = v => {
    const a = 0.10 + (v/5)*0.55;
    if (v >= 5) return `rgba(229,72,77,${a})`;
    if (v >= 4) return `rgba(224,162,58,${a})`;
    return `rgba(91,106,240,${a})`;
  };
  return (
    <div style={{display:"grid", gridTemplateColumns:`56px repeat(${days.length}, 1fr)`, gap:2, alignItems:"center"}}>
      <div/>
      {days.map((d, i) => <div key={i} className="mono" style={{fontSize:10, color:"var(--text-muted)", textAlign:"center"}}>{d}</div>)}
      {people.map((p, i) => (
        <React.Fragment key={p}>
          <div style={{fontSize:11, color:"var(--text-secondary)"}}>{p}</div>
          {load[i].map((v, j) => (
            <div key={j} style={{aspectRatio:"1", borderRadius:3, background:shade(v), border:"1px solid var(--border-subtle)"}}/>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function ScreenDashboard() {
  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-08</span>
        <span className="mock-name">Project Dashboard</span>
        <span className="mock-desc">Atlas — Public API · Health at a glance</span>
      </div>
      <div className="mock" style={{height: 760}}>
        <div className="app" style={{gridTemplateColumns:"56px 1fr"}}>
          <ShellSidebar collapsed={true}/>
          <ShellTopbar collapsed={true} onToggle={()=>{}} project="Atlas — Public API"/>
          <section className="app-main" style={{overflow:"auto"}}>
            <div className="page-header" style={{padding:"12px 18px"}}>
              <div className="hstack" style={{gap:8}}>
                <Icon name="bar-chart-3" size={14}/>
                <span className="page-title">Dashboard</span>
                <Badge tone="neutral">Last 30d</Badge>
              </div>
              <span className="grow"/>
              <div className="hstack" style={{gap:6}}>
                <Button variant="secondary" size="md" icon="calendar">Last 30 days</Button>
                <Button variant="secondary" size="md" icon="share-2">Share</Button>
                <Button variant="primary" size="md" icon="plus">Add widget</Button>
              </div>
            </div>

            <div style={{padding:18, display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:14, alignContent:"start"}}>
              {/* KPI strip */}
              {[
                { label:"On track", value:"82%", delta:"+4%", tone:"success", icon:"trending-up" },
                { label:"Open tasks", value:"47", delta:"−6", tone:"info", icon:"list-checks" },
                { label:"Bug ratio", value:"11%", delta:"−2%", tone:"success", icon:"bug" },
                { label:"Avg cycle time", value:"3.2d", delta:"+0.4d", tone:"warning", icon:"clock" },
              ].map(k => (
                <div key={k.label} className="card" style={{gridColumn:"span 3", padding:14}}>
                  <div className="hstack" style={{gap:8, marginBottom:6}}>
                    <span style={{width:22, height:22, borderRadius:"var(--radius-sm)", background:`var(--status-${k.tone}-bg)`, color:`var(--status-${k.tone})`, display:"flex", alignItems:"center", justifyContent:"center"}}>
                      <Icon name={k.icon} size={12}/>
                    </span>
                    <span style={{fontSize:11, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600}}>{k.label}</span>
                  </div>
                  <div className="hstack" style={{justifyContent:"space-between", alignItems:"baseline"}}>
                    <div style={{fontSize:24, fontWeight:600, letterSpacing:"-0.01em"}}>{k.value}</div>
                    <div className={`mono`} style={{fontSize:11, color:`var(--status-${k.tone})`}}>{k.delta}</div>
                  </div>
                </div>
              ))}

              {/* Burndown */}
              <div className="card" style={{gridColumn:"span 6", padding:16}}>
                <div className="hstack" style={{justifyContent:"space-between", marginBottom:6}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:600}}>Sprint burndown</div>
                    <div className="muted" style={{fontSize:11}}>Atlas 24 · 26 / 41 pt · 4 days left</div>
                  </div>
                  <Badge tone="warning">Behind ideal</Badge>
                </div>
                <BurndownChart width={500} height={150}/>
              </div>

              {/* Velocity */}
              <div className="card" style={{gridColumn:"span 6", padding:16}}>
                <div className="hstack" style={{justifyContent:"space-between", marginBottom:6}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:600}}>Velocity</div>
                    <div className="muted" style={{fontSize:11}}>Last 7 sprints · committed vs. completed</div>
                  </div>
                  <div className="hstack" style={{gap:10, fontSize:11}}>
                    <span className="hstack" style={{gap:4}}><span style={{width:8, height:8, background:"var(--bg-surface-3)", borderRadius:2}}/>Committed</span>
                    <span className="hstack" style={{gap:4}}><span style={{width:8, height:8, background:"var(--accent-primary)", borderRadius:2}}/>Completed</span>
                  </div>
                </div>
                <VelocityChart width={500} height={150}/>
              </div>

              {/* Health gauge */}
              <div className="card" style={{gridColumn:"span 4", padding:16, display:"flex", flexDirection:"column", alignItems:"center"}}>
                <div className="hstack" style={{justifyContent:"space-between", width:"100%", marginBottom:6}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:600}}>Project health</div>
                    <div className="muted" style={{fontSize:11}}>composite — 6 signals</div>
                  </div>
                  <Badge tone="success">Healthy</Badge>
                </div>
                <HealthGauge score={78}/>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, width:"100%", marginTop:8, fontSize:11}}>
                  {[
                    ["Burnrate", "var(--status-warning)", "+0.4d"],
                    ["Blockers", "var(--status-success)", "1"],
                    ["Coverage", "var(--status-success)", "94%"],
                    ["WIP", "var(--status-warning)", "high"],
                  ].map(([l, c, v]) => (
                    <div key={l} className="hstack" style={{justifyContent:"space-between", padding:"3px 6px"}}>
                      <span className="hstack" style={{gap:6}}><span style={{width:6, height:6, borderRadius:"50%", background:c}}/>{l}</span>
                      <span className="mono dim">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Epic progress */}
              <div className="card" style={{gridColumn:"span 4", padding:16}}>
                <div style={{fontSize:13, fontWeight:600, marginBottom:10}}>Epic progress</div>
                <div className="vstack" style={{gap:10}}>
                  {[
                    { name:"Auth hardening", c:"#5B6AF0", p:0.55, done:12, total:22 },
                    { name:"Webhook reliability v2", c:"#4FD1E0", p:0.85, done:14, total:16 },
                    { name:"Self-serve onboarding", c:"#7A6BFF", p:0.20, done:5, total:24 },
                    { name:"Public API v2 spec", c:"#C77BFF", p:0.10, done:2, total:18 },
                  ].map(e => (
                    <div key={e.name}>
                      <div className="hstack" style={{justifyContent:"space-between", marginBottom:4, fontSize:12}}>
                        <span className="hstack" style={{gap:6}}><span style={{width:8,height:8,borderRadius:2,background:e.c}}/>{e.name}</span>
                        <span className="mono dim" style={{fontSize:11}}>{e.done}/{e.total}</span>
                      </div>
                      <div style={{height:6, background:"var(--bg-surface-3)", borderRadius:3, overflow:"hidden"}}>
                        <div style={{height:"100%", width:`${e.p*100}%`, background:e.c, borderRadius:3}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI weekly insight */}
              <div className="card-ai" style={{gridColumn:"span 4", padding:16}}>
                <div className="hstack" style={{gap:8, marginBottom:8}}>
                  <AIChip>Weekly insight</AIChip>
                  <span className="muted" style={{fontSize:11}}>· Generated Mon 9:00</span>
                </div>
                <div style={{fontSize:14, fontWeight:600, lineHeight:1.35, marginBottom:6}}>You'll likely miss Sprint 24 by ~12pt</div>
                <div className="muted" style={{fontSize:12, lineHeight:1.55, marginBottom:10}}>
                  Two blockers (ATLAS-302, ATLAS-318) are accruing time on Auth hardening. Marcus is at 95% capacity. Moving 12pt to Atlas 25 keeps velocity within trend.
                </div>
                <div className="vstack" style={{gap:5, marginBottom:12, fontSize:12}}>
                  <div className="hstack" style={{gap:6}}><Icon name="dot" size={14} color="var(--ai-violet)"/>Coverage drift detected on /payments</div>
                  <div className="hstack" style={{gap:6}}><Icon name="dot" size={14} color="var(--ai-violet)"/>Sasha's review queue grew 3× this week</div>
                  <div className="hstack" style={{gap:6}}><Icon name="dot" size={14} color="var(--ai-violet)"/>Cycle time creeping past 3d threshold</div>
                </div>
                <Button variant="ai" size="sm" icon="arrow-right">See full report</Button>
              </div>

              {/* Workload heatmap */}
              <div className="card" style={{gridColumn:"span 8", padding:16}}>
                <div className="hstack" style={{justifyContent:"space-between", marginBottom:10}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:600}}>Team workload</div>
                    <div className="muted" style={{fontSize:11}}>Daily story-points assigned · last 2 weeks</div>
                  </div>
                  <div className="hstack" style={{gap:10, fontSize:11}}>
                    <span className="hstack" style={{gap:4}}><span style={{width:8,height:8,background:"rgba(91,106,240,0.45)", borderRadius:2}}/>Healthy</span>
                    <span className="hstack" style={{gap:4}}><span style={{width:8,height:8,background:"rgba(224,162,58,0.45)", borderRadius:2}}/>Stretched</span>
                    <span className="hstack" style={{gap:4}}><span style={{width:8,height:8,background:"rgba(229,72,77,0.5)", borderRadius:2}}/>Overloaded</span>
                  </div>
                </div>
                <WorkloadHeat/>
              </div>

              {/* Recent activity */}
              <div className="card" style={{gridColumn:"span 4", padding:16}}>
                <div style={{fontSize:13, fontWeight:600, marginBottom:10}}>Recent activity</div>
                <div className="vstack" style={{gap:10}}>
                  {[
                    { who:"Marcus Chen", c:2, action:"merged", target:"ATLAS-244", time:"12m" },
                    { who:"Priya Patel", c:1, action:"commented on", target:"ATLAS-247", time:"36m" },
                    { who:"Sasha Volkov", c:3, action:"linked", target:"ATLAS-302 → INC-441", time:"1h" },
                    { who:"Stratos AI", c:5, action:"drafted plan for", target:"EPIC-Onboarding", time:"3h", ai:true },
                  ].map((a, i) => (
                    <div key={i} className="hstack" style={{gap:8, fontSize:12}}>
                      {a.ai ? <span style={{width:18,height:18,borderRadius:"50%",background:"linear-gradient(135deg,var(--ai-violet),var(--accent-primary))",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="sparkles" size={10} color="#fff"/></span> : <Avatar name={a.who} color={a.c} size="xs"/>}
                      <span style={{flex:1, lineHeight:1.5}}>
                        <span style={{fontWeight:500}}>{a.who}</span> <span className="muted">{a.action}</span> <span className="mono" style={{color:"var(--accent-primary)"}}>{a.target}</span>
                      </span>
                      <span className="mono dim" style={{fontSize:11}}>{a.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.ScreenDashboard = ScreenDashboard;
