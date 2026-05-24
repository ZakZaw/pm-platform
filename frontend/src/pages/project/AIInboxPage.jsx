import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AISuggestionCard, Badge, Button, Segmented, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from '@/components/ai/aiErrors';
import { findProjectType } from '@/constants/projectTypes';
import './AIInboxPage.css';

// F1.5-08 — colour tokens per project type for inbox card chips. Reuses
// the status-* / accent-* tone families so the chips are theme-aware.
const TYPE_TONE = {
  Engineering: 'info',
  Sales: 'purple',
  Support: 'danger',
  Marketing: 'success',
  Operations: 'warning',
  Generic: 'neutral',
};

// Suggestion kind → category for the second filter chip row. New
// generators register a new prefix here; everything else groups as "Other".
function categoryForKind(kind) {
  if (!kind) return 'Other';
  const k = kind.toLowerCase();
  if (k.startsWith('sprint.')) return 'Sprint';
  if (k.startsWith('support.')) return 'Support';
  if (k.startsWith('sales.')) return 'Sales';
  if (k.startsWith('marketing.')) return 'Marketing';
  if (k.startsWith('operations.')) return 'Operations';
  if (k.startsWith('task.')) return 'Task';
  return 'Other';
}

/**
 * AI Inbox — open AI suggestions for the current project.
 *
 * Phase 1 surfaces ONE generator (sprint health on the active sprint).
 * As more durable insights land, they'll write into the same table and
 * render through the same AISuggestionCard primitive.
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

  async function dismiss(suggestion) {
    try {
      await aiApi.dismissSuggestion(suggestion.id);
      setSuggestions((cur) => cur.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not dismiss.',
      });
    }
  }

  async function accept(suggestion) {
    try {
      await aiApi.acceptSuggestion(suggestion.id);
      setSuggestions((cur) => cur.filter((s) => s.id !== suggestion.id));
      toast.show({ tone: 'success', message: 'Suggestion accepted.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not accept.',
      });
    }
  }

  function parseOptions(payloadJson) {
    if (!payloadJson) return [];
    try {
      const obj = JSON.parse(payloadJson);
      return Array.isArray(obj?.options) ? obj.options : [];
    } catch {
      return [];
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
    for (const s of suggestions) set.add(categoryForKind(s.kind));
    return Array.from(set);
  }, [suggestions]);

  const filtered = useMemo(() => suggestions.filter((s) => {
    if (activeTypeFilter !== 'All' && s.projectType !== activeTypeFilter) return false;
    if (activeCategoryFilter !== 'All' && categoryForKind(s.kind) !== activeCategoryFilter) return false;
    return true;
  }), [suggestions, activeTypeFilter, activeCategoryFilter]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner ai-inbox">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project?.name ?? 'Project'}</div>
            <h1 className="page-title row gap-3">
              <Sparkles size={18} color="var(--ai-violet)" aria-hidden="true" />
              AI Inbox
            </h1>
            <div className="page-subtitle">
              Durable AI insights for {project?.name ?? 'this project'}. Accept what's useful, dismiss the rest.
            </div>
          </div>
          <div className="row gap-3">
            <label className="ai-inbox-toggle">
              <input
                type="checkbox"
                checked={includeActed}
                onChange={(e) => setIncludeActed(e.target.checked)}
              />
              Show acted-on
            </label>
            <Button variant="ai" onClick={generateSprintHealth} disabled={generating}>
              <Sparkles size={13} aria-hidden="true" />
              {generating ? ' Asking…' : ' Diagnose active sprint'}
            </Button>
          </div>
        </div>
      </div>

      {!loading && suggestions.length > 0 && categoriesPresent.length > 1 && (
        <div className="row gap-3" style={{ marginBottom: 'var(--s-6)' }}>
          <Segmented
            value={activeCategoryFilter}
            onChange={setActiveCategoryFilter}
            options={[
              { value: 'All', label: 'All', count: suggestions.length },
              ...categoriesPresent.map((c) => ({
                value: c,
                label: c,
                count: suggestions.filter((s) => categoryForKind(s.kind) === c).length,
              })),
            ]}
            ariaLabel="Filter by suggestion category"
          />
          <div style={{ flex: 1 }} />
          {typesPresent.length > 1 && (
            <Segmented
              value={activeTypeFilter}
              onChange={setActiveTypeFilter}
              options={[
                { value: 'All', label: 'All types' },
                ...typesPresent.map((t) => ({ value: t, label: findProjectType(t)?.short ?? t })),
              ]}
              size="sm"
              ariaLabel="Filter by project type"
            />
          )}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : suggestions.length === 0 ? (
        <div className="ai-inbox-empty">
          <Sparkles size={20} color="var(--ai-violet)" aria-hidden="true" />
          <p className="ai-inbox-empty-title">No open insights</p>
          <p className="ai-inbox-empty-sub">
            Try diagnosing the active sprint to see what AI surfaces.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="muted">No insights match these filters.</p>
      ) : (
        <ul className="ai-inbox-list">
          {filtered.map((s) => {
            const opts = parseOptions(s.payloadJson);
            const acted = s.status !== 'Open';
            const typeMeta = findProjectType(s.projectType);
            const TypeIcon = typeMeta?.icon;
            return (
              <li key={s.id} className="ai-inbox-row">
                <AISuggestionCard
                  chipLabel={
                    <span className="row" style={{ gap: 4 }}>
                      {TypeIcon && <TypeIcon size={11} aria-hidden="true" />}
                      <span>{typeMeta?.label ?? 'AI insight'}</span>
                    </span>
                  }
                  scope={
                    <span className="row" style={{ gap: 6 }}>
                      <Badge tone={TYPE_TONE[s.projectType] ?? 'neutral'}>
                        {categoryForKind(s.kind)}
                      </Badge>
                      <span>{timeAgo(s.createdAt)}</span>
                    </span>
                  }
                  title={s.title}
                  body={s.body}
                  options={opts}
                  footer={`From ${s.provider}${acted ? ` · ${s.status}` : ''}`}
                  onDismiss={acted ? undefined : () => dismiss(s)}
                  onApply={acted ? undefined : () => accept(s)}
                  applyLabel="Mark as accepted"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
