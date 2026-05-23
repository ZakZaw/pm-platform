import './Avatar.css';

function initialsFor(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministically map a name to one of 8 palette slots (avatar-c0 .. avatar-c7).
function colorIndexFor(name) {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 8;
}

export function Avatar({ src, name, alt, size = 'md', color, status, className = '' }) {
  // Accept both 0-indexed (new) and 1-indexed (legacy) color values.
  const palette = color != null
    ? (color >= 1 && color <= 8 ? color - 1 : color)
    : colorIndexFor(name);
  const classes = [
    'avatar',
    `avatar-${size}`,
    src ? '' : `avatar-c${palette}`,
    className,
  ].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-label={alt ?? name ?? undefined}>
      {src ? (
        <img className="avatar__image" src={src} alt={alt ?? name ?? ''} />
      ) : (
        <span aria-hidden="true">{initialsFor(name)}</span>
      )}
      {status && <span className={`avatar-status-dot avatar-status-${status}`} aria-hidden="true" />}
    </span>
  );
}
