import { Avatar } from '../Avatar/Avatar';

export function AvatarStack({ people = [], max = 5, size = 'xs', className = '' }) {
  const shown = people.slice(0, max);
  const extra = Math.max(0, people.length - shown.length);
  const classes = ['avatar-stack', className].filter(Boolean).join(' ');
  const dim = size === 'xs' ? 18 : size === 'sm' ? 22 : 28;
  return (
    <span className={classes}>
      {shown.map((p, i) => (
        <Avatar
          key={p.id ?? p.userId ?? p.name ?? i}
          name={p.name ?? p.fullName}
          src={p.avatarUrl}
          color={p.color}
          size={size}
        />
      ))}
      {extra > 0 && (
        <span
          className={`avatar avatar-${size} avatar-stack__more`}
          style={{ width: dim, height: dim }}
          aria-label={`${extra} more`}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
