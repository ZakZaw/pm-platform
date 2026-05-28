import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { Badge, Button, Skeleton, useToast } from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import { projectsApi } from '@/api/projects.api';
import { TaskReflection } from '@/components/meetings/TaskReflection';
import '@/components/meetings/meetings.css';
import '@/components/meetings/meetingSummary.css';

/**
 * F2-22 — post-meeting summary page. Reads the AI's TL;DR + decisions
 * / open questions / blockers, and renders the action-item drafts as
 * <c>TaskReflection</c> cards. Organisers can re-run processing or
 * bulk-accept every pending item; everyone else gets the read-only
 * view.
 */
export function MeetingSummaryPage() {
  const { slug: orgSlug, projectSlug, meetingId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [meeting, setMeeting] = useState(null);
  const [summary, setSummary] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [m, s, items] = await Promise.all([
      meetingsApi.get(meetingId),
      meetingsApi.getSummary(meetingId),
      meetingsApi.listActionItems(meetingId),
    ]);
    setMeeting(m);
    setSummary(s);
    setActionItems(items);
    // Reset selection to "every pending item" so a fresh page render
    // lets a one-click bulk-accept run.
    setSelectedIds(new Set(items
      .filter((i) => !i.acceptedAt && !i.dismissedAt)
      .map((i) => i.id)));
    return m;
  }, [meetingId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const m = await refresh();
        if (!cancelled && m) {
          const ms = await projectsApi.listMembers(m.projectId);
          if (!cancelled) setMembers(ms);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId, refresh]);

  async function reprocess() {
    setReprocessing(true);
    try {
      await meetingsApi.process(meetingId);
      await refresh();
      toast.show({ tone: 'success', message: 'Summary refreshed.' });
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 503
        ? 'AI is not configured on the server.'
        : err.response?.data?.detail ?? 'Could not re-run the AI.';
      toast.show({ tone: 'danger', message: msg });
    } finally {
      setReprocessing(false);
    }
  }

  async function bulkAccept() {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await meetingsApi.bulkAcceptActionItems(meetingId, [...selectedIds]);
      await refresh();
      toast.show({
        tone: 'success',
        message: `Created ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}.`,
      });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Bulk accept failed — no tasks were created.',
      });
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelection(id) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading && !meeting) {
    return <div className="main-inner"><Skeleton height={400} radius="lg" /></div>;
  }
  if (!meeting || !summary) {
    return <div className="main-inner"><p className="muted">Meeting not found.</p></div>;
  }

  const pendingCount = actionItems.filter((i) => !i.acceptedAt && !i.dismissedAt).length;
  const acceptedCount = actionItems.filter((i) => i.acceptedAt).length;
  const hasSummary = !!summary.summaryMd;

  return (
    <div className="main-inner">
      <header className="page-head">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">
              <Link to={`/${orgSlug}/projects/${projectSlug}/meetings/${meeting.id}`}>
                {meeting.title}
              </Link> · Summary
            </p>
            <h1 className="page-title">AI summary &amp; action items</h1>
            <p className="page-subtitle">
              {summary.processedAt
                ? `Processed ${new Date(summary.processedAt).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}`
                : 'Not yet processed.'}
            </p>
          </div>
          <div className="row gap-2">
            <Button variant="ghost" onClick={reprocess} disabled={reprocessing}>
              <RefreshCw size={12} aria-hidden="true" />
              {reprocessing ? ' Reprocessing…' : ' Re-run AI'}
            </Button>
            <Button
              variant="primary"
              onClick={bulkAccept}
              disabled={bulkBusy || selectedIds.size === 0}
            >
              <Sparkles size={12} aria-hidden="true" />
              {bulkBusy
                ? 'Creating…'
                : `Accept ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </header>

      <div className="ms-grid">
        <section className="ms-card">
          <h2>TL;DR</h2>
          {hasSummary ? (
            <p className="ms-tldr">{summary.summaryMd}</p>
          ) : (
            <p className="ms-empty">No summary yet — re-run the AI to generate one.</p>
          )}
        </section>

        <section className="ms-card">
          <h2>Decisions</h2>
          {summary.decisions.length === 0 ? (
            <p className="ms-empty">None recorded.</p>
          ) : (
            <ul className="ms-list">
              {summary.decisions.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}

          <h2 style={{ marginTop: 'var(--s-4)' }}>Open questions</h2>
          {summary.openQuestions.length === 0 ? (
            <p className="ms-empty">None.</p>
          ) : (
            <ul className="ms-list">
              {summary.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          )}

          <h2 style={{ marginTop: 'var(--s-4)' }}>Blockers</h2>
          {summary.blockers.length === 0 ? (
            <p className="ms-empty">None.</p>
          ) : (
            <ul className="ms-list">
              {summary.blockers.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
        </section>

        <section className="ms-card" style={{ gridColumn: '1 / -1' }}>
          <div className="ms-actions-head">
            <div>
              <h2>Action items</h2>
              <p className="muted" style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
                {pendingCount} pending · {acceptedCount} accepted
              </p>
            </div>
            <div className="row gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSelectedIds(new Set(actionItems
                    .filter((i) => !i.acceptedAt && !i.dismissedAt)
                    .map((i) => i.id)))}
              >
                Select all pending
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>

          {actionItems.length === 0 ? (
            <p className="ms-empty">
              No drafts yet. Captions in the meeting room feed the transcript;
              re-running the AI once a transcript exists will populate this list.
            </p>
          ) : (
            <div className="ar-list">
              {actionItems.map((item) => (
                <TaskReflection
                  key={item.id}
                  item={item}
                  members={members}
                  projectId={meeting.projectId}
                  isSelected={selectedIds.has(item.id)}
                  onSelectionToggle={toggleSelection}
                  onChanged={(updated) => {
                    setActionItems((cur) => cur.map((c) => (c.id === updated.id ? updated : c)));
                    setSelectedIds((cur) => {
                      const next = new Set(cur);
                      next.delete(updated.id);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          )}
          {acceptedCount > 0 && (
            <p className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s-3)' }}>
              <CheckCircle2 size={11} aria-hidden="true" /> Accepted items are
              linked to tasks on this project — open the board to find them.
            </p>
          )}
          <Badge tone="neutral" style={{ alignSelf: 'flex-start' }}>
            <span aria-hidden="true">·</span> Bulk accept is atomic — all or
            nothing, no half-created tasks.
          </Badge>
        </section>
      </div>

      <footer className="row" style={{ marginTop: 'var(--s-5)' }}>
        <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
      </footer>
    </div>
  );
}
