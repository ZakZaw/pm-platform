/* section-tokens.jsx — Design Tokens reference */

function Swatch({ name, value, tokenName, big }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => { navigator.clipboard?.writeText(`var(${tokenName})`); setCopied(true); setTimeout(()=>setCopied(false), 900); };
  return (
    <div className="card" style={{padding:0, overflow:"hidden", cursor:"pointer"}} onClick={copy}>
      <div style={{height: big ? 80 : 56, background: value, borderBottom:"1px solid var(--border-subtle)"}}/>
      <div style={{padding:"10px 12px"}}>
        <div style={{fontSize:13, fontWeight:500}}>{name}</div>
        <div className="mono" style={{fontSize:11, color:"var(--text-tertiary)", display:"flex", justifyContent:"space-between", marginTop:2}}>
          <span>{tokenName}</span>
          <span style={{color: copied ? "var(--status-success)" : "var(--text-muted)"}}>{copied ? "copied" : "click"}</span>
        </div>
      </div>
    </div>
  );
}

const SCALES = [
  { name: "Blue",   key: "blue",   primaryStep: 500, note: "Info, links, data viz" },
  { name: "Indigo", key: "indigo", primaryStep: 500, note: "Brand accent — Primary buttons, selection" },
  { name: "Sky",    key: "sky",    primaryStep: 300, note: "AI accent, secondary highlights" },
  { name: "Slate",  key: "slate",  primaryStep: 500, note: "Neutral cool grays — surfaces + text" },
];
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const COLOR_GROUPS = [
  { title: "Surface", items: [
    ["App background", "--bg-app"],
    ["Surface 1", "--bg-surface-1"],
    ["Surface 2", "--bg-surface-2"],
    ["Surface 3", "--bg-surface-3"],
    ["Hover", "--bg-hover"],
    ["Selected", "--bg-selected"],
  ]},
  { title: "Border", items: [
    ["Subtle", "--border-subtle"],
    ["Default", "--border-default"],
    ["Strong", "--border-strong"],
    ["Focus", "--border-focus"],
  ]},
  { title: "Text", items: [
    ["Primary", "--text-primary"],
    ["Secondary", "--text-secondary"],
    ["Tertiary", "--text-tertiary"],
    ["Muted", "--text-muted"],
    ["Disabled", "--text-disabled"],
  ]},
  { title: "Accent", items: [
    ["Primary", "--accent-primary"],
    ["Hover", "--accent-primary-hover"],
    ["Active", "--accent-primary-active"],
    ["Muted", "--accent-primary-muted"],
    ["Soft", "--accent-primary-soft"],
  ]},
  { title: "AI gradient", items: [
    ["AI violet", "--ai-violet"],
    ["AI cyan", "--ai-cyan"],
    ["AI pink", "--ai-pink"],
  ]},
  { title: "Status", items: [
    ["Success", "--status-success"],
    ["Warning", "--status-warning"],
    ["Danger", "--status-danger"],
    ["Info", "--status-info"],
    ["Purple", "--status-purple"],
    ["Neutral", "--status-neutral"],
  ]},
  { title: "Priority", items: [
    ["Urgent", "--prio-urgent"],
    ["High", "--prio-high"],
    ["Med", "--prio-med"],
    ["Low", "--prio-low"],
  ]},
];

const TYPE_SAMPLES = [
  { name: "Display / 30",       token: "--font-size-display", sample: "Ship the API rewrite this quarter" },
  { name: "Heading 1 / 24",     token: "--font-size-h1",      sample: "Active sprint — Atlas 24" },
  { name: "Heading 2 / 20",     token: "--font-size-h2",      sample: "In progress (8)" },
  { name: "Heading 3 / 17",     token: "--font-size-h3",      sample: "Fix race condition in invite token expiry" },
  { name: "Heading 4 / 15",     token: "--font-size-h4",      sample: "Acceptance criteria" },
  { name: "Body / 14",          token: "--font-size-body",    sample: "When a user enters an existing email, surface 'Already invited' with the option to resend." },
  { name: "Dense / 13",         token: "--font-size-dense",   sample: "Used in dense tables and lists where vertical density matters." },
  { name: "Meta / 11",          token: "--font-size-meta",    sample: "Updated 4m ago · PROJ-247 · Reported by Priya Patel" },
];

const SPACING = [
  ["1","4"],["2","8"],["3","12"],["4","16"],["5","20"],["6","24"],["8","32"],["10","40"],["12","48"],["16","64"],
];

const RADII = [
  ["XS","3"],["SM","4"],["MD","6"],["LG","10"],["XL","14"],["2XL","20"],["Pill","999"],
];

const SHADOWS = [
  ["xs", "--shadow-xs"],
  ["sm", "--shadow-sm"],
  ["md", "--shadow-md"],
  ["lg", "--shadow-lg"],
  ["xl", "--shadow-xl"],
];

