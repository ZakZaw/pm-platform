import {
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Layers,
  LifeBuoy,
  ListTodo,
  Megaphone,
  Repeat,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui';
import './TypedGenerationPreview.css';

// F1.5-07: read-only preview for non-Engineering AI drafts. Engineering
// uses the existing inline editable EpicNode tree; for the other five
// types the wizard renders this component instead.
//
// Editing per-row is intentionally out of scope for the first cut —
// the user names the project then confirms, and tweaks the materialised
// entities afterwards on their dedicated pages. Each renderer mirrors
// the visual language of its destination page (deal kanban for sales,
// queue stack for support, etc.) so the user knows what they'll get.
export function TypedGenerationPreview({ preview }) {
  switch (preview.type) {
    case 'Sales':
      return preview.sales ? <SalesPreview draft={preview.sales} /> : null;
    case 'Support':
      return preview.support ? <SupportPreview draft={preview.support} /> : null;
    case 'Marketing':
      return preview.marketing ? <MarketingPreview draft={preview.marketing} /> : null;
    case 'Operations':
      return preview.operations ? <OperationsPreview draft={preview.operations} /> : null;
    case 'Generic':
      return preview.generic ? <GenericPreview draft={preview.generic} /> : null;
    default:
      return null;
  }
}

export function typedDraftTotals(preview) {
  switch (preview.type) {
    case 'Sales': {
      const d = preview.sales;
      return d ? `${d.stages.length} stages · ${d.accounts.length} accounts · ${d.deals.length} deals` : null;
    }
    case 'Support': {
      const d = preview.support;
      return d ? `${d.queues.length} queues · ${d.customers.length} customers · ${d.tickets.length} tickets` : null;
    }
    case 'Marketing': {
      const d = preview.marketing;
      const assets = d?.campaigns.reduce((s, c) => s + c.assets.length, 0) ?? 0;
      const tasks = d?.campaigns.reduce((s, c) => s + c.tasks.length, 0) ?? 0;
      return d ? `${d.campaigns.length} campaigns · ${assets} assets · ${tasks} tasks` : null;
    }
    case 'Operations': {
      const d = preview.operations;
      const items = d?.workflows.reduce((s, w) => s + w.checklist.length, 0) ?? 0;
      return d ? `${d.workflows.length} workflows · ${items} checklist items` : null;
    }
    case 'Generic': {
      const d = preview.generic;
      const tasks = d?.lists.reduce((s, l) => s + l.tasks.length, 0) ?? 0;
      return d ? `${d.lists.length} lists · ${tasks} tasks` : null;
    }
    default:
      return null;
  }
}

function SectionRow({ icon, title, badges = [], meta }) {
  return (
    <div className="typed-preview__row">
      {icon}
      <span className="typed-preview__row-title">{title}</span>
      {badges.map((b, i) => (
        <span key={i}>{b}</span>
      ))}
      {meta && <span className="muted typed-preview__row-meta">{meta}</span>}
    </div>
  );
}

function SubSection({ label, children, count }) {
  return (
    <div className="typed-preview__section">
      <div className="typed-preview__section-head">
        <span className="subsection-eyebrow">{label}</span>
        {count != null && <span className="muted mono">{count}</span>}
      </div>
      <div className="typed-preview__section-body">{children}</div>
    </div>
  );
}

// ---------- Sales ----------

function SalesPreview({ draft }) {
  const accountByName = new Map(draft.accounts.map((a) => [a.name.toLowerCase(), a]));
  const dealsByStage = new Map();
  for (const stage of draft.stages) dealsByStage.set(stage.name, []);
  for (const d of draft.deals) {
    const list = dealsByStage.get(d.stageName) ?? dealsByStage.get(draft.stages[0]?.name);
    list?.push(d);
  }
  return (
    <div className="typed-preview">
      <SubSection label="Pipeline stages" count={draft.stages.length}>
        {draft.stages.map((s) => (
          <SectionRow
            key={`stage-${s.order}-${s.name}`}
            icon={<Layers size={13} aria-hidden="true" />}
            title={s.name}
            badges={[<Badge key="p" tone="neutral">{s.defaultProbability}%</Badge>]}
            meta={`${dealsByStage.get(s.name)?.length ?? 0} deals`}
          />
        ))}
      </SubSection>
      <SubSection label="Target accounts" count={draft.accounts.length}>
        {draft.accounts.map((a) => (
          <SectionRow
            key={a.name}
            icon={<Briefcase size={13} aria-hidden="true" />}
            title={a.name}
            meta={[a.industry, a.domain].filter(Boolean).join(' · ') || undefined}
          />
        ))}
      </SubSection>
      <SubSection label="Seed deals" count={draft.deals.length}>
        {draft.deals.map((d, i) => (
          <SectionRow
            key={`${d.name}-${i}`}
            icon={<BarChart3 size={13} aria-hidden="true" />}
            title={d.name}
            badges={[
              <Badge key="s" tone="info">{d.stageName ?? 'Stage?'}</Badge>,
            ]}
            meta={[
              accountByName.get((d.accountName ?? '').toLowerCase())?.name ?? d.accountName,
              d.value != null ? formatMoney(d.value, d.currency) : null,
              d.probability != null ? `${d.probability}%` : null,
            ].filter(Boolean).join(' · ')}
          />
        ))}
      </SubSection>
    </div>
  );
}

function formatMoney(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency ?? ''} ${value}`;
  }
}

// ---------- Support ----------

function SupportPreview({ draft }) {
  const queueByName = new Map(draft.queues.map((q) => [q.name.toLowerCase(), q]));
  return (
    <div className="typed-preview">
      <SubSection label="Queues" count={draft.queues.length}>
        {draft.queues.map((q) => (
          <SectionRow
            key={q.name}
            icon={<LifeBuoy size={13} aria-hidden="true" />}
            title={q.name}
            badges={[<Badge key="s" tone="neutral">SLA {q.slaMinutes}m</Badge>]}
          />
        ))}
      </SubSection>
      <SubSection label="Customers" count={draft.customers.length}>
        {draft.customers.map((c) => (
          <SectionRow
            key={c.name}
            icon={<Briefcase size={13} aria-hidden="true" />}
            title={c.name}
            badges={c.tier ? [<Badge key="t" tone="purple">{c.tier}</Badge>] : []}
            meta={[c.company, c.email].filter(Boolean).join(' · ') || undefined}
          />
        ))}
      </SubSection>
      <SubSection label="Seed tickets" count={draft.tickets.length}>
        {draft.tickets.map((t, i) => (
          <SectionRow
            key={`${t.subject}-${i}`}
            icon={<CheckSquare size={13} aria-hidden="true" />}
            title={t.subject}
            badges={[
              <Badge key="p" tone="info">{t.priority ?? 'Medium'}</Badge>,
              <Badge key="q" tone="neutral">
                {queueByName.get((t.queueName ?? '').toLowerCase())?.name ?? t.queueName}
              </Badge>,
            ]}
            meta={t.customerName ?? undefined}
          />
        ))}
      </SubSection>
    </div>
  );
}

// ---------- Marketing ----------

function MarketingPreview({ draft }) {
  return (
    <div className="typed-preview">
      <SubSection label="Campaigns" count={draft.campaigns.length}>
        {draft.campaigns.map((c, i) => (
          <div key={`${c.name}-${i}`} className="typed-preview__campaign">
            <SectionRow
              icon={<Megaphone size={13} aria-hidden="true" />}
              title={c.name}
              badges={[<Badge key="ch" tone="info">{c.channel}</Badge>]}
              meta={[c.startDate?.slice(0, 10), c.endDate?.slice(0, 10)].filter(Boolean).join(' → ') || undefined}
            />
            {c.assets.length > 0 && (
              <ul className="typed-preview__sub">
                {c.assets.map((a) => (
                  <li key={a.title}>
                    <CheckCircle2 size={11} aria-hidden="true" />
                    <span>{a.title}</span>
                    <Badge tone="neutral">{a.type}</Badge>
                    {a.publishDate && (
                      <span className="muted">{new Date(a.publishDate).toLocaleDateString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {c.tasks.length > 0 && (
              <ul className="typed-preview__sub">
                {c.tasks.map((t, ti) => (
                  <li key={`${t.title}-${ti}`}>
                    <CheckSquare size={11} aria-hidden="true" />
                    <span>{t.title}</span>
                    {t.assetTitle && <Badge tone="neutral">{t.assetTitle}</Badge>}
                    {t.dueDate && (
                      <span className="muted">due {new Date(t.dueDate).toLocaleDateString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </SubSection>
    </div>
  );
}

// ---------- Operations ----------

function OperationsPreview({ draft }) {
  return (
    <div className="typed-preview">
      <SubSection label="Workflows" count={draft.workflows.length}>
        {draft.workflows.map((w, i) => (
          <div key={`${w.name}-${i}`} className="typed-preview__workflow">
            <SectionRow
              icon={<WorkflowIcon size={13} aria-hidden="true" />}
              title={w.name}
              badges={[
                <Badge key="r" tone="neutral">
                  <Repeat size={11} aria-hidden="true" /> {w.recurrenceRule || 'No recurrence'}
                </Badge>,
              ]}
              meta={w.description || undefined}
            />
            <ul className="typed-preview__sub">
              {w.checklist.map((item, ci) => (
                <li key={`${item.title}-${ci}`}>
                  <CheckSquare size={11} aria-hidden="true" />
                  <span>{item.title}</span>
                  {item.sequential && <Badge tone="neutral">sequential</Badge>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </SubSection>
    </div>
  );
}

// ---------- Generic ----------

function GenericPreview({ draft }) {
  return (
    <div className="typed-preview">
      <SubSection label="Lists" count={draft.lists.length}>
        {draft.lists.map((l, i) => (
          <div key={`${l.name}-${i}`} className="typed-preview__list">
            <SectionRow
              icon={<ListTodo size={13} aria-hidden="true" />}
              title={l.name}
              meta={`${l.tasks.length} task${l.tasks.length === 1 ? '' : 's'}`}
            />
            <ul className="typed-preview__sub">
              {l.tasks.map((t, ti) => (
                <li key={`${t.title}-${ti}`}>
                  <CheckSquare size={11} aria-hidden="true" />
                  <span>{t.title}</span>
                  {t.priority && <Badge tone="info">{t.priority}</Badge>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </SubSection>
    </div>
  );
}
