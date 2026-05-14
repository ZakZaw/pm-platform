/* shared.jsx — Common React utilities and Icon component */

// Icon: thin wrapper over Lucide. Renders <svg> via lucide.createIcons fallback.
function Icon({ name, size = 14, strokeWidth = 1.75, color, style, className }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !window.lucide) return;
    const icons = window.lucide.icons || window.lucide;
    const pascal = name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
    const data = icons[pascal] || icons[name];
    if (!data) { ref.current.innerHTML = ""; return; }
    // lucide UMD shape: each icon is [tag, attrs, children]
    const [tag, attrs, children] = data;
    const svgAttrs = {
      ...attrs,
      width: size, height: size,
      "stroke-width": strokeWidth,
    };
    const attrStr = Object.entries(svgAttrs).map(([k, v]) => `${k}="${v}"`).join(" ");
    const childStr = (children || []).map(([ctag, cattrs]) => {
      const cstr = Object.entries(cattrs).map(([k, v]) => `${k}="${v}"`).join(" ");
      return `<${ctag} ${cstr} />`;
    }).join("");
    ref.current.innerHTML = `<svg ${attrStr}>${childStr}</svg>`;
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={className} style={{display:"inline-flex",alignItems:"center",color:color,...style}} />;
}

// Avatar
function Avatar({ name, color = 1, size = "sm", status, src }) {
  const initials = (name || "")
    .split(/\s+/)
    .map(s => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={`avatar avatar-${size} av-${color}`}>
      {initials || "?"}
      {status && <span className={`status-dot ${status}`} />}
    </span>
  );
}

function AvatarStack({ people, max = 4, size = "sm" }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((p, i) => <Avatar key={i} {...p} size={size} />)}
      {extra > 0 && <span className={`avatar avatar-${size} more`}>+{extra}</span>}
    </span>
  );
}

// Badge
function Badge({ tone = "neutral", dot, children, icon }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="dot" style={{background:"currentColor"}} />}
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}

// Priority bars
function Priority({ level = "med" }) {
  return (
    <span className={`prio prio-${level}`} title={`Priority: ${level}`}>
      <span /><span /><span />
    </span>
  );
}

// Buttons
function Button({ variant = "secondary", size = "md", state, icon, iconRight, children, kbd, ...rest }) {
  const cls = [
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    state === "active" && "is-active",
    state === "disabled" && "is-disabled",
  ].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={state === "disabled"} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 12 : 13} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 12 : 13} />}
      {kbd && <span className="kbd" style={{marginLeft:4}}>{kbd}</span>}
    </button>
  );
}

// AI chip
function AIChip({ children = "AI" }) {
  return (
    <span className="ai-chip">
      <span className="spark-dot">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2.09 5.26L20 10l-5.91 1.74L12 17l-2.09-5.26L4 10l5.91-1.74z"/>
        </svg>
      </span>
      {children}
    </span>
  );
}

// Status mapping
const STATUS = {
  backlog:     { tone: "neutral",  label: "Backlog",     icon: "circle-dashed" },
  todo:        { tone: "neutral",  label: "To Do",       icon: "circle" },
  in_progress: { tone: "info",     label: "In Progress", icon: "circle-dot" },
  in_review:   { tone: "purple",   label: "In Review",   icon: "git-pull-request" },
  blocked:     { tone: "danger",   label: "Blocked",     icon: "octagon-x" },
  done:        { tone: "success",  label: "Done",        icon: "circle-check" },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.todo;
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
}

// Fake data: people
const PEOPLE = [
  { name: "Priya Patel", color: 1, status: "online" },
  { name: "Marcus Chen", color: 2, status: "online" },
  { name: "Sasha Volkov", color: 3, status: "busy" },
  { name: "Diego Ramos", color: 4, status: "online" },
  { name: "Hana Sato", color: 5, status: "away" },
  { name: "Tom Whitley", color: 6, status: "offline" },
  { name: "Aria Khan", color: 7, status: "online" },
  { name: "Jordan Lee", color: 8, status: "online" },
];

Object.assign(window, {
  Icon, Avatar, AvatarStack, Badge, Priority, Button, AIChip, StatusBadge, STATUS, PEOPLE,
});
