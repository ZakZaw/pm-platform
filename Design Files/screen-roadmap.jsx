/* screen-roadmap.jsx — Roadmap / Gantt */

const EPICS = [
  { id:"EPIC-12", title:"Auth hardening", owner:0, color:"#5B6AF0", start:0,  end:6,  prog:0.55, status:"in_progress" },
  { id:"EPIC-14", title:"Self-serve onboarding", owner:1, color:"#7A6BFF", start:2,  end:10, prog:0.20, status:"in_progress" },
  { id:"EPIC-15", title:"Webhook reliability v2", owner:3, color:"#4FD1E0", start:1,  end:5,  prog:0.85, status:"in_progress" },
  { id:"EPIC-16", title:"Billing — invoice history", owner:4, color:"#E0A23A", start:7,  end:13, prog:0,    status:"todo" },
  { id:"EPIC-17", title:"Public API v2 spec", owner:2, color:"#C77BFF", start:5,  end:14, prog:0.10, status:"todo" },
  { id:"EPIC-18", title:"Audit log export", owner:5, color:"#3FB984", start:9,  end:12, prog:0,    status:"todo" },
  { id:"EPIC-19", title:"SOC2 evidence automation", owner:6, color:"#E5484D", start:11, end:18, prog:0,    status:"todo", dep:"EPIC-12" },
];

const MILESTONES = [
  { week: 4,  label:"Beta — Atlas v1.1" },
  { week: 9,  label:"Self-serve GA" },
  { week: 13, label:"SOC2 audit start" },
];

