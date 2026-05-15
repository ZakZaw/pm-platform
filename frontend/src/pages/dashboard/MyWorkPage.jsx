import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, StatusBadge } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { myWorkApi } from '@/api/myWork.api';
import './MyWorkPage.css';

const PRIORITY_TONE = {
  Urgent: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
};

function startOfDayLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketize(items) {
  const now = new Date();
  const todayStart = startOfDayLocal(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 8);

  const overdue = [];
  const today = [];
  const week = [];

  for (const item of items) {
    if (!item.dueDate) continue;
    const d = new Date(item.dueDate);
    if (d < todayStart) overdue.push(item);
    else if (d < tomorrowStart) today.push(item);
    else if (d < weekEnd) week.push(item);
  }

  return { overdue, today, week };
}

function groupByProject(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.projectId;
    if (!map.has(key)) {
      map.set(key, {
        projectId: item.projectId,
        projectName: item.projectName,
        projectSlug: item.projectSlug,
        orgSlug: item.orgSlug,
        items: [],
      });
    }
    map.get(key).items.push(item);
  }
  return [...map.values()];
}

function formatDue(dueIso, { isOverdue }) {
  const d = new Date(dueIso);
  const today = startOfDayLocal(new Date());
  const dayOnly = startOfDayLocal(d);
  const diffDays = Math.round((dayOnly - today) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (isOverdue) {
    const days = Math.abs(diffDays);
    return `${days} day${days === 1 ? '' : 's'} overdue`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ItemRow({ item, isOverdue }) {
  return (
    <Link
      to={`/${item.orgSlug}/projects/${item.projectSlug}/stories/${item.storyId}`}
      className={['mywork__item', isOverdue ? 'is-overdue' : ''].filter(Boolean).join(' ')}
    >
      <Badge tone={PRIORITY_TONE[item.priority] ?? 'neutral'}>{item.priority}</Badge>
      <div className="mywork__item-title">
        <span className="mywork__item-name">{item.title}</span>
        <span className="mywork__item-story">in {item.storyTitle}</span>
      </div>
      <StatusBadge status={item.status} />
      <span className={['mywork__due', isOverdue ? 'is-overdue' : ''].filter(Boolean).join(' ')}>
        {formatDue(item.dueDate, { isOverdue })}
      </span>
    </Link>
  );
}

function Section({ title, items, emptyText, danger = false }) {
  const groups = useMemo(() => groupByProject(items), [items]);

  return (
    <section className="mywork__section">
      <header className="mywork__section-head">
        <h2 className={['mywork__section-title', danger ? 'is-danger' : ''].filter(Boolean).join(' ')}>
          {title}
        </h2>
        <span className="mywork__section-count">{items.length}</span>
      </header>
      {groups.length === 0 ? (
        <p className="mywork__empty">{emptyText}</p>
      ) : (
        groups.map((g) => (
          <div className="mywork__project-group" key={g.projectId}>
            <div className="mywork__project-head">
              <Link
                to={`/${g.orgSlug}/projects/${g.projectSlug}`}
                className="mywork__project-link"
              >
                {g.projectName}
              </Link>
            </div>
            <div className="mywork__items">
              {g.items.map((item) => (
                <ItemRow key={item.id} item={item} isOverdue={danger} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export function MyWorkPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await myWorkApi.list();
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load your tasks.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { overdue, today, week } = useMemo(() => bucketize(items), [items]);

  return (
    <div className="mywork">
      <h1 className="mywork__title">Welcome, {user?.fullName}</h1>
      <p className="mywork__subtitle">Your open tasks across every project you belong to.</p>

      {loading && <p className="mywork__placeholder">Loading…</p>}
      {error && <p className="mywork__placeholder">{error}</p>}

      {!loading && !error && (
        <div className="mywork__sections">
          <Section
            title="Overdue"
            items={overdue}
            emptyText="Nothing overdue — nice."
            danger
          />
          <Section
            title="Due today"
            items={today}
            emptyText="Nothing due today."
          />
          <Section
            title="This week"
            items={week}
            emptyText="Nothing due in the next seven days."
          />
        </div>
      )}
    </div>
  );
}
