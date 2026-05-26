import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Trash2 } from 'lucide-react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Skeleton,
  useToast,
} from '@/components/ui';
import { roadmapApi } from '@/api/roadmap.api';
import './ShareLinkModal.css';

function formatExpiry(dt) {
  if (!dt) return 'No expiry';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return 'No expiry';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function ShareLinkModal({ open, projectId, onClose }) {
  const toast = useToast();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    password: '',
    expiresAt: '',
    hideInternalLabels: false,
    hideAssignees: false,
  });

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const rows = await roadmapApi.listShareLinks(projectId);
      setLinks(rows);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not load share links.',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (!open) return;
    setDraft({
      password: '',
      expiresAt: '',
      hideInternalLabels: false,
      hideAssignees: false,
    });
    reload();
  }, [open, reload]);

  async function createLink() {
    setCreating(true);
    try {
      const body = {
        password: draft.password.trim() || null,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
        hideInternalLabels: draft.hideInternalLabels,
        hideAssignees: draft.hideAssignees,
      };
      const created = await roadmapApi.createShareLink(projectId, body);
      setLinks((cur) => [created, ...cur]);
      toast.show({ tone: 'success', message: 'Link created.' });
      setDraft({
        password: '',
        expiresAt: '',
        hideInternalLabels: false,
        hideAssignees: false,
      });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create link.',
      });
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(linkId) {
    try {
      await roadmapApi.revokeShareLink(projectId, linkId);
      setLinks((cur) =>
        cur.map((l) => (l.id === linkId ? { ...l, revokedAt: new Date().toISOString() } : l)),
      );
      toast.show({ tone: 'success', message: 'Link revoked.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not revoke link.',
      });
    }
  }

  async function copyToClipboard(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ tone: 'success', message: 'Link copied.' });
    } catch {
      toast.show({ tone: 'danger', message: 'Copy failed.' });
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="share-modal-title" size="lg">
      <ModalHeader>
        <h3 id="share-modal-title" className="modal-title">Share roadmap</h3>
      </ModalHeader>
      <ModalBody>
        <p className="muted share-modal__intro">
          Read-only links you can send to stakeholders outside the platform.
          The roadmap stays live — changes show up the next time anyone
          opens the link.
        </p>

        <div className="share-modal__create">
          <div className="eyebrow">New link</div>
          <div className="row gap-4 share-modal__row">
            <label className="col gap-1 fill">
              <span className="muted">Password (optional)</span>
              <input
                className="input"
                type="text"
                placeholder="Leave blank for open access"
                value={draft.password}
                onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                maxLength={128}
              />
            </label>
            <label className="col gap-1">
              <span className="muted">Expires</span>
              <input
                className="input"
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))}
              />
            </label>
          </div>
          <div className="row gap-4 share-modal__toggles">
            <label className="row gap-2">
              <input
                type="checkbox"
                className="cb"
                checked={draft.hideInternalLabels}
                onChange={(e) => setDraft((d) => ({ ...d, hideInternalLabels: e.target.checked }))}
              />
              <span>Hide internal labels (risk flags)</span>
            </label>
            <label className="row gap-2">
              <input
                type="checkbox"
                className="cb"
                checked={draft.hideAssignees}
                onChange={(e) => setDraft((d) => ({ ...d, hideAssignees: e.target.checked }))}
              />
              <span>Hide assignee names</span>
            </label>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
            <Button variant="primary" size="sm" onClick={createLink} disabled={creating}>
              {creating ? 'Creating…' : 'Generate link'}
            </Button>
          </div>
        </div>

        <div className="divider" style={{ margin: 'var(--s-7) 0' }} />

        <div className="eyebrow">Existing links</div>
        {loading ? (
          <div className="col gap-3">
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : links.length === 0 ? (
          <p className="muted">No share links yet.</p>
        ) : (
          <ul className="share-modal__list">
            {links.map((l) => {
              const revoked = !!l.revokedAt;
              const expired = l.expiresAt && new Date(l.expiresAt) < new Date();
              return (
                <li
                  key={l.id}
                  className={`share-modal__row ${revoked || expired ? 'is-disabled' : ''}`}
                >
                  <div className="col gap-1 fill" style={{ minWidth: 0 }}>
                    <div className="row gap-2 share-modal__url">
                      <code className="mono truncate" title={l.url}>{l.url}</code>
                      {l.hasPassword && (
                        <span className="badge badge-neutral">password</span>
                      )}
                      {revoked && <span className="badge badge-danger">revoked</span>}
                      {!revoked && expired && (
                        <span className="badge badge-warning">expired</span>
                      )}
                    </div>
                    <div className="muted share-modal__meta">
                      Created by {l.createdByName ?? '—'} ·{' '}
                      {l.expiresAt ? `Expires ${formatExpiry(l.expiresAt)}` : 'No expiry'}
                      {l.hideInternalLabels ? ' · labels hidden' : ''}
                      {l.hideAssignees ? ' · assignees hidden' : ''}
                    </div>
                  </div>
                  <div className="row gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(l.url)}>
                      <Copy size={11} aria-hidden="true" /> Copy
                    </Button>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-ghost btn-sm"
                    >
                      <ExternalLink size={11} aria-hidden="true" /> Open
                    </a>
                    {!revoked && (
                      <Button size="sm" variant="ghost" onClick={() => revokeLink(l.id)}>
                        <Trash2 size={11} aria-hidden="true" /> Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </ModalFooter>
    </Modal>
  );
}
