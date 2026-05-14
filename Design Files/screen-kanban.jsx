/* screen-kanban.jsx — Kanban Board */

const KANBAN_TASKS = {
  todo: [
    { id:"ATLAS-318", title:"Add idempotency-key header to POST /payments", prio:"high", pts:3, who:0, comments:2, files:0 },
    { id:"ATLAS-321", title:"Document deprecation timeline for v1 routes", prio:"low", pts:2, who:6, comments:0, files:1 },
    { id:"ATLAS-325", title:"Reject org-scoped tokens at /admin endpoints", prio:"urgent", pts:5, who:2, comments:5, files:0 },
    { id:"ATLAS-330", title:"Spec rate-limit headers across public endpoints", prio:"med", pts:3, who:4, comments:1, files:2 },
  ],
  in_progress: [
    { id:"ATLAS-247", title:"Fix race condition in invite token expiry", prio:"high", pts:5, who:0, comments:8, files:1 },
    { id:"ATLAS-279", title:"Migrate webhook delivery to NATS queue", prio:"high", pts:8, who:1, comments:3, files:0 },
    { id:"ATLAS-291", title:"Backfill org_id on legacy audit rows", prio:"med", pts:5, who:3, comments:2, files:0 },
  ],
  in_review: [
    { id:"ATLAS-258", title:"Surface 'Already invited' on duplicate emails", prio:"med", pts:2, who:5, comments:4, files:0 },
    { id:"ATLAS-264", title:"Cap nested mention depth at 3 levels", prio:"low", pts:2, who:7, comments:1, files:0 },
  ],
  blocked: [
    { id:"ATLAS-302", title:"Webhook retries flooding when downstream 503s", prio:"urgent", pts:5, who:1, comments:11, files:3, blocker:"ATLAS-198" },
  ],
  done: [
    { id:"ATLAS-241", title:"Bump @nimbus/auth-sdk to 4.2.1", prio:"low", pts:1, who:2, comments:0, files:0 },
    { id:"ATLAS-244", title:"Add Snowflake mirror for billing.events", prio:"med", pts:3, who:3, comments:2, files:1 },
    { id:"ATLAS-251", title:"Drop deprecated /v1/teams alias", prio:"med", pts:2, who:0, comments:1, files:0 },
    { id:"ATLAS-256", title:"Retry on transient 502s from invite worker", prio:"low", pts:1, who:4, comments:0, files:0 },
  ],
};

const COLUMNS = [
  { key:"todo",        label:"To Do",       status:"todo" },
  { key:"in_progress", label:"In Progress", status:"in_progress" },
  { key:"in_review",   label:"In Review",   status:"in_review" },
  { key:"blocked",     label:"Blocked",     status:"blocked" },
  { key:"done",        label:"Done",        status:"done" },
];

