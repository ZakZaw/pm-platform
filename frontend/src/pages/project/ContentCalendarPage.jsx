import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { marketingApi } from '@/api/marketing.api';
import { MARKETING_CHANNELS, channelTokens } from '@/constants/projectTypes';
import './ContentCalendarPage.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function buildMonthCells(anchor) {
  const first = startOfMonth(anchor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function ContentCalendarPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [calendar, setCalendar] = useState(null);
  const [error, setError] = useState(null);
  const [activeAsset, setActiveAsset] = useState(null);

  const cells = useMemo(() => buildMonthCells(anchor), [anchor]);

  const load = useCallback(async (projectId, anchorDate) => {
    const first = new Date(anchorDate);
    first.setDate(first.getDate() - first.getDay());
    const last = new Date(first);
    last.setDate(first.getDate() + 42);
    const data = await marketingApi.getCalendar(projectId, {
      from: first.toISOString(),
      to: last.toISOString(),
    });
    setCalendar(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await load(p.id, anchor);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load calendar.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, anchor, load]);

  const assetsByDay = useMemo(() => {
    const map = new Map();
    if (!calendar) return map;
    for (const a of calendar.assets) {
      const key = ymd(new Date(a.publishDate));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return map;
  }, [calendar]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event) {
    setActiveAsset(null);
    const { active, over } = event;
    if (!over || !active) return;
    const assetId = active.id;
    const newDay = over.id;
    const asset = calendar?.assets.find((a) => a.id === assetId);
    if (!asset) return;
    const oldDay = ymd(new Date(asset.publishDate));
    if (oldDay === newDay) return;

    const prevCalendar = calendar;
    const updatedAsset = { ...asset, publishDate: new Date(`${newDay}T12:00:00`).toISOString() };
    setCalendar({
      ...calendar,
      assets: calendar.assets.map((a) => (a.id === assetId ? updatedAsset : a)),
    });

    try {
      await marketingApi.rescheduleAsset(assetId, updatedAsset.publishDate);
    } catch (err) {
      setCalendar(prevCalendar);
      toast.show({
        tone: 'danger',
        title: 'Could not reschedule',
        message: err.response?.data?.detail ?? 'Server rejected the change.',
      });
    }
  }

  const monthLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = ymd(new Date());

  if (error) {
    return <div className="page"><p style={{ color: 'var(--status-danger)' }}>{error}</p></div>;
  }

  return (
    <div className="page calendar-page">
      <header className="page-header calendar-page__head">
        <div className="hstack" style={{ gap: 12, alignItems: 'baseline' }}>
          <h1 className="page-title">Calendar</h1>
          <span className="muted">· {monthLabel}</span>
        </div>
        <div className="calendar-nav">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </header>

      {!calendar ? (
        <Skeleton height={520} />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => {
            const a = calendar.assets.find((x) => x.id === e.active.id);
            setActiveAsset(a ?? null);
          }}
          onDragCancel={() => setActiveAsset(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="calendar-grid">
            {DAY_NAMES.map((d) => (
              <div key={d} className="calendar-grid__dayhead">{d}</div>
            ))}
            {cells.map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === anchor.getMonth();
              return (
                <CalendarCell
                  key={key}
                  dayKey={key}
                  date={d}
                  isOtherMonth={!inMonth}
                  isToday={key === today}
                  assets={assetsByDay.get(key) ?? []}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeAsset ? <AssetChip asset={activeAsset} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="calendar-channel-legend">
        {MARKETING_CHANNELS.map((ch) => {
          const t = channelTokens(ch);
          return (
            <span key={ch}>
              <span className="calendar-channel-legend__swatch" style={{ background: t.fg }} />
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CalendarCell({ dayKey, date, isOtherMonth, isToday, assets }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const classes = [
    'calendar-cell',
    isOtherMonth && 'is-other-month',
    isToday && 'is-today',
    isOver && 'is-over',
  ].filter(Boolean).join(' ');
  return (
    <div ref={setNodeRef} className={classes}>
      <div className="calendar-cell__date">{date.getDate()}</div>
      {assets.map((a) => (
        <AssetChip key={a.id} asset={a} />
      ))}
    </div>
  );
}

function AssetChip({ asset, overlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    disabled: overlay,
  });
  const tokens = channelTokens(asset.channel);
  const classes = ['calendar-chip', isDragging && !overlay && 'is-dragging']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      className={classes}
      style={{ background: tokens.bg, color: tokens.fg }}
      data-status={asset.status}
      title={`${asset.title} · ${asset.channel} · ${asset.status}`}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
    >
      <span className="calendar-chip__dot" aria-hidden="true" />
      <span className="calendar-chip__title">{asset.title}</span>
    </div>
  );
}
