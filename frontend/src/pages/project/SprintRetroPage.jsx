import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  CornerUpRight,
  Frown,
  Lightbulb,
  RefreshCw,
  Smile,
  Sparkles,
} from 'lucide-react';
import { Button, Skeleton, useToast } from '@/components/ui';
import { useConfirm } from '@/hooks/useConfirm';
import { projectsApi } from '@/api/projects.api';
import { sprintsApi } from '@/api/sprints.api';
import './SprintRetroPage.css';

const SECTIONS = [
  { key: 'summary', label: 'Summary', Icon: Sparkles, tone: 'info' },
  { key: 'whatWentWell', label: 'What went well', Icon: Smile, tone: 'success' },
  { key: 'whatDidnt', label: "What didn't", Icon: Frown, tone: 'warning' },
  { key: 'suggestions', label: 'Suggestions', Icon: Lightbulb, tone: 'purple' },
];

export function SprintRetroPage() {
  const { slug: orgSlug, projectSlug, sprintId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [project, setProject] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [retro, setRetro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  // Local edit buffers — committed on blur so the page doesn't PATCH on
  // every keystroke. Reset whenever the underlying retro id changes.
  const [drafts, setDrafts] = useState({
    summary: '', whatWentWell: '', whatDidnt: '', suggestions: '',
  });
  useEffect(() => {
    if (retro) {
      setDrafts({
        summary: retro.summary ?? '',
        whatWentWell: retro.whatWentWell ?? '',
        whatDidnt: retro.whatDidnt ?? '',
        suggestions: retro.suggestions ?? '',
      });
    }
  }, [retro?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await projectsApi.getBySlug(orgSlug, projectSlug);
      setProject(p);
      // Sprint metadata for the header. We use the sprint list (cheap)
      // rather than minting a per-sprint GET endpoint.
      const sprints = await sprintsApi.listForProject(p.id);
      const found = sprints.find((s) => s.id === sprintId);
      if (!found) {
        setError('Sprint not found.');
        return;
      }
      setSprint(found);
      try {
        const r = await sprintsApi.getRetro(sprintId);
        setRetro(r);
      } catch (err) {
        if (err.response?.status === 404) setRetro(null);
        else throw err;
      }
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not load the retrospective.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, projectSlug, sprintId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    if (!sprint) return;
    setGenerating(true);
    try {
      const r = await sprintsApi.generateRetro(sprint.id);
      setRetro(r);
      toast.show({ tone: 'success', message: 'Retro generated.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not generate retrospective.',
      });
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate() {
    if (!sprint) return;
    const ok = await confirm({
      title: 'Regenerate retrospective?',
      message: 'This replaces the current content. Edits and applied-draft status are lost. The original AI response stays in the audit log.',
      confirmLabel: 'Regenerate',
    });
    if (!ok) return;
    await generate();
  }

  async function commitField(key) {
    if (!retro) return;
    if (drafts[key] === (retro[key] ?? '')) return;
    try {
      const updated = await sprintsApi.updateRetro(sprint.id, { [key]: drafts[key] });
      // The update endpoint returns the entity without re-hydrated draft
      // picks; keep the existing nextSprintDraft so the page doesn't
      // wipe its task table on every save.
      setRetro((cur) => ({ ...updated, nextSprintDraft: cur?.nextSprintDraft ?? null }));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not save edit.',
      });
      setDrafts((d) => ({ ...d, [key]: retro[key] ?? '' }));
    }
  }

  async function applyDraft() {
    if (!retro?.nextSprintDraft || retro.appliedAt) return;
    setApplying(true);
    try {
      const newSprint = await sprintsApi.applyNextSprintDraft(sprint.id);
      toast.show({
        tone: 'success',
        message: `Created ${newSprint.name} with ${retro.nextSprintDraft.tasks.length} task${retro.nextSprintDraft.tasks.length === 1 ? '' : 's'}.`,
      });
      navigate(`/${orgSlug}/projects/${projectSlug}/sprints/${newSprint.id}`);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not apply draft.',
      });
    } finally {
      setApplying(false);
    }
  }

  const totalDraftPoints = useMemo(
    () => (retro?.nextSprintDraft?.tasks ?? []).reduce((s, t) => s + (t.points ?? 0), 0),
    [retro],
  );

  if (loading) {
    return (
      <div className="main-inner sprint-retro">
        <Skeleton height={120} />
        <Skeleton height={280} radius="lg" />
      </div>
    );
  }
  if (error) {
    return <div className="main-inner"><p className="muted">{error}</p></div>;
  }

  return (
    <div className="main-inner sprint-retro">
      {dialog}

      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">
              <Link className="sprint-retro-crumb" to={`/${orgSlug}/projects/${projectSlug}/sprints/${sprint.id}`}>
                {project?.name ?? 'Project'} · {sprint?.name}
              </Link>
            </div>
            <h1 className="page-title sprint-retro-title">
              Retrospective
              {retro?.appliedAt && (
                <span className="status status-done">Applied</span>
              )}
            </h1>
            <div className="page-subtitle">
              {retro
                ? `Generated ${formatAgo(retro.generatedAt)} by AI — edit any section in place.`
                : 'Generate a retro to capture what happened and seed the next sprint.'}
            </div>
          </div>
          <div className="row gap-3">
            {retro && (
              <Button variant="ghost" onClick={regenerate} disabled={generating}>
                <RefreshCw size={14} aria-hidden="true" />
                {generating ? ' Regenerating…' : ' Regenerate'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!retro ? (
        <section className="card sprint-retro-empty">
          <span className="sprint-retro-empty-icon" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <h2 className="sprint-retro-empty-title">No retrospective yet</h2>
          <p className="sprint-retro-empty-text">
            Closing the sprint auto-generates one when AI is on. You can also
            kick one off now.
          </p>
          <Button variant="ai" onClick={generate} disabled={generating}>
            <Sparkles size={14} aria-hidden="true" />
            {generating ? ' Generating…' : ' Generate retrospective'}
          </Button>
        </section>
      ) : (
        <>
          <div className="sprint-retro-sections">
            {SECTIONS.map(({ key, label, Icon, tone }) => {
              const fieldId = `retro-${key}`;
              return (
                <section key={key} className={`card sprint-retro-section is-${tone}`}>
                  <div className="sprint-retro-section-head">
                    <span className="sprint-retro-section-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <label htmlFor={fieldId} className="sprint-retro-section-title">{label}</label>
                  </div>
                  <textarea
                    id={fieldId}
                    className="sprint-retro-textarea"
                    value={drafts[key]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    onBlur={() => commitField(key)}
                    rows={key === 'summary' ? 4 : 3}
                    placeholder={`AI couldn't say much about "${label.toLowerCase()}".`}
                  />
                </section>
              );
            })}
          </div>

          {retro.nextSprintDraft && (
            <section className="card sprint-retro-draft">
              <div className="sprint-retro-draft-head">
                <div>
                  <div className="eyebrow">Next sprint draft</div>
                  <h2 className="sprint-retro-draft-name">{retro.nextSprintDraft.name}</h2>
                  {retro.nextSprintDraft.goal && (
                    <p className="sprint-retro-draft-goal">
                      Goal: {retro.nextSprintDraft.goal}
                    </p>
                  )}
                </div>
                <div className="sprint-retro-draft-actions">
                  <span className="sprint-retro-draft-count">
                    {retro.nextSprintDraft.tasks.length} task{retro.nextSprintDraft.tasks.length === 1 ? '' : 's'} · {totalDraftPoints} pts
                  </span>
                  {retro.appliedAt ? (
                    <Link to={`/${orgSlug}/projects/${projectSlug}/sprints/${retro.appliedSprintId}`}>
                      <Button variant="ghost">
                        <CornerUpRight size={13} aria-hidden="true" /> Open new sprint
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={applyDraft}
                      disabled={applying || retro.nextSprintDraft.tasks.length === 0}
                    >
                      <Check size={14} aria-hidden="true" />
                      {applying ? ' Applying…' : ' Apply next sprint draft'}
                    </Button>
                  )}
                </div>
              </div>

              {retro.nextSprintDraft.tasks.length === 0 ? (
                <p className="sprint-retro-muted">No backlog candidates were strong enough to seed a draft.</p>
              ) : (
                <ul className="sprint-retro-pick-list">
                  {retro.nextSprintDraft.tasks.map((pick) => (
                    <li key={pick.taskId} className="sprint-retro-pick">
                      <span className="sprint-retro-pick-key">{pick.key}</span>
                      <span className="sprint-retro-pick-title truncate">{pick.title}</span>
                      <span className="sprint-retro-pick-points">{pick.points} pts</span>
                      {pick.reasoning && (
                        <span className="sprint-retro-pick-reason truncate" title={pick.reasoning}>{pick.reasoning}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function formatAgo(iso) {
  if (!iso) return 'just now';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
