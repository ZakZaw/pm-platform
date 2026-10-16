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
import { MARKETING_CHANNELS } from '@/constants/projectTypes';
import { channelClass } from '@/components/marketing/channel';
import '@/components/marketing/channel.css';
import './ContentCalendarPage.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
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

  const [, setProject] = useState(null);
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
    return <div className="main-inner"><p className="calendar-page-error">{error}</p></div>;
  }

  return (
    <div className="main-inner calendar-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">Content calendar</div>
            <h1 className="page-title">{monthLabel}</h1>
            <div className="page-subtitle">Drag an asset to another day to reschedule it.</div>
          </div>
          <div className="row gap-2">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
              aria-label="Previous month"
              title="Previous month"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAnchor(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
              aria-label="Next month"
              title="Next month"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

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
          <div className="cal">
            <div className="cal-head">
              {DAY_NAMES.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="cal-grid">
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
          </div>

          <DragOverlay>
            {activeAsset ? <AssetChip asset={activeAsset} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <div className="calendar-channel-legend">
        {MARKETING_CHANNELS.map((ch) => (
          <span key={ch} className={channelClass(ch)}>
            <span className="mkt-ch-dot" aria-hidden="true" />
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

function CalendarCell({ dayKey, date, isOtherMonth, isToday, assets }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const classes = [
    'cal-cell',
    isOtherMonth && 'is-other',
    isToday && 'is-today',
    isOver && 'is-over',
  ].filter(Boolean).join(' ');
  return (
    <div ref={setNodeRef} className={classes}>
      <div className="cal-date">{date.getDate()}</div>
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
  const classes = ['cal-event', channelClass(asset.channel), isDragging && !overlay && 'is-dragging']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      className={classes}
      data-status={asset.status}
      title={`${asset.title} · ${asset.channel} · ${asset.status}`}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
    >
      {asset.title}
    </div>
  );
}
