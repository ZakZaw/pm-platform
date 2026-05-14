/* screen-ai-wizard.jsx — AI Generation Wizard */

function WizardStepDot({ n, label, state }) {
  const isDone = state === "done";
  const isActive = state === "active";
  return (
    <div className="hstack" style={{gap:8}}>
      <div style={{
        width:22, height:22, borderRadius:"50%",
        background: isActive ? "var(--accent-primary)" : isDone ? "var(--status-success-bg)" : "var(--bg-surface-2)",
        color: isActive ? "white" : isDone ? "var(--status-success)" : "var(--text-muted)",
        border: `1px solid ${isActive ? "var(--accent-primary)" : isDone ? "var(--status-success-border)" : "var(--border-subtle)"}`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600,
      }}>
        {isDone ? <Icon name="check" size={12}/> : n}
      </div>
      <span style={{fontSize:12, color: isActive ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: isActive ? 500 : 400}}>{label}</span>
    </div>
  );
}

const TREE = [
  { kind:"epic", id:"EPIC-A", title:"Self-serve seat management", pts:24, children: [
    { kind:"story", id:"STORY-1", title:"Admin can invite teammates with role", pts:5, children: [
      { kind:"task", id:"T-1", title:"Invite form with role selector", pts:2 },
      { kind:"task", id:"T-2", title:"POST /invites with role validation", pts:2 },
      { kind:"task", id:"T-3", title:"Email template + tracking pixel", pts:1 },
    ]},
    { kind:"story", id:"STORY-2", title:"Pending invites visible in member list", pts:3, children: [
      { kind:"task", id:"T-4", title:"Status column on members table", pts:1 },
      { kind:"task", id:"T-5", title:"Resend + revoke actions", pts:2 },
    ]},
    { kind:"story", id:"STORY-3", title:"Self-service plan upgrade when seats run out", pts:8, children: [
      { kind:"task", id:"T-6", title:"Detect seat-cap on accept + show upsell", pts:3 },
      { kind:"task", id:"T-7", title:"Stripe-hosted checkout integration", pts:3 },
      { kind:"task", id:"T-8", title:"Webhook → upgrade plan + grant seats", pts:2 },
    ]},
  ]},
  { kind:"epic", id:"EPIC-B", title:"Billing + invoice history", pts:13, children: [
    { kind:"story", id:"STORY-4", title:"Admin can download monthly invoices", pts:5, children:[
      { kind:"task", id:"T-9", title:"Invoice table + PDF download", pts:3 },
      { kind:"task", id:"T-10", title:"Tax info display per region", pts:2 },
    ]},
    { kind:"story", id:"STORY-5", title:"Cancel plan with retention prompt", pts:8 },
  ]},
];

function TreeNode({ node, depth = 0, lastChild = false }) {
  const [open, setOpen] = React.useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const kindStyles = {
    epic:  { icon:"layers",      tone:"purple",  label:"EPIC" },
    story: { icon:"book-open",   tone:"info",    label:"STORY" },
    task:  { icon:"check-square",tone:"neutral", label:"TASK" },
  }[node.kind];
  return (
    <div>
      <div className="hstack" style={{gap:8, padding:"7px 10px", borderRadius:"var(--radius-sm)", marginLeft: depth * 18}}>
        {hasChildren ? (
          <span style={{cursor:"pointer", color:"var(--text-muted)"}} onClick={() => setOpen(o => !o)}>
            <Icon name={open ? "chevron-down" : "chevron-right"} size={12}/>
          </span>
        ) : <span style={{width:12}}/>}
        <Badge tone={kindStyles.tone} icon={kindStyles.icon}>{kindStyles.label}</Badge>
        <span className="mono dim" style={{fontSize:11}}>{node.id}</span>
        <span className="grow" style={{fontSize:13, fontWeight: node.kind === "epic" ? 500 : 400}}>{node.title}</span>
        <span className="mono dim" style={{fontSize:11, padding:"1px 6px", background:"var(--bg-surface-1)", borderRadius:3}}>{node.pts}pt</span>
        <span className="icon-btn" style={{width:22, height:22, color:"var(--text-muted)"}}><Icon name="edit-3" size={11}/></span>
        <span className="icon-btn" style={{width:22, height:22, color:"var(--text-muted)"}}><Icon name="refresh-cw" size={11}/></span>
      </div>
      {open && hasChildren && (
        <div>{node.children.map((c, i) => <TreeNode key={c.id} node={c} depth={depth + 1} lastChild={i === node.children.length - 1}/>)}</div>
      )}
    </div>
  );
}

