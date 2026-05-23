// Icons — minimal feather-style line icons. 16x16 default viewBox.
// Stroked, currentColor.

const Icon = ({ d, size = 16, fill, stroke = 2, children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"}
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
       style={{ flexShrink: 0, ...style }}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  Home:     (p) => <Icon {...p}><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/></Icon>,
  Inbox:    (p) => <Icon {...p}><path d="M3 13h5l1 3h6l1-3h5"/><path d="M5 21h14a2 2 0 002-2v-5l-3-9H6L3 14v5a2 2 0 002 2z"/></Icon>,
  Calendar: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4M16 3v4"/></Icon>,
  Map:      (p) => <Icon {...p}><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><path d="M9 3v15M15 6v15"/></Icon>,
  Chart:    (p) => <Icon {...p}><path d="M3 21h18"/><path d="M6 17v-5M11 17V8M16 17v-7M21 17V5"/></Icon>,
  Folder:   (p) => <Icon {...p}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></Icon>,
  Users:    (p) => <Icon {...p}><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="10" r="2.5"/><path d="M14.5 19.5c0-2 2-3.5 4-3.5s2.5 1 2.5 3"/></Icon>,
  Cog:      (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9 1.7 1.7 0 004.3 7.2L4.2 7a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1A2 2 0 0119.8 7l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></Icon>,
  Search:   (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></Icon>,
  Bell:     (p) => <Icon {...p}><path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 004 0"/></Icon>,
  Plus:     (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Check:    (p) => <Icon {...p}><path d="M5 12l5 5L20 7"/></Icon>,
  X:        (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>,
  Chevron:  (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>,
  ChevronDown: (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>,
  Arrow:    (p) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Icon>,
  Filter:   (p) => <Icon {...p}><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></Icon>,
  Sort:     (p) => <Icon {...p}><path d="M7 4v16M3 8l4-4 4 4"/><path d="M17 20V4M13 16l4 4 4-4"/></Icon>,
  More:     (p) => <Icon {...p}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></Icon>,
  Sparkle:  (p) => <Icon {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/></Icon>,
  Bolt:     (p) => <Icon {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></Icon>,
  Flag:     (p) => <Icon {...p}><path d="M4 21V4"/><path d="M4 4h13l-2 4 2 4H4"/></Icon>,
  Code:     (p) => <Icon {...p}><path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/></Icon>,
  Box:      (p) => <Icon {...p}><path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/></Icon>,
  Sales:    (p) => <Icon {...p}><path d="M3 12l4-8 5 5 4-2 5 7"/><path d="M3 20h18"/></Icon>,
  Support:  (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="M8 15c1.2 1 2.5 1.5 4 1.5s2.8-.5 4-1.5"/></Icon>,
  Marketing:(p) => <Icon {...p}><path d="M3 11v3a1 1 0 001 1h2l3 5v-15l-3 5H4a1 1 0 00-1 1z"/><path d="M14 8a4 4 0 010 7"/><path d="M18 5a8 8 0 010 13"/></Icon>,
  Ops:      (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></Icon>,
  Generic:  (p) => <Icon {...p}><path d="M4 6h16M4 12h16M4 18h10"/></Icon>,
  Clock:    (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
  Comment:  (p) => <Icon {...p}><path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"/></Icon>,
  Attach:   (p) => <Icon {...p}><path d="M21.4 11l-9.2 9.2a6 6 0 01-8.5-8.5L13 2.3a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 11-2.8-2.8l8.5-8.5"/></Icon>,
  Link:     (p) => <Icon {...p}><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5"/></Icon>,
  Sun:      (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></Icon>,
  Moon:     (p) => <Icon {...p}><path d="M21 13a9 9 0 11-10-10 7 7 0 0010 10z"/></Icon>,
  Wand:     (p) => <Icon {...p}><path d="M15 4l-2 2M19 8l-2 2M21 12h-2M5 21l9-9"/><path d="M15 4l5 5"/></Icon>,
  Play:     (p) => <Icon {...p}><path d="M7 4l13 8-13 8V4z"/></Icon>,
  Pause:    (p) => <Icon {...p}><rect x="7" y="5" width="3" height="14" rx="1"/><rect x="14" y="5" width="3" height="14" rx="1"/></Icon>,
  Mic:      (p) => <Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></Icon>,
  Video:    (p) => <Icon {...p}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M21 8l-4 4 4 4V8z"/></Icon>,
  Hash:     (p) => <Icon {...p}><path d="M4 9h16M4 15h16M10 3l-2 18M16 3l-2 18"/></Icon>,
  Trend:    (p) => <Icon {...p}><path d="M3 17l6-6 4 4 8-9"/><path d="M14 6h7v7"/></Icon>,
  TrendDown:(p) => <Icon {...p}><path d="M3 7l6 6 4-4 8 9"/><path d="M14 18h7v-7"/></Icon>,
  Bug:      (p) => <Icon {...p}><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M9 9l-3-3M15 9l3-3M8 13H3M16 13h5M9 17l-3 3M15 17l3 3"/></Icon>,
  Mail:     (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></Icon>,
  Phone:    (p) => <Icon {...p}><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.4 2.1L8.1 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.2-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z"/></Icon>,
  Send:     (p) => <Icon {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></Icon>,
  Lock:     (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></Icon>,
  Trash:    (p) => <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></Icon>,
  Edit:     (p) => <Icon {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></Icon>,
  Eye:      (p) => <Icon {...p}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></Icon>,
  Pin:      (p) => <Icon {...p}><path d="M12 17v5M5 8h14l-2 9H7L5 8zM7 4h10"/></Icon>,
  Star:     (p) => <Icon {...p}><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7l3-7z"/></Icon>,
  Layers:   (p) => <Icon {...p}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></Icon>,
  Refresh:  (p) => <Icon {...p}><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"/></Icon>,
  ArrowUp:  (p) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7"/></Icon>,
  ArrowDown:(p) => <Icon {...p}><path d="M12 5v14M5 12l7 7 7-7"/></Icon>,
  Dot:      (p) => <Icon {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></Icon>,
  Slack:    (p) => <Icon {...p}><rect x="3" y="9" width="6" height="3" rx="1.5"/><rect x="9" y="3" width="3" height="6" rx="1.5"/><rect x="15" y="12" width="6" height="3" rx="1.5"/><rect x="12" y="15" width="3" height="6" rx="1.5"/></Icon>,
  Branch:   (p) => <Icon {...p}><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M18 10c0 6-6 4-6 8"/></Icon>,
};

window.I = I;
