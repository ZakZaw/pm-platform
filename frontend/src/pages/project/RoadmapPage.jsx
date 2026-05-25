import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Filter, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Segmented,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { roadmapApi } from '@/api/roadmap.api';
import { adapterForType } from '@/components/roadmap/roadmapRegistry';
import { RoadmapView } from '@/components/roadmap/RoadmapView';
import { findProjectType } from '@/constants/projectTypes';
import './RoadmapPage.css';

const TYPE_TONE = {
  Engineering: 'accent',
  Sales: 'success',
  Support: 'rose',
  Marketing: 'warning',
  Operations: 'violet',
  Generic: 'neutral',
};

const EDIT_ROLES = new Set(['PM', 'TeamLead']);

export function RoadmapPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState('q');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState({ ownerId: null, status: null, riskOnly: false });
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [pendingCascade, setPendingCascade] = useState(null);
  const [milestoneMenu, setMilestoneMenu] = useState(null);

  const reload = useCallback(async (proj) => {
    const adapter = adapterForType(proj.type);
    if (!adapter) { setData(null); return; }
    const result = await adapter(proj.id);
    setData(result);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await reload(p);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load roadmap.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, reload]);

  const meta = project ? findProjectType(project.type) : null;
  const tone = TYPE_TONE[meta?.id] ?? 'neutral';
  const canEdit = EDIT_ROLES.has(project?.myRole ?? '');

  // Filter bars + points after the adapter — keeps adapter logic clean.
  const filteredData = useMemo(() => {
    if (!data) return data;
    let bars = data.bars;
    if (filter.ownerId) bars = bars.filter((b) => b.ownerId === filter.ownerId);
    if (filter.status) bars = bars.filter((b) => b.sublabel === filter.status);
    if (filter.riskOnly) bars = bars.filter((b) => b.riskFlag);
    return { ...data, bars };
  }, [data, filter]);

  // Build owner + status options for the filter dropdown from current bars.
  const filterOptions = useMemo(() => {
    if (!data?.bars) return { owners: [], statuses: [] };
    const owners = new Map();
    const statuses = new Set();
    for (const b of data.bars) {
      if (b.ownerId) owners.set(b.ownerId, b.ownerName ?? 'Unknown');
      if (b.sublabel) statuses.add(b.sublabel);
    }
    return {
      owners: [...owners.entries()].map(([id, name]) => ({ id, name })),
      statuses: [...statuses],
    };
  }, [data]);

  const handleResize = useCallback(async (epicId, { startDate, endDate }) => {
    if (!project) return;
    try {
      const result = await roadmapApi.updateEpicDates(project.id, epicId, {
        startDate, endDate, cascade: false,
      });
      if (!result.applied && result.affected.length > 0) {
        setPendingCascade({ epicId, startDate, endDate, affected: result.affected });
        return;
      }
      await reload(project);
      toast.show({ tone: 'success', message: 'Epic dates updated.' });
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Could not update epic dates.';
      toast.show({ tone: 'danger', message: detail });
      await reload(project);
    }
  }, [project, reload, toast]);

  const handleConfirmCascade = useCallback(async () => {
    if (!project || !pendingCascade) return;
    try {
      await roadmapApi.updateEpicDates(project.id, pendingCascade.epicId, {
        startDate: pendingCascade.startDate,
        endDate: pendingCascade.endDate,
        cascade: true,
      });
      toast.show({
        tone: 'success',
        message: `Shifted ${pendingCascade.affected.length} dependent epic${pendingCascade.affected.length === 1 ? '' : 's'}.`,
      });
      setPendingCascade(null);
      await reload(project);
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Cascade failed.';
      toast.show({ tone: 'danger', message: detail });
    }
  }, [project, pendingCascade, reload, toast]);

  const handlePointClick = useCallback((point) => {
    // Sprint markers are read-only; milestones get a small action menu.
    if (point.kind !== 'milestone' || !canEdit || !point.editable) return;
    setMilestoneMenu(point);
  }, [canEdit]);

  const handleMilestoneDelete = useCallback(async () => {
    if (!project || !milestoneMenu) return;
    try {
      await roadmapApi.deleteMilestone(project.id, milestoneMenu.id);
      toast.show({ tone: 'success', message: 'Milestone removed.' });
      setMilestoneMenu(null);
      await reload(project);
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Could not delete milestone.';
      toast.show({ tone: 'danger', message: detail });
    }
  }, [project, milestoneMenu, reload, toast]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner roadmap-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {project?.name ?? '…'} · Timeline
            </div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>Roadmap</h1>
            {meta && (
              <p className="page-subtitle" style={{ marginTop: 6 }}>
                {meta.label} project · {canEdit ? 'drag bar edges to shift dates.' : 'read-only.'}
              </p>
            )}
          </div>
          <div className="row gap-3">
            {meta && <Badge tone={tone} dot>{meta.label}</Badge>}
            <Segmented
              value={zoom}
              onChange={setZoom}
              options={[
                { value: 'w', label: 'Week' },
                { value: 'm', label: 'Month' },
                { value: 'q', label: 'Quarter' },
              ]}
              ariaLabel="Timeline scale"
            />
            <div className="roadmap-page__filter-wrap">
              <Button size="sm" onClick={() => setFilterOpen((v) => !v)}>
                <Filter size={13} aria-hidden="true" /> Filter
                {(filter.ownerId || filter.status || filter.riskOnly) && (
                  <span className="roadmap-page__filter-dot" aria-label="active" />
                )}
              </Button>
              {filterOpen && (
                <FilterMenu
                  options={filterOptions}
                  value={filter}
                  onChange={(v) => setFilter(v)}
                  onClose={() => setFilterOpen(false)}
                />
              )}
            </div>
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setMilestoneOpen(true)}
              >
                <Plus size={14} aria-hidden="true" /> Milestone
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="roadmap-page-body">
        {!project ? (
          <Skeleton height={220} radius="lg" />
        ) : (
          <RoadmapView
            data={filteredData}
            loading={loading}
            zoom={zoom}
            roleCanEdit={canEdit}
            onResize={handleResize}
            onPointClick={handlePointClick}
          />
        )}
        {data?.undated?.length > 0 && (
          <div className="roadmap-page__undated">
            <span className="eyebrow">Not yet placed</span>
            <ul>
              {data.undated.map((e) => (
                <li key={e.id} className="muted">{e.title}</li>
              ))}
            </ul>
            <p className="muted roadmap-page__hint">
              Open an epic and set its start &amp; end dates to add it to the timeline.
            </p>
          </div>
        )}
      </div>

      <CascadeConfirmModal
        cascade={pendingCascade}
        onClose={() => setPendingCascade(null)}
        onConfirm={handleConfirmCascade}
      />

      <MilestoneCreateModal
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        onCreate={async (body) => {
          try {
            await roadmapApi.createMilestone(project.id, body);
            toast.show({ tone: 'success', message: 'Milestone added.' });
            setMilestoneOpen(false);
            await reload(project);
          } catch (err) {
            const detail = err.response?.data?.detail ?? 'Could not add milestone.';
            toast.show({ tone: 'danger', message: detail });
          }
        }}
        epics={data?.bars ?? []}
      />

      <Modal
        open={!!milestoneMenu}
        onClose={() => setMilestoneMenu(null)}
        size="sm"
        labelledBy="milestone-menu-title"
      >
        <ModalHeader>
          <h3 id="milestone-menu-title" className="modal-title">
            {milestoneMenu?.label}
          </h3>
        </ModalHeader>
        <ModalBody>
          <p className="muted">
            {milestoneMenu && new Date(milestoneMenu.at).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setMilestoneMenu(null)}>Close</Button>
          {canEdit && (
            <Button variant="danger" onClick={handleMilestoneDelete}>
              Remove milestone
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}

function CascadeConfirmModal({ cascade, onClose, onConfirm }) {
  return (
    <Modal
      open={!!cascade}
      onClose={onClose}
      labelledBy="cascade-title"
      size="md"
    >
      <ModalHeader>
        <h3 id="cascade-title" className="modal-title">Shift dependent epics?</h3>
      </ModalHeader>
      <ModalBody>
        <p>
          Moving this epic forward bumps the start date of{' '}
          {cascade?.affected.length} dependent {cascade?.affected.length === 1 ? 'epic' : 'epics'}.
          Confirm to shift the whole chain, or cancel to leave dependents in place
          (they'll overlap the prerequisite).
        </p>
        <ul className="roadmap-page__cascade-list">
          {cascade?.affected.map((a) => (
            <li key={a.epicId}>
              <strong>{a.title}</strong>
              <span className="mono muted">
                {a.newStartDate} → {a.newEndDate}
              </span>
            </li>
          ))}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>
          Confirm shift
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function FilterMenu({ options, value, onChange, onClose }) {
  return (
    <div className="menu roadmap-page__menu" role="menu">
      <div className="menu-section">
        <div className="menu-label">Owner</div>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={!value.ownerId}
          className={`menu-item ${!value.ownerId ? 'is-selected' : ''}`}
          onClick={() => onChange({ ...value, ownerId: null })}
        >
          Anyone
        </button>
        {options.owners.map((o) => (
          <button
            key={o.id}
            type="button"
            role="menuitemradio"
            aria-checked={value.ownerId === o.id}
            className={`menu-item ${value.ownerId === o.id ? 'is-selected' : ''}`}
            onClick={() => onChange({ ...value, ownerId: o.id })}
          >
            {o.name}
          </button>
        ))}
      </div>
      <div className="menu-sep" />
      <div className="menu-section">
        <div className="menu-label">Status</div>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={!value.status}
          className={`menu-item ${!value.status ? 'is-selected' : ''}`}
          onClick={() => onChange({ ...value, status: null })}
        >
          Any
        </button>
        {options.statuses.map((s) => (
          <button
            key={s}
            type="button"
            role="menuitemradio"
            aria-checked={value.status === s}
            className={`menu-item ${value.status === s ? 'is-selected' : ''}`}
            onClick={() => onChange({ ...value, status: s })}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="menu-sep" />
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={value.riskOnly}
        className={`menu-item ${value.riskOnly ? 'is-selected' : ''}`}
        onClick={() => onChange({ ...value, riskOnly: !value.riskOnly })}
      >
        Only flagged-risk epics
      </button>
      <div className="menu-sep" />
      <button
        type="button"
        className="menu-item"
        onClick={() => { onChange({ ownerId: null, status: null, riskOnly: false }); onClose(); }}
      >
        Clear filters
      </button>
    </div>
  );
}

function MilestoneCreateModal({ open, onClose, onCreate, epics }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [color, setColor] = useState('#5B6AF0');
  const [epicId, setEpicId] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setDate(new Date().toISOString().slice(0, 10));
      setColor('#5B6AF0');
      setEpicId('');
    }
  }, [open]);

  const valid = title.trim().length >= 2 && !!date;

  return (
    <Modal open={open} onClose={onClose} labelledBy="ms-title" size="md">
      <ModalHeader>
        <h3 id="ms-title" className="modal-title">Add milestone</h3>
      </ModalHeader>
      <ModalBody>
        <div className="col gap-4">
          <label className="col gap-1">
            <span className="muted">Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Beta launch"
              data-autofocus
            />
          </label>
          <div className="row gap-4">
            <label className="col gap-1 fill">
              <span className="muted">Date</span>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="col gap-1">
              <span className="muted">Color</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 40, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}
              />
            </label>
          </div>
          <label className="col gap-1">
            <span className="muted">Pin to epic (optional)</span>
            <select
              className="input"
              value={epicId}
              onChange={(e) => setEpicId(e.target.value)}
            >
              <option value="">— None —</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </label>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => onCreate({
            title: title.trim(),
            date,
            color,
            epicId: epicId || null,
          })}
        >
          Add milestone
        </Button>
      </ModalFooter>
    </Modal>
  );
}
