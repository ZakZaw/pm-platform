// Shared React primitives that wrap CSS classes for cleaner JSX.

const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

// Button
const Button = ({ variant = '', size = '', icon, children, className = '', ...rest }) => {
  const cls = ['btn', variant && `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(' ');
  return <button className={cls} {...rest}>{icon}{children}</button>;
};

// Badge
const Badge = ({ tone = '', children, dot, className = '', ...rest }) => {
  const cls = ['badge', tone && `badge-${tone}`, className].filter(Boolean).join(' ');
  return <span className={cls} {...rest}>{dot && <span className="badge-dot" />}{children}</span>;
};

// Status pill
const Status = ({ status, children, className = '' }) => {
  const map = { 'Backlog': 'todo', 'Todo': 'todo', 'In Progress': 'progress', 'Doing': 'progress',
    'In Review': 'review', 'Done': 'done', 'Resolved': 'done', 'Closed Won': 'done',
    'Blocked': 'blocked', 'Open': 'progress', 'Pending': 'review', 'On Hold': 'todo',
    'New': 'progress', 'Draft': 'todo', 'Scheduled': 'review', 'Published': 'done',
    'Drafting': 'progress', 'Idea': 'todo' };
  const k = map[status] || 'todo';
  return <span className={`status status-${k} ${className}`}>{children || status}</span>;
};

// Priority
const Priority = ({ level, label }) => {
  const labels = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
  return (
    <span className={`priority priority-${level}`}>
      <span className="priority-flag" />
      {label !== false && <span>{labels[level]}</span>}
    </span>
  );
};

// Avatar
const Avatar = ({ user, size = '', className = '' }) => {
  if (!user) return null;
  const cls = ['avatar', size && `avatar-${size}`, `avatar-c${user.color}`, className].filter(Boolean).join(' ');
  return <span className={cls} title={user.name}>{user.initials}</span>;
};
const AvatarStack = ({ users, max = 4, size = '' }) => {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map(u => <Avatar key={u.id} user={u} size={size} />)}
      {extra > 0 && <span className={`avatar avatar-more ${size && `avatar-${size}`}`}>+{extra}</span>}
    </span>
  );
};

// Chip
const Chip = ({ children, onRemove }) => (
  <span className={`chip ${onRemove ? 'chip-removable' : ''}`}>
    {children}
    {onRemove && <button className="chip-remove" onClick={onRemove}><I.X size={10} /></button>}
  </span>
);

// AI chip
const AIChip = ({ children, icon = true }) => (
  <span className="ai-chip">
    {icon && <span className="ai-chip-icon"><I.Sparkle size={9} stroke={2.5} /></span>}
    {children}
  </span>
);

// Tooltip wrapper
const Tip = ({ text, children }) => (
  <span className="tip" data-tip={text}>{children}</span>
);

// Sparkline (downward / upward trend)
const Sparkline = ({ data, color = 'var(--accent)', width = 80, height = 22, fill = true }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * (height - 2) - 1;
    return [x, y];
  });
  const line = pts.map(([x, y], i) => (i ? `L${x},${y}` : `M${x},${y}`)).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {fill && <path d={area} fill={color} opacity="0.14" />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Progress bar
const Bar = ({ value, max = 100, variant = '' }) => (
  <div className="bar"><div className={`bar-fill bar-fill-${variant}`} style={{ width: `${(value / max) * 100}%` }} /></div>
);

// Switch
const Switch = ({ on, onChange }) => (
  <button className={`switch ${on ? 'is-on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
);

// Health ring (donut)
const HealthRing = ({ value, size = 36 }) => {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
              strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.6s' }} />
    </svg>
  );
};

// Tabs
const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs">
    {tabs.map(t => (
      <button key={t.id} className={value === t.id ? 'is-active' : ''} onClick={() => onChange(t.id)}>
        {t.label}{t.count != null && <span className="tab-count">{t.count}</span>}
      </button>
    ))}
  </div>
);

// Segmented
const Segmented = ({ options, value, onChange }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

// Empty state
const EmptyState = ({ icon = <I.Folder />, title, desc, action }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <div className="empty-title">{title}</div>
    {desc && <div className="empty-desc">{desc}</div>}
    {action}
  </div>
);

// Drawer scrim + drawer
const Drawer = ({ open, onClose, children, width }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="modal-scrim" onClick={onClose} style={{ zIndex: 800, background: 'hsl(220 25% 12% / 0.25)' }} />
      <aside className="drawer" style={width ? { width } : null}>{children}</aside>
    </>
  );
};

// Modal
const Modal = ({ open, onClose, children, width }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={width ? { maxWidth: width } : null} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
};

Object.assign(window, {
  Button, Badge, Status, Priority,
  Avatar, AvatarStack, Chip, AIChip, Tip,
  Sparkline, Bar, Switch, HealthRing, Tabs, Segmented,
  EmptyState, Drawer, Modal,
});
