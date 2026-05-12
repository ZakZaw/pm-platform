import './Avatar.css';

function initialsFor(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ src, name, alt, size = 'md', className = '' }) {
  const classes = ['avatar', `avatar--${size}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-label={alt ?? name ?? undefined}>
      {src ? (
        <img className="avatar__image" src={src} alt={alt ?? name ?? ''} />
      ) : (
        <span aria-hidden="true">{initialsFor(name)}</span>
      )}
    </span>
  );
}