function SectionTokens() {
  return (
    <div>
      <div className="section-heading">
        <span className="heading-num">1.1</span> Color
      </div>
      <div className="section-sub">Click any swatch to copy <span className="mono">var(--name)</span>. Both themes share token names; values switch via <span className="mono">[data-theme]</span>.</div>

      {/* Numeric scales */}
      <div className="subsection" style={{marginTop:0}}>Scales</div>
      <div className="vstack" style={{gap:14}}>
        {SCALES.map(s => (
          <div key={s.key} className="card" style={{padding:14}}>
            <div className="hstack" style={{justifyContent:"space-between", marginBottom:10}}>
              <div className="hstack" style={{gap:8}}>
                <span style={{width:14, height:14, borderRadius:4, background:`var(--${s.key}-${s.primaryStep})`, boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.06)"}}/>
                <span style={{fontSize:14, fontWeight:600}}>{s.name}</span>
                <span className="muted" style={{fontSize:12}}>· {s.note}</span>
              </div>
              <span className="mono dim" style={{fontSize:11}}>--{s.key}-50 → --{s.key}-900</span>
            </div>
            <div style={{display:"grid", gridTemplateColumns:`repeat(${SCALE_STEPS.length}, 1fr)`, gap:6}}>
              {SCALE_STEPS.map(step => {
                const token = `--${s.key}-${step}`;
                const isPrimary = step === s.primaryStep;
                return (
                  <div
                    key={step}
                    onClick={() => navigator.clipboard?.writeText(`var(${token})`)}
                    style={{cursor:"pointer"}}
                    title={`Click to copy var(${token})`}
                  >
                    <div style={{
                      height: 56,
                      background: `var(${token})`,
                      borderRadius: "var(--radius-sm)",
                      border: isPrimary ? "2px solid var(--text-primary)" : "1px solid var(--border-subtle)",
                      position:"relative",
                    }}>
                      {isPrimary && (
                        <span style={{
                          position:"absolute", top:-1, right:-1,
                          padding:"1px 4px", fontSize:9, fontFamily:"var(--font-mono)",
                          background:"var(--text-primary)", color:"var(--bg-base)",
                          borderRadius:"0 var(--radius-sm) 0 var(--radius-sm)",
                          fontWeight:600, letterSpacing:"0.04em",
                        }}>BASE</span>
                      )}
                    </div>
                    <div className="mono" style={{fontSize:10, marginTop:4, color: step <= 200 ? "var(--text-tertiary)" : "var(--text-secondary)", textAlign:"center", fontWeight: isPrimary ? 600 : 400}}>
                      {step}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Semantic tokens */}
      <div className="subsection">Semantic tokens</div>
      <div className="muted" style={{fontSize:12, marginTop:-8, marginBottom:14}}>Reference these in product code. They map onto scale steps and switch with theme.</div>
      {COLOR_GROUPS.map(g => (
        <div key={g.title} style={{marginBottom: 24}}>
          <div className="subsection" style={{marginTop:0, fontSize:13, color:"var(--text-tertiary)"}}>{g.title}</div>
          <div className="grid-4">
            {g.items.map(([name, token]) => (
              <Swatch key={token} name={name} tokenName={token} value={`var(${token})`} />
            ))}
          </div>
        </div>
      ))}

      <div className="section-heading"><span className="heading-num">1.2</span> Typography</div>
      <div className="section-sub">Geist for UI · Geist Mono for IDs and code. Fallbacks: Inter / JetBrains Mono.</div>

      <div className="card" style={{padding:0}}>
        {TYPE_SAMPLES.map((t, i) => (
          <div key={t.token} style={{display:"grid", gridTemplateColumns:"180px 1fr", gap:24, padding:"16px 20px", borderTop: i === 0 ? 0 : "1px solid var(--border-subtle)", alignItems:"baseline"}}>
            <div>
              <div style={{fontSize:13, fontWeight:500}}>{t.name}</div>
              <div className="mono" style={{fontSize:11, color:"var(--text-muted)"}}>{t.token}</div>
            </div>
            <div style={{fontSize:`var(${t.token})`, lineHeight:1.25, letterSpacing: t.token.includes("display") || t.token.includes("h1") ? "-0.02em" : "-0.005em"}}>
              {t.sample}
            </div>
          </div>
        ))}
      </div>

      <div className="section-heading"><span className="heading-num">1.3</span> Spacing</div>
      <div className="section-sub">Geometric progression — 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.</div>
      <div className="card">
        <div className="vstack" style={{gap:10}}>
          {SPACING.map(([n, v]) => (
            <div key={n} style={{display:"grid", gridTemplateColumns:"60px 80px 1fr", alignItems:"center", gap:12}}>
              <div className="mono" style={{fontSize:12, color:"var(--text-tertiary)"}}>--space-{n}</div>
              <div className="mono" style={{fontSize:12}}>{v}px</div>
              <div style={{height:10, width: `${v}px`, background:"var(--accent-primary)", borderRadius: 2}}/>
            </div>
          ))}
        </div>
      </div>

      <div className="section-heading"><span className="heading-num">1.4</span> Radius</div>
      <div className="card">
        <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:16}}>
          {RADII.map(([name, v]) => (
            <div key={name} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:8}}>
              <div style={{width:60, height:60, background:"var(--bg-surface-2)", border:"1px solid var(--border-default)", borderRadius: v === "999" ? 999 : `${v}px`}}/>
              <div style={{fontSize:12}}>{name}</div>
              <div className="mono" style={{fontSize:11, color:"var(--text-muted)"}}>{v === "999" ? "pill" : v + "px"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-heading"><span className="heading-num">1.5</span> Elevation</div>
      <div className="section-sub">Soft and layered — used sparingly, mostly for overlays.</div>
      <div className="grid-4">
        {SHADOWS.map(([name, token]) => (
          <div key={name} style={{padding:24, background:"var(--bg-base)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)"}}>
            <div style={{height:72, background:"var(--bg-surface-2)", borderRadius:"var(--radius-md)", boxShadow:`var(${token})`}}/>
            <div style={{display:"flex", justifyContent:"space-between", marginTop:12, fontSize:12}}>
              <span style={{fontWeight:500}}>{name}</span>
              <span className="mono" style={{color:"var(--text-muted)", fontSize:11}}>{token}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.SectionTokens = SectionTokens;
