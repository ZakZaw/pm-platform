import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button, EmptyState, Segmented, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from '@/components/ai/aiErrors';
import { SuggestionListItem } from '@/components/ai/SuggestionListItem';
import { suggestionCategory, suggestionTypeMeta } from '@/components/ai/suggestionTypes';
import { useSuggestionActions } from '@/hooks/useSuggestionActions';
import './AIInboxPage.css';

/**
 * AI Inbox — open AI suggestions for the current project.
 *
 * Every durable insight (sprint health, replan, reassignment, blocked
 * cascade, SLA breach…) writes into the same table and renders through the
 * shared, type-aware SuggestionListItem. The org-wide union lives on
 * OrgAIInboxPage.
 */
export function AIInboxPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [includeActed, setIncludeActed] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState('All');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');

  const refresh = useCallback(
    async (projectId, includeAll) => {
      const list = await aiApi.listSuggestions(projectId, {
        includeActed: includeAll,
      });
      setSuggestions(list);
    },
    [],
  );

  const removeCard = useCallback(
    (s) => setSuggestions((cur) => cur.filter((x) => x.id !== s.id)),
    [],
  );
  const actions = useSuggestionActions(removeCard);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id, includeActed);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail ?? 'Could not load suggestions.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug, includeActed, refresh]);

  async function generateSprintHealth() {
    if (!project) return;
    setGenerating(true);
    try {
      await aiApi.generateSprintHealth(project.id);
      await refresh(project.id, includeActed);
      toast.show({ tone: 'success', message: 'New AI insight added.' });
    } catch (err) {
      const status = err?.response?.status;
      const title = err?.response?.data?.title;
      if (status === 422 && title === 'AI.EmptyResult') {
        toast.show({
          tone: 'info',
          message: 'No active sprint to diagnose — start a sprint first.',
        });
      } else {
        toast.show({
          tone: 'danger',
          message: describeAiError(err, 'Could not generate insight.'),
        });
      }
    } finally {
      setGenerating(false);
    }
  }

  // Filter chips derived from the current suggestion set so we don't
  // show chips that wouldn't match anything.
  const typesPresent = useMemo(() => {
    const set = new Set();
    for (const s of suggestions) if (s.projectType) set.add(s.projectType);
    return Array.from(set);
  }, [suggestions]);
  const categoriesPresent = useMemo(() => {
    const set = new Set();
    for (const s of suggestions) set.add(suggestionCategory(s));
    return Array.from(set);
  }, [suggestions]);

  const filtered = useMemo(() => suggestions.filter((s) => {
    if (activeTypeFilter !== 'All' && s.projectType !== activeTypeFilter) return false;
    if (activeCategoryFilter !== 'All' && suggestionCategory(s) !== activeCategoryFilter) return false;
    return true;
  }), [suggestions, activeTypeFilter, activeCategoryFilter]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner ai-inbox">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">{project?.name ?? 'Project'}</div>
            <h1 className="page-title">AI Inbox</h1>
            <p className="page-subtitle">
              Durable AI insights for {project?.name ?? 'this project'}. Accept what's useful, dismiss the rest.
              {project?.aiControlMode && (
                <>
                  {' '}
                  <AiModeLink mode={project.aiControlMode} orgSlug={orgSlug} projectSlug={projectSlug} />
                </>
              )}
            </p>
          </div>
          <Button variant="primary" onClick={generateSprintHealth} disabled={generating}>
            <Sparkles size={13} aria-hidden="true" />
            {generating ? ' Asking…' : ' Diagnose active sprint'}
          </Button>
        </div>
      </div>

      {!loading && (
        <div className="ai-inbox-toolbar">
          {suggestions.length > 0 && categoriesPresent.length > 1 && (
            <Segmented
              value={activeCategoryFilter}
              onChange={setActiveCategoryFilter}
              options={[
                { value: 'All', label: 'All', count: suggestions.length },
                ...categoriesPresent.map((c) => ({
                  value: c,
                  label: c,
                  count: suggestions.filter((s) => suggestionCategory(s) === c).length,
                })),
              ]}
              ariaLabel="Filter by suggestion category"
            />
          )}
          <div className="fill" />
          {suggestions.length > 0 && typesPresent.length > 1 && (
            <Segmented
              value={activeTypeFilter}
              onChange={setActiveTypeFilter}
              options={[
                { value: 'All', label: 'All types' },
                ...typesPresent.map((t) => ({ value: t, label: suggestionTypeMeta(t).short })),
              ]}
              size="sm"
              ariaLabel="Filter by project type"
            />
          )}
          <Segmented
            value={includeActed ? 'all' : 'open'}
            onChange={(v) => setIncludeActed(v === 'all')}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'all', label: 'Show acted-on' },
            ]}
            size="sm"
            ariaLabel="Show acted-on suggestions"
          />
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : suggestions.length === 0 ? (
        <EmptyState
          className="card ai-inbox-empty"
          icon={<Sparkles size={20} aria-hidden="true" />}
          title="No open insights"
          subtitle="Try diagnosing the active sprint to see what AI surfaces."
        />
      ) : filtered.length === 0 ? (
        <p className="muted">No insights match these filters.</p>
      ) : (
        <ul className="ai-inbox-list">
          {filtered.map((s) => (
            <SuggestionListItem
              key={s.id}
              suggestion={s}
              onDismiss={() => actions.dismiss(s)}
              onAccept={() => actions.accept(s)}
              onApplyReplan={(opt) => actions.applyReplan(s, opt)}
              onApplyReassignments={(picks) => actions.applyReassignments(s, picks)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// F2-08 — the project's AI control mode, surfaced in the inbox header as a
// dot + text link to the settings page so PMs can flip it from where they see
// suggestions.
const MODE_PRESENTATION = {
  Off:        { tone: 'neutral', label: 'AI off' },
  AskMeFirst: { tone: 'warning', label: 'Ask me first' },
  Suggest:    { tone: 'info',    label: 'Suggest' },
  Autopilot:  { tone: 'violet',  label: 'Autopilot' },
};

function AiModeLink({ mode, orgSlug, projectSlug }) {
  const pres = MODE_PRESENTATION[mode] ?? MODE_PRESENTATION.Suggest;
  return (
    <Link
      to={`/${orgSlug}/projects/${projectSlug}/settings/ai`}
      className={`ai-inbox-mode is-${pres.tone}`}
      title="Change AI mode in project settings"
    >
      Mode: {pres.label}
    </Link>
  );
}
