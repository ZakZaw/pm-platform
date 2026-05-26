import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GitMerge, Plus, X } from 'lucide-react';
import { StatusBadge, useToast } from '@/components/ui';
import { tasksApi } from '@/api/tasks.api';
import './DependenciesSection.css';

export function DependenciesSection({ taskId, projectId }) {
  const toast = useToast();
  const wrapRef = useRef(null);
  const [deps, setDeps] = useState({ dependsOn: [], blocking: [] });
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.listDependencies(taskId);
      setDeps(data);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not load dependencies.',
      });
    } finally {
      setLoading(false);
    }
  }, [taskId, toast]);

  useEffect(() => {
    if (taskId) reload();
  }, [taskId, reload]);

  // Load candidate tasks lazily when the picker opens. Strip out the
  // current task and any already-attached prerequisite.
  useEffect(() => {
    if (!pickerOpen || !projectId) return undefined;
    let cancelled = false;
    tasksApi
      .listForProject(projectId, { includeDone: true })
      .then((list) => { if (!cancelled) setCandidates(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pickerOpen, projectId]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    function onClick(e) {
      if (!wrapRef.current?.contains(e.target)) setPickerOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [pickerOpen]);

  const filtered = useMemo(() => {
    const attached = new Set(deps.dependsOn.map((d) => d.taskId));
    const q = query.trim().toLowerCase();
    return candidates
      .filter((t) => t.id !== taskId && !attached.has(t.id))
      .filter((t) =>
        q === ''
        || t.title.toLowerCase().includes(q)
        || (t.key ?? '').toLowerCase().includes(q))
      .slice(0, 40);
  }, [candidates, deps.dependsOn, taskId, query]);

  async function addDep(targetId) {
    setBusy(true);
    try {
      await tasksApi.addDependency(taskId, targetId);
      setPickerOpen(false);
      setQuery('');
      await reload();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not add dependency.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeDep(prereqId) {
    setBusy(true);
    try {
      await tasksApi.removeDependency(taskId, prereqId);
      await reload();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not remove dependency.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dependencies-section" ref={wrapRef}>
      <div className="eyebrow dependencies-section__head">
        <GitMerge size={11} aria-hidden="true" /> Dependencies
      </div>

      <div className="dependencies-section__group">
        <div className="dependencies-section__group-label">
          <ArrowUp size={10} aria-hidden="true" /> Blocked by
        </div>
        {deps.dependsOn.length === 0 ? (
          <p className="muted dependencies-section__empty">No prerequisites.</p>
        ) : (
          <ul className="dependencies-section__list">
            {deps.dependsOn.map((d) => (
              <DepRow
                key={d.id}
                dep={d}
                onRemove={() => removeDep(d.taskId)}
                busy={busy}
                removable
              />
            ))}
          </ul>
        )}
        <button
          type="button"
          className="dependencies-section__add"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={loading || busy}
        >
          <Plus size={11} aria-hidden="true" /> Add prerequisite
        </button>
        {pickerOpen && (
          <div className="menu dependencies-section__menu" role="menu">
            <div className="dependencies-section__search">
              <input
                type="text"
                className="input"
                value={query}
                autoFocus
                placeholder="Search by key or title…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="dependencies-section__menu-list">
              {filtered.length === 0 ? (
                <p className="muted dependencies-section__menu-empty">
                  No matching tasks.
                </p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitem"
                    className="menu-item dependencies-section__menu-item"
                    onClick={() => addDep(t.id)}
                  >
                    <span className="mono muted">{t.key}</span>
                    <span className="truncate">{t.title}</span>
                    <StatusBadge status={t.status} />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="dependencies-section__group">
        <div className="dependencies-section__group-label">
          <ArrowDown size={10} aria-hidden="true" /> Blocks
        </div>
        {deps.blocking.length === 0 ? (
          <p className="muted dependencies-section__empty">Nothing waits on this.</p>
        ) : (
          <ul className="dependencies-section__list">
            {deps.blocking.map((d) => (
              <DepRow key={d.id} dep={d} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DepRow({ dep, onRemove, busy, removable }) {
  return (
    <li className="dependencies-section__row">
      <span className="mono muted">{dep.key}</span>
      <span className="truncate">{dep.title}</span>
      <StatusBadge status={dep.status} />
      {removable && (
        <button
          type="button"
          className="btn btn-ghost btn-icon-sm"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${dep.key}`}
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
