// One-line "N stages · M deals" style summary for a non-Engineering AI draft.
// Lives outside TypedGenerationPreview.jsx so that file only exports components.

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
