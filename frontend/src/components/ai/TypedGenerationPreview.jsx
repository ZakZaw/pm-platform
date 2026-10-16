import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Layers,
  LifeBuoy,
  ListTodo,
  Megaphone,
  Repeat,
  Workflow as WorkflowIcon,
} from 'lucide-react';
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

// Plain muted tag (no capsule) for secondary read-outs like stage %,
// priority, channel, SLA.
function Tag({ children }) {
  return <span className="typed-preview-tag">{children}</span>;
}

function SectionRow({ icon, title, badges = [], meta }) {
  return (
    <div className="typed-preview-row">
      {icon}
      <span className="typed-preview-row-title">{title}</span>
      {badges.map((b, i) => (
        <span key={i}>{b}</span>
      ))}
      {meta && <span className="typed-preview-row-meta">{meta}</span>}
    </div>
  );
}

function SubSection({ label, children, count }) {
  return (
    <div className="typed-preview-section">
      <div className="typed-preview-section-head">
        <span className="typed-preview-section-title">{label}</span>
        {count != null && <span className="typed-preview-count">{count}</span>}
      </div>
      <div className="typed-preview-section-body">{children}</div>
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
            badges={[<Tag key="p">{s.defaultProbability}%</Tag>]}
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
              <Tag key="s">{d.stageName ?? 'Stage?'}</Tag>,
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
            badges={[<Tag key="s">SLA {q.slaMinutes}m</Tag>]}
          />
        ))}
      </SubSection>
      <SubSection label="Customers" count={draft.customers.length}>
        {draft.customers.map((c) => (
          <SectionRow
            key={c.name}
            icon={<Briefcase size={13} aria-hidden="true" />}
            title={c.name}
            badges={c.tier ? [<Tag key="t">{c.tier}</Tag>] : []}
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
              <Tag key="p">{t.priority ?? 'Medium'}</Tag>,
              <Tag key="q">
                {queueByName.get((t.queueName ?? '').toLowerCase())?.name ?? t.queueName}
              </Tag>,
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
          <div key={`${c.name}-${i}`} className="typed-preview-campaign">
            <SectionRow
              icon={<Megaphone size={13} aria-hidden="true" />}
              title={c.name}
              badges={[<Tag key="ch">{c.channel}</Tag>]}
              meta={[c.startDate?.slice(0, 10), c.endDate?.slice(0, 10)].filter(Boolean).join(' → ') || undefined}
            />
            {c.assets.length > 0 && (
              <ul className="typed-preview-sub">
                {c.assets.map((a) => (
                  <li key={a.title}>
                    <CheckCircle2 size={11} aria-hidden="true" />
                    <span>{a.title}</span>
                    <Tag>{a.type}</Tag>
                    {a.publishDate && (
                      <span className="muted">{new Date(a.publishDate).toLocaleDateString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {c.tasks.length > 0 && (
              <ul className="typed-preview-sub">
                {c.tasks.map((t, ti) => (
                  <li key={`${t.title}-${ti}`}>
                    <CheckSquare size={11} aria-hidden="true" />
                    <span>{t.title}</span>
                    {t.assetTitle && <Tag>{t.assetTitle}</Tag>}
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
          <div key={`${w.name}-${i}`} className="typed-preview-workflow">
            <SectionRow
              icon={<WorkflowIcon size={13} aria-hidden="true" />}
              title={w.name}
              badges={[
                <Tag key="r">
                  <Repeat size={11} aria-hidden="true" /> {w.recurrenceRule || 'No recurrence'}
                </Tag>,
              ]}
              meta={w.description || undefined}
            />
            <ul className="typed-preview-sub">
              {w.checklist.map((item, ci) => (
                <li key={`${item.title}-${ci}`}>
                  <CheckSquare size={11} aria-hidden="true" />
                  <span>{item.title}</span>
                  {item.sequential && <Tag>sequential</Tag>}
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
          <div key={`${l.name}-${i}`} className="typed-preview-list">
            <SectionRow
              icon={<ListTodo size={13} aria-hidden="true" />}
              title={l.name}
              meta={`${l.tasks.length} task${l.tasks.length === 1 ? '' : 's'}`}
            />
            <ul className="typed-preview-sub">
              {l.tasks.map((t, ti) => (
                <li key={`${t.title}-${ti}`}>
                  <CheckSquare size={11} aria-hidden="true" />
                  <span>{t.title}</span>
                  {t.priority && <Tag>{t.priority}</Tag>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </SubSection>
    </div>
  );
}
