// F1.5-08: maps project type → its dashboard config for the type-aware
// Dashboard page. Adding a future project type means adding a new entry here,
// not editing DashboardPage.jsx.
//
// polish D: typed dashboards now read one server-computed analytics aggregate
// per type (instead of each widget deriving metrics client-side from the list
// endpoints). The config carries a `load(projectId)` fetcher; TypedDashboard
// calls it once and passes the result to every widget as `{ project, data,
// loading }`. Generic keeps `load: null` and its widgets self-fetch as before.

import { analyticsApi } from '@/api/analytics.api';
import {
  SalesPipelineValueWidget, SalesForecastWidget, SalesConversionWidget, SalesDealsAtRiskWidget,
} from './widgets/SalesWidgets';
import {
  SupportOpenTicketsWidget, SupportSlaAttainmentWidget, SupportSlaBreachWidget, SupportByQueueWidget,
} from './widgets/SupportWidgets';
import {
  MarketingActiveCampaignsWidget, MarketingThroughputWidget, MarketingAssetsDueWidget, MarketingChannelMixWidget,
} from './widgets/MarketingWidgets';
import {
  OperationsCompletionWidget, OperationsNext7DaysWidget, OperationsOverdueRunsWidget, OperationsSkipRateWidget,
} from './widgets/OperationsWidgets';
import { GenericOpenTasksWidget, GenericByAssigneeWidget, GenericCompletionRateWidget } from './widgets/GenericWidgets';

// Engineering keeps its bespoke dashboard implementation (the customisable
// canvas with the real charts). The registry returns null for Engineering so
// the page falls back to that renderer; every other type uses a widget list.
export const DASHBOARD_WIDGETS = {
  Engineering: null,
  Sales: {
    load: (projectId) => analyticsApi.sales(projectId),
    widgets: [SalesPipelineValueWidget, SalesForecastWidget, SalesConversionWidget, SalesDealsAtRiskWidget],
  },
  Support: {
    load: (projectId) => analyticsApi.support(projectId),
    widgets: [SupportOpenTicketsWidget, SupportSlaAttainmentWidget, SupportSlaBreachWidget, SupportByQueueWidget],
  },
  Marketing: {
    load: (projectId) => analyticsApi.marketing(projectId),
    widgets: [MarketingActiveCampaignsWidget, MarketingThroughputWidget, MarketingAssetsDueWidget, MarketingChannelMixWidget],
  },
  Operations: {
    load: (projectId) => analyticsApi.operations(projectId),
    widgets: [OperationsCompletionWidget, OperationsNext7DaysWidget, OperationsOverdueRunsWidget, OperationsSkipRateWidget],
  },
  Generic: {
    load: null,
    widgets: [GenericOpenTasksWidget, GenericByAssigneeWidget, GenericCompletionRateWidget],
  },
};

export function widgetsForType(type) {
  return DASHBOARD_WIDGETS[type] ?? null;
}
