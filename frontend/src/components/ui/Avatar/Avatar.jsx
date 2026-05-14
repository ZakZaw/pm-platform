import './Avatar.css';

function initialsFor(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministically map a name to one of 8 gradient slots (Stratos palette).
function colorIndexFor(name) {
  if (!name) return 1;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return (hash % 8) + 1;
}

export function Avatar({ src, name, alt, size = 'md', color, status, className = '' }) {
  const palette = color ?? colorIndexFor(name);
  const classes = ['avatar', `avatar-${size}`, src ? '' : `av-${palette}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} aria-label={alt ?? name ?? undefined}>
      {src ? (
        <img className="avatar__image" src={src} alt={alt ?? name ?? ''} />
      ) : (
        <span aria-hidden="true">{initialsFor(name)}</span>
      )}
      {status && <span className={`status-dot ${status}`} aria-hidden="true" />}
    </span>
  );
}