function ScreenRoadmap() {
  const WEEKS = 18;
  const colWidth = 60; // px per week
  const labelWidth = 240;
  const rowHeight = 36;
  const todayWeek = 5.4;

  const months = [
    { name:"May",  weeks: 4 },
    { name:"Jun",  weeks: 5 },
    { name:"Jul",  weeks: 4 },
    { name:"Aug",  weeks: 5 },
  ];

  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-06</span>
        <span className="mock-name">Roadmap</span>
        <span className="mock-desc">Atlas program · Q2 · Month view · Today line at week 5</span>
      </div>
      <div className="mock" style={{height: 720}}>
        <div className="app" style={{gridTemplateColumns:"56px 1fr"}}>
          <ShellSidebar collapsed={true}/>
          <ShellTopbar collapsed={true} onToggle={()=>{}} project="Atlas program"/>
          <section className="app-main">
            {/* toolbar */}
            <div className="page-header" style={{padding:"10px 16px"}}>
              <div className="hstack" style={{gap:8}}>
                <Icon name="git-merge" size={14}/>
                <span className="page-title">Roadmap</span>
                <Badge tone="info">7 epics</Badge>
              </div>
              <span className="grow"/>
              <div className="hstack" style={{gap:6}}>
                <div className="hstack" style={{padding:2, background:"var(--bg-surface-1)", border:"1px solid var(--border-default)", borderRadius:"var(--radius-md)"}}>
                  <Button variant="ghost" size="sm">Week</Button>
                  <Button variant="ghost" size="sm" state="active">Month</Button>
                  <Button variant="ghost" size="sm">Quarter</Button>
                </div>
                <Button variant="secondary" size="md" icon="filter">Owner</Button>
                <Button variant="secondary" size="md" icon="layers">Group: Epic</Button>
                <Button variant="primary" size="md" icon="plus">New epic</Button>
              </div>
            </div>

            {/* Roadmap grid */}
            <div style={{flex:1, overflow:"auto", position:"relative"}}>
              <div style={{display:"grid", gridTemplateColumns:`${labelWidth}px 1fr`, minWidth: labelWidth + WEEKS * colWidth}}>
                {/* Header */}
                <div style={{position:"sticky", left:0, top:0, zIndex:3, background:"var(--bg-base)", borderRight:"1px solid var(--border-subtle)", borderBottom:"1px solid var(--border-subtle)"}}>
                  <div style={{padding:"10px 14px", fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600}}>Epic</div>
                </div>
                <div style={{position:"sticky", top:0, zIndex:2, background:"var(--bg-base)", borderBottom:"1px solid var(--border-subtle)"}}>
                  {/* Month row */}
                  <div style={{display:"flex", height: 22, borderBottom:"1px solid var(--border-subtle)"}}>
                    {months.map(m => (
                      <div key={m.name} style={{width: m.weeks * colWidth, padding:"3px 8px", borderRight:"1px solid var(--border-subtle)", fontSize:11, color:"var(--text-secondary)", fontWeight:500, letterSpacing:"0.02em"}}>
                        {m.name} <span className="dim mono" style={{fontSize:10}}>2026</span>
                      </div>
                    ))}
                  </div>
                  {/* Week row */}
                  <div style={{display:"flex", height: 24}}>
                    {Array.from({length: WEEKS}).map((_, i) => (
                      <div key={i} style={{width: colWidth, padding:"4px 6px", borderRight:"1px solid var(--border-subtle)", fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)"}}>
                        W{i + 18}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div style={{position:"sticky", left:0, zIndex:1, background:"var(--bg-base)", borderRight:"1px solid var(--border-subtle)"}}>
                  {EPICS.map(e => (
                    <div key={e.id} style={{height: rowHeight, display:"flex", alignItems:"center", gap:8, padding:"0 12px", borderBottom:"1px solid var(--border-subtle)"}}>
                      <span style={{width:8, height:8, borderRadius:2, background:e.color, flexShrink:0}}/>
                      <div className="grow truncate" style={{fontSize:13, fontWeight:500}}>{e.title}</div>
                      <Avatar name={PEOPLE[e.owner].name} color={PEOPLE[e.owner].color} size="xs"/>
                    </div>
                  ))}
                </div>
                <div style={{position:"relative"}}>
                  {/* Grid lines */}
                  <div style={{position:"absolute", inset:0, display:"flex", pointerEvents:"none"}}>
                    {Array.from({length: WEEKS}).map((_, i) => (
                      <div key={i} style={{width: colWidth, borderRight:"1px solid var(--border-subtle)"}}/>
                    ))}
                  </div>
                  {/* Today line */}
                  <div style={{position:"absolute", top:0, bottom:0, left: todayWeek * colWidth, borderLeft:"1.5px solid var(--accent-primary)", zIndex:4}}>
                    <span style={{position:"absolute", top:-4, left:-22, padding:"1px 6px", background:"var(--accent-primary)", color:"white", fontSize:10, fontFamily:"var(--font-mono)", fontWeight:600, borderRadius:"var(--radius-sm)"}}>TODAY</span>
                  </div>
                  {/* Milestones */}
                  {MILESTONES.map((m, i) => (
                    <div key={i} style={{position:"absolute", top:6, left: m.week * colWidth - 7, zIndex:3}}>
                      <div style={{width:14, height:14, background:"var(--ai-cyan)", transform:"rotate(45deg)", border:"1.5px solid var(--bg-base)"}}/>
                      <div style={{position:"absolute", top:18, left:-50, width:120, fontSize:10, color:"var(--ai-cyan)", textAlign:"center", whiteSpace:"nowrap", fontWeight:500}}>
                        {m.label}
                      </div>
                    </div>
                  ))}
                  {/* Epic bars */}
                  {EPICS.map((e, idx) => {
                    const left = e.start * colWidth + 2;
                    const width = (e.end - e.start) * colWidth - 4;
                    const top = idx * rowHeight + 8;
                    return (
                      <div key={e.id} style={{position:"absolute", left, top, width, height: rowHeight - 16}}>
                        <div style={{position:"relative", width:"100%", height:"100%", background:`linear-gradient(90deg, ${e.color}55, ${e.color}33)`, border:`1px solid ${e.color}`, borderRadius:"var(--radius-md)", overflow:"hidden"}}>
                          <div style={{position:"absolute", inset:0, width:`${e.prog * 100}%`, background: e.color, opacity:0.55}}/>
                          <div style={{position:"relative", padding:"2px 8px", display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#fff", fontWeight:500, height:"100%"}}>
                            <span className="mono" style={{fontSize:10, opacity:0.85}}>{e.id}</span>
                            <span className="truncate">{e.title}</span>
                            <span className="grow"/>
                            <span className="mono" style={{fontSize:10, opacity:0.85}}>{Math.round(e.prog*100)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Dependency arrow: EPIC-12 -> EPIC-19 */}
                  <svg style={{position:"absolute", left:0, top:0, width: WEEKS * colWidth, height: EPICS.length * rowHeight, pointerEvents:"none"}}>
                    <defs>
                      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-tertiary)"/>
                      </marker>
                    </defs>
                    {/* from end of EPIC-12 (row 0, week 6) to start of EPIC-19 (row 6, week 11) */}
                    <path d={`M ${6 * colWidth} ${0 * rowHeight + rowHeight/2} L ${(6 * colWidth) + 12} ${0 * rowHeight + rowHeight/2} L ${(6 * colWidth) + 12} ${6 * rowHeight + rowHeight/2} L ${11 * colWidth + 2} ${6 * rowHeight + rowHeight/2}`} stroke="var(--text-tertiary)" strokeWidth="1.2" strokeDasharray="3 3" fill="none" markerEnd="url(#arrow)"/>
                  </svg>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.ScreenRoadmap = ScreenRoadmap;
