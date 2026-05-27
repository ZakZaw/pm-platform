import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eye, Power, ShieldQuestion, Sparkles } from 'lucide-react';
import { AISuggestionCard, Badge, Button, Segmented, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from '@/components/ai/aiErrors';
import { findProjectType } from '@/constants/projectTypes';
import './AIInboxPage.css';

// F2-12 — short labels for the three replan options, surfaced both in
// the option list and the success toast on apply.
const REPLAN_OPTION_LABELS = {
  CutScope: 'Cut scope',
  AddResource: 'Add resource',
  ShiftMilestone: 'Shift milestone',
};

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

  // F2-12 — apply one of the three replan options. On success, drop the
  // card from the open list (it flips to Accepted server-side).
  async function applyReplan(suggestion, optionKey) {
    try {
      await aiApi.applyVelocityReplan(suggestion.id, optionKey);
      setSuggestions((cur) => cur.filter((s) => s.id !== suggestion.id));
      toast.show({
        tone: 'success',
        message: `Applied ${REPLAN_OPTION_LABELS[optionKey] ?? 'replan'}.`,
      });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: describeAiError(err, 'Could not apply replan.'),
      });
    }
  }

  // F2-13 — bulk-accept (picks = []) or override per row. Server
  // normalises an empty picks array to "use defaults".
  async function applyReassignments(suggestion, picks) {
    try {
      const updated = await aiApi.applyReassignments(suggestion.id,
        picks && picks.length > 0 ? picks : null);
      setSuggestions((cur) => cur.filter((s) => s.id !== suggestion.id));
      toast.show({
        tone: 'success',
        message: `Reassigned ${picks?.length ? `${picks.length} task${picks.length === 1 ? '' : 's'}` : 'tasks'}.`,
      });
      return updated;
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: describeAiError(err, 'Could not apply reassignments.'),
      });
      throw err;
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
              <Sparkles size={18} color="var(--ai-2)" aria-hidden="true" />
              AI Inbox
              {project?.aiControlMode && (
                <AiModeChip mode={project.aiControlMode} orgSlug={orgSlug} projectSlug={projectSlug} />
              )}
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
          <Sparkles size={20} color="var(--ai-2)" aria-hidden="true" />
          <p className="ai-inbox-empty-title">No open insights</p>
          <p className="ai-inbox-empty-sub">
            Try diagnosing the active sprint to see what AI surfaces.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="muted">No insights match these filters.</p>
      ) : (
        <ul className="ai-inbox-list">
          {filtered.map((s) => (
            <SuggestionListItem
              key={s.id}
              suggestion={s}
              onDismiss={() => dismiss(s)}
              onAccept={() => accept(s)}
              onApplyReplan={(opt) => applyReplan(s, opt)}
              onApplyReassignments={(picks) => applyReassignments(s, picks)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// Single inbox row. Holds the option-selection state locally so picking
// a replan option on card A doesn't accidentally light up card B.
function SuggestionListItem({
  suggestion, onDismiss, onAccept, onApplyReplan, onApplyReassignments,
}) {
  const acted = suggestion.status !== 'Open';
  const typeMeta = findProjectType(suggestion.projectType);
  const TypeIcon = typeMeta?.icon;
  const isReplan = suggestion.kind === 'sprint.replan';
  const isReassign = suggestion.kind === 'member.unavailable';
  const replan = useMemo(
    () => (isReplan ? parseReplanPayload(suggestion.payloadJson) : null),
    [isReplan, suggestion.payloadJson],
  );
  const reassign = useMemo(
    () => (isReassign ? parseReassignmentPayload(suggestion.payloadJson) : null),
    [isReassign, suggestion.payloadJson],
  );
  const fallbackOpts = useMemo(
    () => (isReplan || isReassign ? [] : parseGenericOptions(suggestion.payloadJson)),
    [isReplan, isReassign, suggestion.payloadJson],
  );

  const [selectedIdx, setSelectedIdx] = useState(() => {
    if (!isReplan || !replan) return undefined;
    const recIdx = replan.options.findIndex((o) => o.recommended);
    return recIdx >= 0 ? recIdx : (replan.options.length > 0 ? 0 : undefined);
  });
  const [applying, setApplying] = useState(false);

  // F2-13 — assignee selection per task, initialised to the top
  // candidate (the bulk-accept default).
  const [picks, setPicks] = useState(() => {
    if (!isReassign || !reassign) return {};
    const init = {};
    for (const t of reassign.tasks) {
      const top = t.candidates[0];
      if (top) init[t.taskId] = top.userId;
    }
    return init;
  });

  const opts = isReplan
    ? replan?.options.map((o) => ({ label: o.label, recommended: o.recommended })) ?? []
    : fallbackOpts;

  const onApply = acted
    ? undefined
    : isReplan
      ? async () => {
          if (selectedIdx == null || !replan) return;
          const choice = replan.options[selectedIdx];
          if (!choice) return;
          setApplying(true);
          try {
            await onApplyReplan(choice.key);
          } finally {
            setApplying(false);
          }
        }
      : isReassign
        ? async () => {
            if (!reassign) return;
            // If every row still points at the default top candidate,
            // send an empty pick list and let the server use defaults
            // ("bulk accept"). Otherwise send the explicit overrides.
            const overrides = reassign.tasks
              .map((t) => {
                const chosen = picks[t.taskId];
                const top = t.candidates[0]?.userId;
                return chosen && chosen !== top
                  ? { taskId: t.taskId, newAssigneeId: chosen }
                  : null;
              })
              .filter(Boolean);
            setApplying(true);
            try {
              await onApplyReassignments(overrides);
            } finally {
              setApplying(false);
            }
          }
        : onAccept;

  const applyLabel = isReplan
    ? selectedIdx != null && replan?.options[selectedIdx]
      ? `Apply: ${REPLAN_OPTION_LABELS[replan.options[selectedIdx].key]}`
      : 'Apply'
    : isReassign
      ? 'Apply reassignments'
      : 'Mark as accepted';

  return (
    <li className="ai-inbox-row">
      <AISuggestionCard
        chipLabel={
          <span className="row" style={{ gap: 4 }}>
            {TypeIcon && <TypeIcon size={11} aria-hidden="true" />}
            <span>{typeMeta?.label ?? 'AI insight'}</span>
          </span>
        }
        scope={
          <span className="row" style={{ gap: 6 }}>
            <Badge tone={TYPE_TONE[suggestion.projectType] ?? 'neutral'}>
              {categoryForKind(suggestion.kind)}
            </Badge>
            <span>{timeAgo(suggestion.createdAt)}</span>
          </span>
        }
        title={suggestion.title}
        body={
          isReassign && reassign ? (
            <>
              <div>{suggestion.body}</div>
              <ReassignmentBlock
                reassign={reassign}
                picks={picks}
                onChange={(taskId, userId) =>
                  setPicks((cur) => ({ ...cur, [taskId]: userId }))}
                disabled={applying || acted}
              />
            </>
          ) : (
            suggestion.body
          )
        }
        options={opts}
        selectedOptionIndex={isReplan ? selectedIdx : undefined}
        onSelect={isReplan ? setSelectedIdx : undefined}
        footer={`From ${suggestion.provider}${acted ? ` · ${suggestion.status}` : ''}`}
        onDismiss={acted ? undefined : onDismiss}
        onApply={onApply}
        applyLabel={applyLabel}
        applyDisabled={
          (isReplan && selectedIdx == null)
          || (isReassign && (!reassign || reassign.tasks.length === 0))
        }
        loading={applying}
      />
    </li>
  );
}

// F2-13 — table of (task → suggested assignee) rows. Defaulted to the
// top candidate; the PM can drop down to override per row before
// pressing Apply.
function ReassignmentBlock({ reassign, picks, onChange, disabled }) {
  if (!reassign || reassign.tasks.length === 0) return null;
  return (
    <div className="reassign-block">
      {reassign.tasks.map((t) => {
        const chosen = picks[t.taskId] ?? t.candidates[0]?.userId ?? '';
        const chosenCand = t.candidates.find((c) => c.userId === chosen);
        return (
          <div key={t.taskId} className="reassign-row">
            <div>
              <div className="reassign-task-key">{t.key}</div>
              <div className="reassign-task-title">{t.title}</div>
            </div>
            <select
              className="reassign-select"
              value={chosen}
              disabled={disabled}
              onChange={(e) => onChange(t.taskId, e.target.value)}
              aria-label={`Reassignee for ${t.key}`}
            >
              {t.candidates.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.fullName} — fit {Math.round(c.score * 100)}%
                </option>
              ))}
            </select>
            <span className="reassign-score">
              {chosenCand
                ? `skill ${Math.round(chosenCand.skillMatch * 100)} · cap ${Math.round(chosenCand.capacityHeadroom * 100)} · hist ${Math.round(chosenCand.historyFit * 100)}`
                : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// F2-13 — parses the member.unavailable payload into a render-friendly
// shape. Defensive on every nested array — any missing field collapses
// to a usable default rather than throwing.
function parseReassignmentPayload(payloadJson) {
  if (!payloadJson) return null;
  let obj;
  try { obj = JSON.parse(payloadJson); }
  catch { return null; }

  const tasks = Array.isArray(obj?.tasks) ? obj.tasks : [];
  return {
    trigger: obj?.trigger ?? null,
    leavingUserId: obj?.leavingUserId ?? null,
    leavingUserName: obj?.leavingUserName ?? null,
    tasks: tasks.map((t) => ({
      taskId: t.taskId,
      key: t.key ?? '',
      title: t.title ?? '',
      priority: t.priority,
      candidates: (Array.isArray(t.candidates) ? t.candidates : []).map((c) => ({
        userId: c.userId,
        fullName: c.fullName ?? 'Unnamed',
        score: typeof c.score === 'number' ? c.score : 0,
        skillMatch: typeof c.skillMatch === 'number' ? c.skillMatch : 0,
        capacityHeadroom: typeof c.capacityHeadroom === 'number' ? c.capacityHeadroom : 0,
        historyFit: typeof c.historyFit === 'number' ? c.historyFit : 0,
      })),
    })).filter((t) => t.candidates.length > 0),
  };
}

// Generic non-replan suggestions store `options` as an array of `{ label,
// recommended }` directly in the payload — matches the sprint.health shape.
function parseGenericOptions(payloadJson) {
  if (!payloadJson) return [];
  try {
    const obj = JSON.parse(payloadJson);
    return Array.isArray(obj?.options) ? obj.options : [];
  } catch {
    return [];
  }
}

// F2-12 — flatten the cutScope / addResource / shiftMilestone tuple into
// a single `options` list the AISuggestionCard can render. The first
// non-null option is the default selection; "cut scope" is marked
// recommended when it has concrete points to drop.
function parseReplanPayload(payloadJson) {
  if (!payloadJson) return null;
  let obj;
  try { obj = JSON.parse(payloadJson); }
  catch { return null; }

  const options = [];
  if (obj?.cutScope) {
    const tasks = Array.isArray(obj.cutScope.tasks) ? obj.cutScope.tasks : [];
    const taskKeys = tasks.map((t) => t.key).filter(Boolean).slice(0, 3).join(', ');
    const tail = tasks.length > 3 ? ` +${tasks.length - 3} more` : '';
    const detail = taskKeys ? ` (${taskKeys}${tail})` : '';
    options.push({
      key: 'CutScope',
      label: `Cut scope — drop ${obj.cutScope.pointsCut ?? 0}pt${detail} · ~${obj.cutScope.daysSaved ?? 0}d saved`,
      recommended: (obj.cutScope.pointsCut ?? 0) > 0,
      summary: obj.cutScope.summary,
    });
  }
  if (obj?.addResource) {
    const who = obj.addResource.memberName ?? 'a free teammate';
    const tasks = Array.isArray(obj.addResource.tasks) ? obj.addResource.tasks : [];
    const detail = tasks.length > 0 ? ` (${tasks.length} task${tasks.length === 1 ? '' : 's'})` : '';
    options.push({
      key: 'AddResource',
      label: `Add resource — reassign to ${who}${detail} · ~${obj.addResource.daysSaved ?? 0}d saved`,
      recommended: false,
      summary: obj.addResource.summary,
    });
  }
  if (obj?.shiftMilestone) {
    const name = obj.shiftMilestone.milestoneTitle ?? 'milestone';
    options.push({
      key: 'ShiftMilestone',
      label: `Shift milestone "${name}" by ${obj.shiftMilestone.shiftDays ?? 0} days`,
      recommended: false,
      summary: obj.shiftMilestone.summary,
    });
  }
  return { projection: obj?.projection, options };
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

// F2-08 — small chip surfacing the project's AI control mode in the inbox
// header. Doubles as a deep-link to the settings page so PMs can flip it
// from where they see suggestions.
const MODE_PRESENTATION = {
  Off:        { tone: 'neutral', Icon: Power,          label: 'AI off' },
  AskMeFirst: { tone: 'warning', Icon: ShieldQuestion, label: 'Ask me first' },
  Suggest:    { tone: 'info',    Icon: Eye,            label: 'Suggest' },
  Autopilot:  { tone: 'purple',  Icon: Sparkles,       label: 'Autopilot' },
};

function AiModeChip({ mode, orgSlug, projectSlug }) {
  const pres = MODE_PRESENTATION[mode] ?? MODE_PRESENTATION.Suggest;
  const Icon = pres.Icon;
  return (
    <Link
      to={`/${orgSlug}/projects/${projectSlug}/settings/ai`}
      className="ai-inbox-mode-chip"
      title="Change AI mode in project settings"
    >
      <Badge tone={pres.tone}>
        <Icon size={10} aria-hidden="true" /> {pres.label}
      </Badge>
    </Link>
  );
}
