import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { EmptyState, Segmented } from '@/components/ui';
import { aiApi } from '@/api/ai.api';
import { SuggestionListItem } from '@/components/ai/SuggestionListItem';
import { SuggestionTypeBadge } from '@/components/ai/SuggestionTypeBadge';
import { suggestionCategory, suggestionTypeMeta } from '@/components/ai/suggestionTypes';
import { useSuggestionActions } from '@/hooks/useSuggestionActions';
import '@/pages/project/AIInboxPage.css';
import './OrgAIInboxPage.css';

/**
 * F1.5-08 — org-level AI inbox. The union of every suggestion variant across
 * the caller's projects, grouped by project type server-side
 * (GET /orgs/{slug}/ai/suggestions). Each card is tagged with its project
 * type's icon + tone and its server-derived category; filter chips narrow by
 * type and category. No per-type branching here — presentation comes from
 * the suggestionTypes registry, so a new project type needs zero changes.
 */
export function OrgAIInboxPage() {
  const { slug } = useParams();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [includeActed, setIncludeActed] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const inbox = await aiApi.listOrgSuggestions(slug, { includeActed });
        if (!cancelled) setGroups(inbox?.groups ?? []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load suggestions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, includeActed]);

  const removeCard = useCallback((s) => {
    setGroups((cur) => cur
      .map((g) => ({ ...g, suggestions: g.suggestions.filter((x) => x.suggestion.id !== s.id) }))
      .filter((g) => g.suggestions.length > 0));
  }, []);
  const actions = useSuggestionActions(removeCard);

  const all = useMemo(() => groups.flatMap((g) => g.suggestions), [groups]);
  const categories = useMemo(
    () => Array.from(new Set(all.map((x) => suggestionCategory(x.suggestion)))),
    [all],
  );

  const visibleGroups = useMemo(() => groups
    .filter((g) => typeFilter === 'All' || g.projectType === typeFilter)
    .map((g) => ({
      ...g,
      suggestions: g.suggestions.filter((x) =>
        categoryFilter === 'All' || suggestionCategory(x.suggestion) === categoryFilter),
    }))
    .filter((g) => g.suggestions.length > 0), [groups, typeFilter, categoryFilter]);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner ai-inbox">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">Organisation</div>
            <h1 className="page-title">AI Inbox</h1>
            <p className="page-subtitle">
              Every open AI insight across your projects, grouped by project type.
            </p>
          </div>
        </div>
      </div>

      {!loading && (
        <div className="ai-inbox-toolbar">
          {groups.length > 1 && (
            <Segmented
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'All', label: 'All types', count: all.length },
                ...groups.map((g) => ({
                  value: g.projectType,
                  label: suggestionTypeMeta(g.projectType).short,
                  count: g.suggestions.length,
                })),
              ]}
              ariaLabel="Filter by project type"
            />
          )}
          <div className="fill" />
          {categories.length > 1 && (
            <Segmented
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: 'All', label: 'All' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
              size="sm"
              ariaLabel="Filter by suggestion category"
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
      ) : all.length === 0 ? (
        <EmptyState
          className="card ai-inbox-empty"
          icon={<Sparkles size={20} aria-hidden="true" />}
          title="No open insights"
          subtitle="AI suggestions from every project you can see will collect here."
        />
      ) : visibleGroups.length === 0 ? (
        <p className="muted">No insights match these filters.</p>
      ) : (
        <div className="org-ai-inbox-groups">
          {visibleGroups.map((g) => (
            <section key={g.projectType} className="org-ai-inbox-group" aria-label={`${g.projectType} suggestions`}>
              <div className="org-ai-inbox-group-head">
                <SuggestionTypeBadge projectType={g.projectType} size="md" />
                <span className="muted">{g.suggestions.length}</span>
              </div>
              <ul className="ai-inbox-list">
                {g.suggestions.map(({ suggestion: s, projectName }) => (
                  <SuggestionListItem
                    key={s.id}
                    suggestion={s}
                    projectName={projectName}
                    onDismiss={() => actions.dismiss(s)}
                    onAccept={() => actions.accept(s)}
                    onApplyReplan={(opt) => actions.applyReplan(s, opt)}
                    onApplyReassignments={(picks) => actions.applyReassignments(s, picks)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