function Sparkline({ points = [40, 38, 35, 33, 30, 26, 22, 19, 15, 12, 9, 5], width = 140, height = 28, ideal = true }) {
  const max = Math.max(...points);
  const step = width / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - (p / max) * height}`).join(" ");
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {ideal && <line x1="0" y1="2" x2={width} y2={height - 2} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2 3"/>}
      <path d={path} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(points.length-1)*step} cy={height - (points[points.length-1]/max)*height} r="2.5" fill="var(--accent-primary)"/>
    </svg>
  );
}

function KanbanCard({ task }) {
  return (
    <div className="card" style={{padding:10, cursor:"grab"}}>
      <div className="hstack" style={{justifyContent:"space-between", marginBottom:6}}>
        <span className="mono dim" style={{fontSize:11}}>{task.id}</span>
        <Priority level={task.prio}/>
      </div>
      <div style={{fontSize:13, fontWeight:500, lineHeight:1.38, marginBottom:8, color:"var(--text-primary)"}}>{task.title}</div>
      {task.blocker && (
        <div className="hstack" style={{gap:6, padding:"4px 6px", background:"var(--status-danger-bg)", border:"1px solid var(--status-danger-border)", borderRadius:"var(--radius-sm)", fontSize:11, color:"#FB8B8F", marginBottom:8}}>
          <Icon name="link" size={11}/> Blocked by <span className="mono">{task.blocker}</span>
        </div>
      )}
      <div className="hstack" style={{justifyContent:"space-between"}}>
        <Avatar name={PEOPLE[task.who].name} color={PEOPLE[task.who].color}/>
        <div className="hstack" style={{gap:8, color:"var(--text-muted)", fontSize:11}}>
          {task.comments > 0 && <span className="hstack" style={{gap:3}}><Icon name="message-square" size={11}/>{task.comments}</span>}
          {task.files > 0 && <span className="hstack" style={{gap:3}}><Icon name="paperclip" size={11}/>{task.files}</span>}
          <span className="mono" style={{padding:"1px 5px", background:"var(--bg-surface-2)", borderRadius:"var(--radius-xs)"}}>{task.pts}</span>
        </div>
      </div>
    </div>
  );
}

function ScreenKanban() {
  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-02</span>
        <span className="mock-name">Kanban Board</span>
        <span className="mock-desc">Atlas — Public API · Sprint 24</span>
      </div>
      <div className="mock">
        <div className="app" style={{height: 760}}>
          <ShellSidebar collapsed={true}/>
          <ShellTopbar collapsed={true} onToggle={()=>{}} project="Atlas — Public API"/>
          <section className="app-main">
            {/* Sprint banner */}
            <div style={{padding:"12px 20px", borderBottom:"1px solid var(--border-subtle)", display:"grid", gridTemplateColumns:"1fr auto auto auto auto", alignItems:"center", gap:24}}>
              <div>
                <div className="hstack" style={{gap:8, marginBottom:2}}>
                  <Badge tone="info" icon="zap">Sprint 24 — Atlas</Badge>
                  <span className="mono dim" style={{fontSize:11}}>May 06 → May 19</span>
                </div>
                <div style={{fontSize:14, color:"var(--text-secondary)"}}>
                  <span style={{color:"var(--text-tertiary)"}}>Goal · </span>
                  Public API can be called with idempotency keys and survives downstream outages with retry isolation.
                </div>
              </div>
              <div className="vstack" style={{alignItems:"flex-end"}}>
                <span className="mono" style={{fontSize:11, color:"var(--text-tertiary)"}}>BURNDOWN</span>
                <Sparkline/>
              </div>
              <div className="vstack" style={{alignItems:"flex-end", paddingLeft:16, borderLeft:"1px solid var(--border-subtle)"}}>
                <span className="mono" style={{fontSize:11, color:"var(--text-tertiary)"}}>POINTS</span>
                <span style={{fontSize:18, fontWeight:600}}>26<span className="muted" style={{fontSize:13, fontWeight:400}}> / 41</span></span>
              </div>
              <div className="vstack" style={{alignItems:"flex-end", paddingLeft:16, borderLeft:"1px solid var(--border-subtle)"}}>
                <span className="mono" style={{fontSize:11, color:"var(--text-tertiary)"}}>DAYS LEFT</span>
                <span style={{fontSize:18, fontWeight:600, color:"var(--status-warning)"}}>4<span className="muted" style={{fontSize:13, fontWeight:400}}> of 14</span></span>
              </div>
              <div className="hstack" style={{gap:6}}>
                <Button variant="secondary" size="md" icon="filter">Filter</Button>
                <Button variant="primary" size="md" icon="plus">Add task</Button>
              </div>
            </div>

            {/* Columns */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(5, minmax(0, 1fr))", gap:12, padding:16, overflow:"auto", flex:1}}>
              {COLUMNS.map(col => {
                const tasks = KANBAN_TASKS[col.key] || [];
                const pts = tasks.reduce((s, t) => s + t.pts, 0);
                return (
                  <div key={col.key} className="vstack" style={{gap:8, minWidth:0}}>
                    <div className="hstack" style={{justifyContent:"space-between", padding:"4px 4px 4px 6px"}}>
                      <div className="hstack" style={{gap:8}}>
                        <StatusBadge status={col.status}/>
                        <span className="mono dim" style={{fontSize:11}}>{tasks.length} · {pts}pt</span>
                      </div>
                      <div className="hstack" style={{gap:2}}>
                        <Icon name="plus" size={12} color="var(--text-muted)"/>
                        <Icon name="more-horizontal" size={12} color="var(--text-muted)"/>
                      </div>
                    </div>
                    <div className="vstack" style={{gap:8}}>
                      {tasks.map(t => <KanbanCard key={t.id} task={t}/>)}
                      <div style={{padding:"8px 10px", border:"1px dashed var(--border-default)", borderRadius:"var(--radius-md)", color:"var(--text-muted)", fontSize:12, textAlign:"center", cursor:"pointer"}}>
                        + Add task
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.ScreenKanban = ScreenKanban;
window.Sparkline = Sparkline;
