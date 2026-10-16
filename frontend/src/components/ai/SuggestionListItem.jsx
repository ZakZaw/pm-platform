import { useMemo, useState } from 'react';
import { AISuggestionCard } from '@/components/ui';
import { SuggestionTypeBadge } from './SuggestionTypeBadge';
import { REPLAN_OPTION_LABELS, suggestionCategory, suggestionTypeMeta } from './suggestionTypes';
import './SuggestionList.css';

/**
 * One AI-inbox row, shared by the project inbox and the org inbox (F1.5-08).
 * Renders the type-aware AISuggestionCard variant — tone + type badge come
 * from the suggestionTypes registry, keyed by `suggestion.projectType` — and
 * holds the option-selection state locally so picking a replan option on
 * card A doesn't light up card B.
 *
 * @param {{
 *   suggestion: object,
 *   projectName?: string,
 *   onDismiss: () => void,
 *   onAccept: () => void,
 *   onApplyReplan: (optionKey: string) => Promise<void>,
 *   onApplyReassignments: (picks: Array<object>) => Promise<unknown>,
 * }} props
 */
export function SuggestionListItem({
  suggestion, projectName, onDismiss, onAccept, onApplyReplan, onApplyReassignments,
}) {
  const acted = suggestion.status !== 'Open';
  const typeMeta = suggestionTypeMeta(suggestion.projectType);
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

  const scope = [projectName, timeAgo(suggestion.createdAt)].filter(Boolean).join(' · ');

  return (
    <li className="ai-inbox-row">
      <AISuggestionCard
        chipLabel={suggestionCategory(suggestion)}
        badge={<SuggestionTypeBadge projectType={typeMeta.id} label={typeMeta.short} />}
        tone={typeMeta.tone}
        scope={scope}
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
