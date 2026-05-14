/* section-components.jsx — Core component showcase */

function SC_Row({ label, children, sublabel }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"160px 1fr", gap:24, padding:"16px 0", borderTop:"1px solid var(--border-subtle)", alignItems:"center"}}>
      <div>
        <div style={{fontSize:13, fontWeight:500}}>{label}</div>
        {sublabel && <div className="mono" style={{fontSize:11, color:"var(--text-muted)"}}>{sublabel}</div>}
      </div>
      <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        {children}
      </div>
    </div>
  );
}

function SC_Card({ title, children, cols = "1fr" }) {
  return (
    <div className="card" style={{padding:"6px 20px 14px"}}>
      <div className="subsection" style={{marginTop:14}}>{title}</div>
      <div style={{display:"grid", gridTemplateColumns: cols, gap: 24}}>
        {children}
      </div>
    </div>
  );
}

function SectionComponents() {
  // Local interactive states for the showcase
  const [inputVal, setInputVal] = React.useState("Atlas API rewrite");
  const [searchVal, setSearchVal] = React.useState("");
  const [tab, setTab] = React.useState("overview");
  const [showMenu, setShowMenu] = React.useState(true);

  return (
    <div className="vstack" style={{gap:32}}>

      {/* --- BUTTONS --- */}
      <SC_Card title="Buttons">
        <div>
          <div className="subsection" style={{marginTop:0, color:"var(--text-tertiary)"}}>Primary</div>
          <SC_Row label="Default">
            <Button variant="primary" size="sm">Create task</Button>
            <Button variant="primary" size="md" icon="plus">Create task</Button>
            <Button variant="primary" size="lg" icon="plus">Create task</Button>
          </SC_Row>
          <SC_Row label="Hover / Active / Disabled">
            <Button variant="primary" size="md" icon="plus" style={{background:"var(--accent-primary-hover)"}}>Hover</Button>
            <Button variant="primary" size="md" state="active" icon="plus">Active</Button>
            <Button variant="primary" size="md" state="disabled" icon="plus">Disabled</Button>
          </SC_Row>

          <div className="subsection" style={{color:"var(--text-tertiary)"}}>Secondary</div>
          <SC_Row label="States">
            <Button variant="secondary" size="md" icon="filter">Filter</Button>
            <Button variant="secondary" size="md" icon="filter" style={{background:"var(--bg-surface-2)", borderColor:"var(--border-strong)"}}>Hover</Button>
            <Button variant="secondary" size="md" state="active" icon="filter">Active</Button>
            <Button variant="secondary" size="md" state="disabled" icon="filter">Disabled</Button>
          </SC_Row>

          <div className="subsection" style={{color:"var(--text-tertiary)"}}>Ghost</div>
          <SC_Row label="States">
            <Button variant="ghost" size="md" icon="more-horizontal">More</Button>
            <Button variant="ghost" size="md" icon="more-horizontal" style={{background:"var(--bg-hover)", color:"var(--text-primary)"}}>Hover</Button>
            <Button variant="ghost" size="md" state="active" icon="more-horizontal">Active</Button>
            <Button variant="ghost" size="md" state="disabled" icon="more-horizontal">Disabled</Button>
          </SC_Row>

          <div className="subsection" style={{color:"var(--text-tertiary)"}}>Danger & AI</div>
          <SC_Row label="States">
            <Button variant="danger" size="md" icon="trash-2">Delete sprint</Button>
            <Button variant="danger" size="md" state="active" icon="trash-2">Active</Button>
            <Button variant="ai" size="md" icon="sparkles">Generate plan</Button>
          </SC_Row>

          <div className="subsection" style={{color:"var(--text-tertiary)"}}>Icon-only</div>
          <SC_Row label="24 / 30 px">
            <Button variant="ghost" size="sm" className="btn-icon-sm" icon="plus" />
            <Button variant="secondary" size="md" style={{width:30, padding:0}} icon="filter" />
            <Button variant="ghost" size="md" style={{width:30, padding:0}} icon="more-horizontal" />
          </SC_Row>
        </div>
      </SC_Card>

      {/* --- INPUTS --- */}
      <SC_Card title="Inputs">
        <div>
          <SC_Row label="Text · default + hover + focus">
            <input className="input" defaultValue="Atlas API rewrite" style={{width:240}}/>
            <input className="input" defaultValue="Hover state" style={{width:240, borderColor:"var(--border-strong)"}}/>
            <input className="input is-focused" defaultValue="Focused" style={{width:240}}/>
          </SC_Row>
          <SC_Row label="Disabled · error">
            <input className="input" defaultValue="Read-only" disabled style={{width:240}}/>
            <input className="input is-error" defaultValue="invalid-handle@" style={{width:240}}/>
          </SC_Row>
          <SC_Row label="With label + help">
            <div style={{width:280}}>
              <label className="input-label">Sprint name</label>
              <input className="input" defaultValue="Atlas 24" />
              <div className="input-help">2-week sprint, starts Monday.</div>
            </div>
            <div style={{width:280}}>
              <label className="input-label" style={{color:"var(--status-danger)"}}>Story points</label>
              <input className="input is-error" defaultValue="—" />
              <div className="input-help is-error">Required for committed stories.</div>
            </div>
          </SC_Row>
          <SC_Row label="Search · with shortcut">
            <div className="input-search" style={{width:320}}>
              <Icon name="search" size={13}/>
              <input className="input" placeholder="Search tasks, people, docs…"/>
              <span className="kbd">⌘K</span>
            </div>
          </SC_Row>
          <SC_Row label="Textarea">
            <textarea className="textarea" defaultValue="When a user invites the same email twice within 7d, surface 'Already invited' with a Resend button." style={{width:360}}/>
          </SC_Row>
          <SC_Row label="Select">
            <select className="select" defaultValue="medium" style={{width:200}}>
              <option>Low</option><option value="medium">Medium</option><option>High</option><option>Urgent</option>
            </select>
          </SC_Row>
        </div>
      </SC_Card>

      {/* --- BADGES --- */}
      <SC_Card title="Badges">
        <div>
          <SC_Row label="Status">
            <StatusBadge status="backlog"/>
            <StatusBadge status="todo"/>
            <StatusBadge status="in_progress"/>
            <StatusBadge status="in_review"/>
            <StatusBadge status="blocked"/>
            <StatusBadge status="done"/>
          </SC_Row>
          <SC_Row label="Priority">
            <span className="hstack" style={{gap:6}}><Priority level="low"/> <span className="muted" style={{fontSize:12}}>Low</span></span>
            <span className="hstack" style={{gap:6}}><Priority level="med"/> <span className="muted" style={{fontSize:12}}>Medium</span></span>
            <span className="hstack" style={{gap:6}}><Priority level="high"/> <span className="muted" style={{fontSize:12}}>High</span></span>
            <span className="hstack" style={{gap:6}}><Priority level="urgent"/> <span className="muted" style={{fontSize:12}}>Urgent</span></span>
          </SC_Row>
          <SC_Row label="Labels (tone)">
            <Badge tone="neutral" dot>backend</Badge>
            <Badge tone="info" dot>infra</Badge>
            <Badge tone="purple" dot>design</Badge>
            <Badge tone="warning" dot>tech-debt</Badge>
            <Badge tone="danger" dot>incident</Badge>
            <Badge tone="success" dot>shipped</Badge>
          </SC_Row>
        </div>
      </SC_Card>

      {/* --- AVATARS --- */}
      <SC_Card title="Avatars">
        <div>
          <SC_Row label="Sizes">
            <Avatar name="Priya Patel" color={1} size="xs"/>
            <Avatar name="Marcus Chen" color={2} size="sm"/>
            <Avatar name="Sasha Volkov" color={3} size="md"/>
            <Avatar name="Diego Ramos" color={4} size="lg"/>
            <Avatar name="Hana Sato" color={5} size="xl"/>
          </SC_Row>
          <SC_Row label="With status dot">
            <Avatar name="Priya Patel" color={1} size="md" status="online"/>
            <Avatar name="Marcus Chen" color={2} size="md" status="busy"/>
            <Avatar name="Sasha Volkov" color={3} size="md" status="away"/>
            <Avatar name="Diego Ramos" color={4} size="md" status="offline"/>
          </SC_Row>
          <SC_Row label="Stacks">
            <AvatarStack size="sm" people={PEOPLE.slice(0,3)}/>
            <AvatarStack size="sm" people={PEOPLE.slice(0,5)}/>
            <AvatarStack size="md" people={PEOPLE} max={4}/>
          </SC_Row>
        </div>
      </SC_Card>

      {/* --- CARDS --- */}
      <SC_Card title="Cards" cols="1fr 1fr 1fr">
        <div className="card">
          <div className="hstack" style={{justifyContent:"space-between", marginBottom:8}}>
            <span className="mono" style={{fontSize:11, color:"var(--text-muted)"}}>PROJ-247</span>
            <Priority level="high"/>
          </div>
          <div style={{fontWeight:500, marginBottom:8, lineHeight:1.35}}>Fix race condition in invite token expiry</div>
          <div className="hstack" style={{justifyContent:"space-between"}}>
            <StatusBadge status="in_progress"/>
            <Avatar name="Priya Patel" color={1}/>
          </div>
          <div className="muted" style={{fontSize:11, marginTop:10, fontFamily:"var(--font-mono)"}}>Default card · --bg-surface-1</div>
        </div>
        <div className="card card-elevated">
          <div className="hstack" style={{justifyContent:"space-between", marginBottom:8}}>
            <span className="mono" style={{fontSize:11, color:"var(--text-muted)"}}>PROJ-302</span>
            <Priority level="urgent"/>
          </div>
          <div style={{fontWeight:500, marginBottom:8, lineHeight:1.35}}>Webhook retries flooding when downstream 503s</div>
          <div className="hstack" style={{justifyContent:"space-between"}}>
            <StatusBadge status="blocked"/>
            <Avatar name="Marcus Chen" color={2}/>
          </div>
          <div className="muted" style={{fontSize:11, marginTop:10, fontFamily:"var(--font-mono)"}}>Elevated · --bg-surface-2 + shadow-md</div>
        </div>
        <div className="card-ai">
          <div className="hstack" style={{justifyContent:"space-between", marginBottom:8}}>
            <AIChip>AI suggestion</AIChip>
            <Icon name="x" size={12} color="var(--text-muted)"/>
          </div>
          <div style={{fontWeight:500, marginBottom:6, lineHeight:1.35}}>Split this story — it spans two services</div>
          <div className="muted" style={{fontSize:12, marginBottom:10}}>Estimated 13 points across <span className="mono">api-core</span> and <span className="mono">notifications</span>.</div>
          <div className="hstack" style={{gap:6}}>
            <Button variant="primary" size="sm">Apply</Button>
            <Button variant="ghost" size="sm">Dismiss</Button>
          </div>
        </div>
      </SC_Card>

      {/* --- TABS --- */}
      <SC_Card title="Tabs">
        <div>
          <div className="tabs">
            {["overview","tasks","timeline","files","activity"].map((t, i) => (
              <div key={t} className={`tab ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
                <Icon name={["layout-grid","list-checks","calendar","paperclip","activity"][i]} size={12}/>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {i === 1 && <span className="count">42</span>}
              </div>
            ))}
          </div>
          <div className="muted" style={{padding:16, fontSize:13}}>Active tab: <span className="mono">{tab}</span> · click to switch.</div>
        </div>
      </SC_Card>

      {/* --- DROPDOWN / TOOLTIP --- */}
      <SC_Card title="Dropdown · Tooltip" cols="320px 1fr">
        <div className="menu">
          <div className="menu-section">Change status</div>
          {Object.entries(STATUS).map(([k, v]) => (
            <div key={k} className={`menu-item ${k === "in_progress" ? "is-selected" : ""}`}>
              <Icon name={v.icon} size={13} color={`var(--status-${v.tone === "neutral" ? "neutral" : v.tone})`} />
              <span>{v.label}</span>
              {k === "in_progress" && <Icon name="check" size={12} style={{marginLeft:"auto"}} color="var(--accent-primary)"/>}
            </div>
          ))}
          <div className="menu-divider"/>
          <div className="menu-item">
            <Icon name="copy" size={13}/> Copy task URL <span className="shortcut">⌘⇧C</span>
          </div>
          <div className="menu-item">
            <Icon name="archive" size={13}/> Archive <span className="shortcut">E</span>
          </div>
          <div className="menu-item is-danger">
            <Icon name="trash-2" size={13}/> Delete <span className="shortcut">⌫</span>
          </div>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:18, alignItems:"flex-start"}}>
          <div className="tooltip">Mark as done <span className="kbd">⌘⏎</span></div>
          <div className="tooltip">Velocity: 38 pts last sprint (+12%)</div>
          <div className="tooltip" style={{background:"var(--status-danger-bg)", color:"#FB8B8F", border:"1px solid var(--status-danger-border)"}}>Blocked by PROJ-198</div>
        </div>
      </SC_Card>

      {/* --- TOASTS --- */}
      <SC_Card title="Toasts" cols="1fr 1fr 1fr">
        <div className="toast toast-success">
          <div className="toast-icon"><Icon name="check" size={14}/></div>
          <div className="grow">
            <div className="toast-title">Sprint started</div>
            <div className="toast-body">Atlas 24 · 14 days · 41 committed points</div>
          </div>
          <span className="toast-close"><Icon name="x" size={13}/></span>
        </div>
        <div className="toast toast-danger">
          <div className="toast-icon"><Icon name="triangle-alert" size={14}/></div>
          <div className="grow">
            <div className="toast-title">Couldn't save changes</div>
            <div className="toast-body">PROJ-247 was edited by Marcus. <a style={{color:"var(--accent-primary)"}}>Review conflict</a></div>
          </div>
          <span className="toast-close"><Icon name="x" size={13}/></span>
        </div>
        <div className="toast toast-info">
          <div className="toast-icon"><Icon name="sparkles" size={14}/></div>
          <div className="grow">
            <div className="toast-title">AI drafted 6 tasks</div>
            <div className="toast-body">Review and edit before saving. <a style={{color:"var(--accent-primary)"}}>Open</a></div>
          </div>
          <span className="toast-close"><Icon name="x" size={13}/></span>
        </div>
      </SC_Card>

      {/* --- MODAL --- */}
      <SC_Card title="Modal">
        <div style={{position:"relative", height: 360, background:"var(--bg-app)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", overflow:"hidden"}}>
          <div className="modal-backdrop"/>
          <div className="modal" style={{position:"absolute", top:30, left:"50%", transform:"translateX(-50%)"}}>
            <div className="modal-header">
              <div className="hstack" style={{gap:10}}>
                <div style={{width:28, height:28, borderRadius:"var(--radius-md)", background:"var(--status-danger-bg)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--status-danger)"}}>
                  <Icon name="triangle-alert" size={14}/>
                </div>
                <div className="modal-title">Delete sprint Atlas 24?</div>
              </div>
              <Icon name="x" size={14} color="var(--text-muted)"/>
            </div>
            <div className="modal-body">
              <div style={{color:"var(--text-secondary)", fontSize:13, lineHeight:1.55}}>
                This will remove the sprint and unschedule its 18 in-flight tasks. The tasks return to the project backlog. <strong>This can't be undone.</strong>
              </div>
              <label className="input-label" style={{marginTop:18}}>Type <span className="mono" style={{color:"var(--text-primary)"}}>delete atlas 24</span> to confirm</label>
              <input className="input" placeholder="delete atlas 24"/>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" size="md">Cancel</Button>
              <Button variant="danger" size="md" state="disabled">Delete sprint</Button>
            </div>
          </div>
        </div>
      </SC_Card>

    </div>
  );
}

window.SectionComponents = SectionComponents;
