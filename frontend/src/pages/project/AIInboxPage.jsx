import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AISuggestionCard, Button, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from '@/components/ai/aiErrors';
import './AIInboxPage.css';

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

  if (error) return <p className="ai-inbox__placeholder">{error}</p>;

  return (
    <div className="page ai-inbox">
      <header className="ai-inbox__header">
        <div>
          <h1 className="ai-inbox__title">
            <Sparkles size={16} color="var(--ai-violet)" aria-hidden="true" />
            AI Inbox
          </h1>
          <p className="ai-inbox__subtitle">
            Durable AI insights for {project?.name ?? 'this project'}. Accept what's useful, dismiss the rest.
          </p>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <label className="ai-inbox__toggle">
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
      </header>

      {loading ? (
        <p className="ai-inbox__placeholder">Loading…</p>
      ) : suggestions.length === 0 ? (
        <div className="ai-inbox__empty">
          <Sparkles size={20} color="var(--ai-violet)" aria-hidden="true" />
          <p className="ai-inbox__empty-title">No open insights</p>
          <p className="ai-inbox__empty-sub">
            Try diagnosing the active sprint to see what AI surfaces.
          </p>
        </div>
      ) : (
        <ul className="ai-inbox__list">
          {suggestions.map((s) => {
            const opts = parseOptions(s.payloadJson);
            const acted = s.status !== 'Open';
            return (
              <li key={s.id} className="ai-inbox__row">
                <AISuggestionCard
                  chipLabel="AI insight"
                  scope={timeAgo(s.createdAt)}
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
