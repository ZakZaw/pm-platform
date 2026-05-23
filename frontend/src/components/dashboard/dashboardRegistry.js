// F1.5-08: maps project type → array of widget renderers for the
// type-aware Dashboard page. Adding a future project type means adding
// a new entry here, not editing DashboardPage.jsx. Each widget is a
// React component that takes `{ project }` and loads its own data.

import { SalesPipelineValueWidget, SalesConversionWidget, SalesDealsAtRiskWidget } from './widgets/SalesWidgets';
import { SupportOpenTicketsWidget, SupportSlaBreachWidget, SupportByQueueWidget } from './widgets/SupportWidgets';
import { MarketingActiveCampaignsWidget, MarketingAssetsDueWidget, MarketingChannelMixWidget } from './widgets/MarketingWidgets';
import { OperationsNext7DaysWidget, OperationsOverdueRunsWidget, OperationsSkipRateWidget } from './widgets/OperationsWidgets';
import { GenericOpenTasksWidget, GenericByAssigneeWidget, GenericCompletionRateWidget } from './widgets/GenericWidgets';

// Engineering keeps its bespoke dashboard implementation (the original
// DashboardPage body with charts + sample-data callouts). The registry
// returns null for Engineering so the page falls back to the legacy
// renderer; every other type uses the widget list here.
export const DASHBOARD_WIDGETS = {
  Engineering: null,
  Sales: [SalesPipelineValueWidget, SalesConversionWidget, SalesDealsAtRiskWidget],
  Support: [SupportOpenTicketsWidget, SupportSlaBreachWidget, SupportByQueueWidget],
  Marketing: [MarketingActiveCampaignsWidget, MarketingAssetsDueWidget, MarketingChannelMixWidget],
  Operations: [OperationsNext7DaysWidget, OperationsOverdueRunsWidget, OperationsSkipRateWidget],
  Generic: [GenericOpenTasksWidget, GenericByAssigneeWidget, GenericCompletionRateWidget],
};

export function widgetsForType(type) {
  return DASHBOARD_WIDGETS[type] ?? null;
}