function ScreenAIWizard() {
  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-04</span>
        <span className="mock-name">AI Generation Wizard</span>
        <span className="mock-desc">Step 3 of 3 — review &amp; confirm</span>
      </div>
      <div className="mock">
        <div style={{
          height: 800, padding: "32px 0", overflow: "auto",
          background: `radial-gradient(800px 400px at 50% 0%, rgba(122,107,255,0.06), transparent 60%),
                       radial-gradient(600px 400px at 50% 100%, rgba(79,209,224,0.04), transparent 60%),
                       var(--bg-app)`,
        }}>
          <div style={{maxWidth: 760, margin: "0 auto", padding: "0 32px"}}>
            {/* Header */}
            <div style={{textAlign:"center", marginBottom:28}}>
              <div className="hstack" style={{justifyContent:"center", gap:8, marginBottom:14}}>
                <AIChip>Plan with AI</AIChip>
              </div>
              <h1 style={{fontSize:28, fontWeight:600, letterSpacing:"-0.02em", margin:"0 0 8px"}}>
                Review your generated plan
              </h1>
              <div className="muted" style={{fontSize:14, maxWidth: 480, margin:"0 auto"}}>
                Edit any title, regenerate a node, or drag to reorder. Nothing is saved until you confirm.
              </div>
            </div>

            {/* Stepper */}
            <div className="hstack" style={{justifyContent:"center", gap:24, marginBottom:24, padding:"12px 20px", background:"var(--bg-surface-1)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-pill)", width:"fit-content", margin:"0 auto 24px"}}>
              <WizardStepDot n={1} label="Describe" state="done"/>
              <span style={{width:24, height:1, background:"var(--border-default)"}}/>
              <WizardStepDot n={2} label="Clarify" state="done"/>
              <span style={{width:24, height:1, background:"var(--border-default)"}}/>
              <WizardStepDot n={3} label="Review &amp; confirm" state="active"/>
            </div>

            {/* Prompt recap */}
            <div className="card" style={{padding:14, marginBottom:14, background:"var(--bg-base)"}}>
              <div className="hstack" style={{gap:6, marginBottom:6}}>
                <Icon name="quote" size={12} color="var(--text-muted)"/>
                <span className="muted" style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600}}>Your prompt</span>
                <span className="grow"/>
                <Button variant="ghost" size="sm" icon="edit-3">Edit</Button>
              </div>
              <div style={{fontSize:14, color:"var(--text-secondary)", lineHeight:1.55}}>
                "We need self-serve onboarding for new orgs — admin can invite teammates, pick a plan, and start using the product without sales touch. Two-week scope, ship to dogfood org first."
              </div>
              <div className="hstack" style={{gap:8, marginTop:10, flexWrap:"wrap"}}>
                <Badge tone="purple" icon="circle-help">Target users: admins only?</Badge>
                <Badge tone="purple" icon="circle-help">Plan tier: existing or new?</Badge>
                <Badge tone="purple" icon="circle-help">Existing auth or fresh?</Badge>
              </div>
            </div>

            {/* Generated plan */}
            <div className="card-ai" style={{padding:0, overflow:"hidden"}}>
              <div style={{padding:"12px 16px", borderBottom:"1px solid var(--border-subtle)", display:"flex", alignItems:"center", gap:10}}>
                <Icon name="sparkles" size={14} color="var(--ai-violet)"/>
                <span style={{fontSize:13, fontWeight:600}}>Generated plan</span>
                <span className="mono dim" style={{fontSize:11}}>· 2 epics · 5 stories · 10 tasks · 37 points</span>
                <span className="grow"/>
                <span className="muted" style={{fontSize:11}}>Powered by Stratos GPT</span>
              </div>
              <div style={{padding:"8px 8px 12px"}}>
                {TREE.map(n => <TreeNode key={n.id} node={n}/>)}
              </div>
              <div className="hstack" style={{padding:"10px 16px", borderTop:"1px solid var(--border-subtle)", background:"var(--bg-surface-1)", gap:8}}>
                <Button variant="ghost" size="md" icon="refresh-cw">Regenerate</Button>
                <Button variant="ghost" size="md" icon="plus">Add epic</Button>
                <span className="grow"/>
                <Button variant="secondary" size="md">Save as draft</Button>
                <Button variant="ai" size="md" icon="check">Confirm &amp; create</Button>
              </div>
            </div>

            {/* Step 1 + 2 reference (compact ghosted preview) */}
            <div className="muted" style={{textAlign:"center", marginTop:24, fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em"}}>Previous steps</div>
            <div className="grid-2" style={{marginTop:8}}>
              <div className="card" style={{opacity:0.62}}>
                <div className="hstack" style={{gap:6, marginBottom:8}}>
                  <Icon name="message-square-text" size={12}/>
                  <span style={{fontSize:12, fontWeight:600}}>Step 1 — Describe</span>
                  <Badge tone="success" icon="check">Done</Badge>
                </div>
                <textarea className="textarea" rows={3} disabled defaultValue="We need self-serve onboarding for new orgs…" style={{fontSize:12}}/>
              </div>
              <div className="card" style={{opacity:0.62}}>
                <div className="hstack" style={{gap:6, marginBottom:8}}>
                  <Icon name="list-checks" size={12}/>
                  <span style={{fontSize:12, fontWeight:600}}>Step 2 — Clarify</span>
                  <Badge tone="success" icon="check">2 of 3 answered</Badge>
                </div>
                <div style={{fontSize:12, color:"var(--text-tertiary)"}}>
                  · Target users → <span style={{color:"var(--text-secondary)"}}>Admins for now</span><br/>
                  · Plan tier → <span style={{color:"var(--text-secondary)"}}>Existing Free + Team</span><br/>
                  · Auth → <span style={{color:"var(--text-muted)"}}>Skipped</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenAIWizard = ScreenAIWizard;
