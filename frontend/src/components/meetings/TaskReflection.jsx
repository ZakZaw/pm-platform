import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Link2, Sparkles, Trash2 } from 'lucide-react';
import { Avatar, Button, Input, Priority, StatusBadge, useToast } from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import { tasksApi } from '@/api/tasks.api';

/**
 * F2-22 — one card per action-item draft. Surfaces the AI's
 * suggested owner / due / priority and lets the user accept (as a new
 * task), dismiss, or edit before accepting. Accepted + dismissed
 * states are read-only — the row stays for the audit trail.
 */
export function TaskReflection({
  item, members, projectId, isSelected, onSelectionToggle, onChanged,
}) {
  const toast = useToast();
  const linkRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [assigneeId, setAssigneeId] = useState(item.suggestedOwnerUserId ?? '');
  const [dueDate, setDueDate] = useState(item.suggestedDueDate?.slice(0, 10) ?? '');
  const [priority, setPriority] = useState(item.suggestedPriority ?? 'Medium');
  const [busy, setBusy] = useState(false);

  // "Link to existing task" picker — lazily loads project tasks the
  // first time it opens and filters them client-side by key / title.
  const [linkOpen, setLinkOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [linkQuery, setLinkQuery] = useState('');

  const isAccepted = !!item.acceptedAt;
  const isDismissed = !!item.dismissedAt;
  const isPending = !isAccepted && !isDismissed;

  async function accept() {
    setBusy(true);
    try {
      const dto = await meetingsApi.acceptActionItem(item.id, {
        title: title.trim() || item.title,
        description: description.trim() || null,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
      });
      onChanged?.(dto);
      setEditing(false);
      toast.show({ tone: 'success', message: 'Task created.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not accept.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    try {
      const dto = await meetingsApi.dismissActionItem(item.id);
      onChanged?.(dto);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not dismiss.',
      });
    } finally {
      setBusy(false);
    }
  }

  // Lazily load candidate tasks the first time the link picker opens.
  useEffect(() => {
    if (!linkOpen || !projectId || candidates.length > 0) return undefined;
    let cancelled = false;
    tasksApi
      .listForProject(projectId, { includeDone: true })
      .then((list) => { if (!cancelled) setCandidates(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [linkOpen, projectId, candidates.length]);

  // Close the picker on an outside click.
  useEffect(() => {
    if (!linkOpen) return undefined;
    function onClick(e) {
      if (!linkRef.current?.contains(e.target)) setLinkOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [linkOpen]);

  const linkCandidates = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    return candidates
      .filter((t) =>
        q === ''
        || t.title.toLowerCase().includes(q)
        || (t.key ?? '').toLowerCase().includes(q))
      .slice(0, 40);
  }, [candidates, linkQuery]);

  async function linkExisting(taskId) {
    setBusy(true);
    try {
      const dto = await meetingsApi.acceptActionItem(item.id, { existingTaskId: taskId });
      setLinkOpen(false);
      setLinkQuery('');
      onChanged?.(dto);
      toast.show({ tone: 'success', message: 'Linked to existing task.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not link task.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={[
      'ar-card',
      isPending && 'has-check',
      isAccepted && 'is-accepted',
      isDismissed && 'is-dismissed',
    ].filter(Boolean).join(' ')}>
      <header className="ar-card-head">
        {isPending && (
          <input
            type="checkbox"
            className="cb ar-card-check"
            checked={isSelected}
            onChange={() => onSelectionToggle?.(item.id)}
            aria-label={`Include "${item.title}" in bulk accept`}
          />
        )}
        <div className="ar-card-title-row">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          ) : (
            <h3 className="ar-card-title">{item.title}</h3>
          )}
          <div className="ar-card-state">
            {isAccepted && (
              <span className="mtg-dot mtg-dot-rsvp-accepted">Accepted</span>
            )}
            {isDismissed && (
              <span className="mtg-dot mtg-dot-rsvp-pending">Dismissed</span>
            )}
          </div>
        </div>
      </header>

      {item.description && !editing && (
        <p className="ar-card-desc">{item.description}</p>
      )}

      {editing && (
        <div className="ar-card-edit">
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context"
          />
          <div className="ar-card-edit-row">
            <label className="ar-edit-field">
              <span>Assignee</span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.fullName}</option>
                ))}
              </select>
            </label>
            <label className="ar-edit-field">
              <span>Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            <label className="ar-edit-field">
              <span>Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <footer className="ar-card-foot">
        <div className="ar-card-meta">
          {item.suggestedPriority && (
            <span className="ar-card-pri">
              <Priority level={item.suggestedPriority} showLabel />
            </span>
          )}
          {item.suggestedOwnerFullName && !editing && (
            <span className="ar-card-owner">
              <Avatar size="xs" name={item.suggestedOwnerFullName} />
              <span>{item.suggestedOwnerFullName}</span>
            </span>
          )}
          {item.suggestedDueDate && !editing && (
            <span className="ar-card-due">
              Due {new Date(item.suggestedDueDate).toLocaleDateString([], {
                month: 'short', day: 'numeric',
              })}
            </span>
          )}
        </div>
        {isPending && (
          <div className="row gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={accept} disabled={busy}>
                  <Sparkles size={13} aria-hidden="true" />
                  {busy ? 'Saving…' : 'Create task'}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
                  <Trash2 size={13} aria-hidden="true" /> Dismiss
                </Button>
                <div className="ar-link-wrap" ref={linkRef}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLinkOpen((v) => !v)}
                    disabled={busy}
                  >
                    <Link2 size={13} aria-hidden="true" /> Link existing
                  </Button>
                  {linkOpen && (
                    <div className="menu ar-link-menu" role="menu">
                      <div className="ar-link-search">
                        <input
                          type="text"
                          className="input"
                          value={linkQuery}
                          autoFocus
                          placeholder="Search by key or title…"
                          onChange={(e) => setLinkQuery(e.target.value)}
                        />
                      </div>
                      <div className="ar-link-list">
                        {linkCandidates.length === 0 ? (
                          <p className="muted ar-link-empty">No matching tasks.</p>
                        ) : (
                          linkCandidates.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              role="menuitem"
                              className="menu-item ar-link-item"
                              onClick={() => linkExisting(t.id)}
                              disabled={busy}
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
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={accept} disabled={busy}>
                  <Check size={13} aria-hidden="true" /> Accept
                </Button>
              </>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}
