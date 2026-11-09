import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { Button, Skeleton, useToast } from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import { projectsApi } from '@/api/projects.api';
import { TaskReflection } from '@/components/meetings/TaskReflection';
import { MeetingLoadError } from '@/components/meetings/MeetingLoadError';
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

  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const m = await refresh();
        if (!cancelled && m) {
          // Members only feed the assignee pickers; a failure here
          // shouldn't hide a summary that loaded fine.
          const ms = await projectsApi.listMembers(m.projectId).catch(() => []);
          if (!cancelled) setMembers(ms);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId, refresh, attempt]);

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
    return (
      <MeetingLoadError
        error={loadError}
        meetingsPath={`/${orgSlug}/projects/${projectSlug}/meetings`}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
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
          <div className="row gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </Button>
            <Button variant="secondary" onClick={reprocess} disabled={reprocessing}>
              <RefreshCw size={14} aria-hidden="true" />
              {reprocessing ? ' Reprocessing…' : ' Re-run AI'}
            </Button>
            <Button
              variant="primary"
              onClick={bulkAccept}
              disabled={bulkBusy || selectedIds.size === 0}
            >
              <Sparkles size={14} aria-hidden="true" />
              {bulkBusy
                ? 'Creating…'
                : `Accept ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </header>

      <div className="ms-grid">
        <section className="card mtg-section ms-tldr-card">
          <h2 className="mtg-section-title">TL;DR</h2>
          {hasSummary ? (
            <p className="ms-tldr">{summary.summaryMd}</p>
          ) : (
            <p className="mtg-empty">No summary yet — re-run the AI to generate one.</p>
          )}
        </section>

        <section className="card mtg-section">
          <SummaryList title="Decisions" items={summary.decisions} empty="None recorded." />
          <SummaryList title="Open questions" items={summary.openQuestions} empty="None." />
          <SummaryList title="Blockers" items={summary.blockers} empty="None." />
        </section>

        <section className="card mtg-section ms-span">
          <div className="mtg-section-head">
            <div>
              <h2 className="mtg-section-title">Action items</h2>
              <p className="mtg-section-sub">
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
            <p className="mtg-empty">
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
          <p className="mtg-note">
            {acceptedCount > 0 && (
              <>
                Accepted items are linked to tasks on this project — open the
                board to find them.{' '}
              </>
            )}
            Bulk accept is atomic — all or nothing, no half-created tasks.
          </p>
        </section>
      </div>
    </div>
  );
}

function SummaryList({ title, items, empty }) {
  return (
    <div className="ms-block">
      <h3 className="ms-block-title">
        {title}
        {items.length > 0 && <span className="ms-block-count">{items.length}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="mtg-empty">{empty}</p>
      ) : (
        <ul className="ms-list">
          {items.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}
