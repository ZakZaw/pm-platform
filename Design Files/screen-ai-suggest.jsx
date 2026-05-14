/* screen-ai-suggest.jsx — AI Suggestion Card showcase */

function SuggestCard({ variant = "default" }) {
  return (
    <div className="card-ai" style={{padding:16, maxWidth: 520}}>
      <div className="hstack" style={{gap:8, marginBottom:8}}>
        <AIChip>Stratos insight</AIChip>
        <span className="muted" style={{fontSize:11}}>· Atlas — Public API</span>
        <span className="grow"/>
        <span style={{color:"var(--text-muted)", cursor:"pointer"}}><Icon name="x" size={13}/></span>
      </div>
      <div style={{fontSize:15, fontWeight:600, letterSpacing:"-0.005em", lineHeight:1.35, marginBottom:6}}>
        Velocity is 30% below 6-sprint average
      </div>
      <div className="muted" style={{fontSize:13, lineHeight:1.55, marginBottom:12}}>
        Atlas 24 has burned 14 of 41 committed points with 4 days left. Two blockers are accruing time on the same epic. Consider one of these replan options:
      </div>
      <div className="vstack" style={{gap:6, marginBottom:14}}>
        {[
          { label:"Move 12pt of Auth-hardening to Atlas 25", recommended:true },
          { label:"Drop ATLAS-330 (rate-limit spec) — non-committed", recommended:false },
          { label:"Pair Marcus + Priya on ATLAS-302 to unblock", recommended:false },
        ].map((o, i) => (
          <div key={i} className="hstack" style={{gap:8, padding:"8px 10px", border:`1px solid ${o.recommended ? "rgba(122,107,255,0.32)" : "var(--border-subtle)"}`, borderRadius:"var(--radius-md)", background: o.recommended ? "rgba(122,107,255,0.06)" : "var(--bg-base)"}}>
            <div style={{width:18, height:18, borderRadius:"50%", border:"1.5px solid var(--border-strong)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background: i === 0 ? "var(--accent-primary)" : "transparent", borderColor: i === 0 ? "var(--accent-primary)" : "var(--border-strong)"}}>
              {i === 0 && <span style={{width:7, height:7, borderRadius:"50%", background:"white"}}/>}
            </div>
            <span style={{fontSize:13}}>{o.label}</span>
            {o.recommended && <span className="ai-chip" style={{marginLeft:"auto", fontSize:9}}>Recommended</span>}
          </div>
        ))}
      </div>
      {variant === "auto" ? (
        <div className="hstack" style={{gap:10, padding:"8px 10px", background:"var(--status-success-bg)", border:"1px solid var(--status-success-border)", borderRadius:"var(--radius-md)"}}>
          <Icon name="check-circle" size={14} color="var(--status-success)"/>
          <div className="grow">
            <div style={{fontSize:12, fontWeight:500, color:"var(--status-success)"}}>Auto-applied — undo within 24h</div>
            <div className="muted" style={{fontSize:11}}>Moved 12pt to Atlas 25 · 3h 12m ago · 20h 48m remaining</div>
          </div>
          <Button variant="ghost" size="sm" icon="rotate-ccw">Undo</Button>
        </div>
      ) : (
        <div className="hstack" style={{gap:6, justifyContent:"space-between", alignItems:"center"}}>
          <span className="muted" style={{fontSize:11}}>
            <Icon name="info" size={11} style={{verticalAlign:"-2px", marginRight:4}}/>
            Based on 6 sprints · 80% confidence
          </span>
          <div className="hstack" style={{gap:6}}>
            <Button variant="ghost" size="sm">Dismiss</Button>
            <Button variant="secondary" size="sm" icon="edit-3">Edit</Button>
            <Button variant="ai" size="sm" icon="check">Apply</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenAISuggest() {
  return (
    <div>
      <div className="mock-label">
        <span className="mock-id">SCR-05</span>
        <span className="mock-name">AI Suggestion Card</span>
        <span className="mock-desc">Standalone — appears inline in board, dashboard, inbox</span>
      </div>
      <div className="mock" style={{padding:32, background:`radial-gradient(600px 300px at 30% 0%, rgba(122,107,255,0.06), transparent 60%), var(--bg-base)`}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:32}}>
          <div>
            <div className="muted" style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12, fontWeight:600}}>Default state</div>
            <SuggestCard/>
          </div>
          <div>
            <div className="muted" style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12, fontWeight:600}}>Auto-applied (undo window)</div>
            <SuggestCard variant="auto"/>
          </div>
        </div>

        <div style={{marginTop:36}}>
          <div className="muted" style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12, fontWeight:600}}>Compact inline variants</div>
          <div className="vstack" style={{gap:10}}>
            <div className="card-ai" style={{padding:"10px 12px"}}>
              <div className="hstack" style={{gap:10}}>
                <AIChip>AI</AIChip>
                <span style={{fontSize:13}}>This sprint will miss commitment by ~12pt. <a style={{color:"var(--accent-primary)"}}>See options</a></span>
                <span className="grow"/>
                <Button variant="ghost" size="sm">Dismiss</Button>
              </div>
            </div>
            <div className="card-ai" style={{padding:"10px 12px"}}>
              <div className="hstack" style={{gap:10}}>
                <AIChip>Draft</AIChip>
                <span style={{fontSize:13}}>I drafted 4 action items from the standup. <a style={{color:"var(--accent-primary)"}}>Review &amp; add</a></span>
                <span className="grow"/>
                <Button variant="ghost" size="sm">Dismiss</Button>
              </div>
            </div>
            <div className="card-ai" style={{padding:"10px 12px"}}>
              <div className="hstack" style={{gap:10}}>
                <AIChip>Heads up</AIChip>
                <span style={{fontSize:13}}>ATLAS-302 has been blocked for 5 days — auto-escalate to Sasha?</span>
                <span className="grow"/>
                <Button variant="ghost" size="sm">Not now</Button>
                <Button variant="secondary" size="sm">Escalate</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenAISuggest = ScreenAISuggest;
window.SuggestCard = SuggestCard;
