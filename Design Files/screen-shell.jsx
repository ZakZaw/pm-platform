/* screen-shell.jsx — App Shell screen */

function ShellSidebar({ collapsed }) {
  if (collapsed) {
    return (
      <aside className="app-sidebar" style={{width: 56, gridColumn:"1 / 2"}}>
        <div style={{padding:10, display:"flex", justifyContent:"center"}}>
          <div className="org-mark" style={{width:28, height:28, fontSize:13}}>N</div>
        </div>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4, paddingTop:8}}>
          {["inbox","layout-grid","folder-kanban","message-square","video","bar-chart-3","settings"].map((n, i) => (
            <div key={n} className="side-item" style={{justifyContent:"center", width:36, height:32, padding:0, margin:0, background: i===1 ? "var(--bg-selected)" : "transparent"}}>
              <Icon name={n} size={15}/>
            </div>
          ))}
        </div>
      </aside>
    );
  }
  return (
    <aside className="app-sidebar">
      <div className="org">
        <div className="org-mark">N</div>
        <div className="grow">
          <div className="org-name">Nimbus Co.</div>
          <div className="org-plan">Business · 38 seats</div>
        </div>
        <Icon name="chevrons-up-down" size={12} color="var(--text-muted)"/>
      </div>

      <div className="side-section">Workspace</div>
      <div className="side-item"><Icon name="inbox" size={13}/> Inbox <span className="count">7</span></div>
      <div className="side-item active"><Icon name="layout-grid" size={13}/> My work <span className="pip"/></div>
      <div className="side-item"><Icon name="folder-kanban" size={13}/> Projects</div>
      <div className="side-item"><Icon name="message-square" size={13}/> Chat <span className="count">12</span></div>
      <div className="side-item"><Icon name="video" size={13}/> Meetings</div>
      <div className="side-item"><Icon name="bar-chart-3" size={13}/> Insights</div>

      <div className="side-section">Projects <Icon name="plus" size={11} color="var(--text-muted)"/></div>
      {[
        ["Atlas — Public API", "av-1"],
        ["Orbit — Mobile app", "av-2"],
        ["Helios — Onboarding", "av-3"],
        ["Vega — Billing", "av-4"],
      ].map(([n, c]) => (
        <div key={n} className="side-item">
          <span style={{width:10, height:10, borderRadius:3}} className={c}></span>
          <span className="truncate">{n}</span>
        </div>
      ))}

      <div className="side-section">Channels</div>
      {["# eng-atlas", "# product", "# design-crit", "# incident"].map(n => (
        <div key={n} className="side-item"><span className="dim" style={{width:13}}></span> <span className="truncate">{n}</span></div>
      ))}

      <div className="side-footer">
        <Avatar name="Priya Patel" color={1} size="sm" status="online"/>
        <div className="grow">
          <div style={{fontSize:12, fontWeight:500}}>Priya Patel</div>
          <div className="mono" style={{fontSize:10, color:"var(--text-muted)"}}>priya@nimbus.co</div>
        </div>
        <Icon name="settings" size={13} color="var(--text-muted)"/>
      </div>
    </aside>
  );
}

function ShellTopbar({ collapsed, onToggle, project = "Atlas — Public API" }) {
  return (
    <header className="app-topbar">
      <span className="icon-btn" onClick={onToggle} title="Toggle sidebar">
        <Icon name={collapsed ? "panel-left-open" : "panel-left-close"} size={14}/>
      </span>
      <div className="crumb">
        <span>Projects</span>
        <span className="sep">/</span>
        <span className="here">{project}</span>
        <span className="sep">/</span>
        <span>Board</span>
      </div>
      <div className="topbar-spacer"/>
      <div className="search-mini input-search">
        <Icon name="search" size={12}/>
        <input className="input" placeholder="Search or jump to…"/>
        <span className="kbd">⌘K</span>
      </div>
      <div className="divider-y"/>
      <div className="topbar-actions">
        <span className="icon-btn"><Icon name="sparkles" size={14} color="var(--ai-violet)"/></span>
        <span className="icon-btn"><Icon name="bell" size={14}/><span className="indicator"/></span>
        <span className="icon-btn"><Icon name="help-circle" size={14}/></span>
        <Avatar name="Priya Patel" color={1} size="sm" status="online"/>
      </div>
    </header>
  );
}

function ScreenShell() {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-01</span>
        <span className="mock-name">App Shell</span>
        <span className="mock-desc">Sidebar collapses to icon rail · Cmd+\</span>
      </div>
      <div className="mock">
        <div className="app" style={{gridTemplateColumns: collapsed ? "56px 1fr" : "220px 1fr"}}>
          <ShellSidebar collapsed={collapsed}/>
          <ShellTopbar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)}/>
          <section className="app-main">
            <div className="page-header">
              <div className="grow">
                <div className="hstack" style={{gap:8}}>
                  <div className="page-title">My work</div>
                  <Badge tone="neutral">14 open</Badge>
                </div>
                <div className="muted" style={{fontSize:12, marginTop:2}}>Tasks assigned to you across all projects.</div>
              </div>
              <div className="hstack" style={{gap:6}}>
                <Button variant="ghost" size="md" icon="list">List</Button>
                <Button variant="ghost" size="md" state="active" icon="kanban">Board</Button>
                <Button variant="ghost" size="md" icon="calendar">Calendar</Button>
                <div className="divider-y" style={{height:20}}/>
                <Button variant="secondary" size="md" icon="filter">Filter</Button>
                <Button variant="primary" size="md" icon="plus">New task</Button>
              </div>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16, padding:20, alignContent:"start"}}>
              {[
                { title:"In Progress", count: 4, status:"in_progress" },
                { title:"In Review",   count: 3, status:"in_review" },
                { title:"To Do",       count: 7, status:"todo" },
              ].map(col => (
                <div key={col.title} className="vstack" style={{gap:10}}>
                  <div className="hstack" style={{justifyContent:"space-between", padding:"2px 4px"}}>
                    <div className="hstack" style={{gap:8}}>
                      <StatusBadge status={col.status}/>
                      <span className="mono dim" style={{fontSize:11}}>{col.count}</span>
                    </div>
                    <Icon name="more-horizontal" size={13} color="var(--text-muted)"/>
                  </div>
                  {Array.from({length:2}).map((_, i) => (
                    <div key={i} className="card" style={{padding:12}}>
                      <div className="hstack" style={{justifyContent:"space-between", marginBottom:6}}>
                        <span className="mono dim" style={{fontSize:11}}>ATLAS-{200 + i*5 + col.count}</span>
                        <Priority level={["high","med","low","urgent"][i % 4]}/>
                      </div>
                      <div style={{fontSize:13, fontWeight:500, lineHeight:1.35, marginBottom:8}}>
                        {[
                          "Migrate webhook delivery to NATS queue",
                          "Decline duplicate invite emails within 7d",
                          "Audit token expiry edge cases",
                          "Spec rate-limit headers for public endpoints",
                          "Backfill org_id on legacy audit rows",
                        ][i + col.count % 5]}
                      </div>
                      <div className="hstack" style={{justifyContent:"space-between"}}>
                        <Avatar name={PEOPLE[(i + col.count) % PEOPLE.length].name} color={PEOPLE[(i + col.count) % PEOPLE.length].color}/>
                        <span className="mono dim" style={{fontSize:11}}>{3 + i}pt</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.ScreenShell = ScreenShell;
window.ShellSidebar = ShellSidebar;
window.ShellTopbar = ShellTopbar;
