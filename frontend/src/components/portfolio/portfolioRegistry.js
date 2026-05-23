// F1.5-08 — portfolio summary registry. Maps a project type to the
// component that renders its summary card on the org portfolio page.
// Adding a new project type means writing a new summary component and
// adding one line here.
//
// Each component takes `{ project }` (a ProjectSummary from the org
// list endpoint) and loads its own data via the per-type API. Once F3-19
// adds a server-side /portfolio aggregate, these components switch to
// reading from the pre-aggregated payload instead — the registry layout
// stays the same.

import { EngineeringSummary } from './summaries/EngineeringSummary';
import { SalesSummary } from './summaries/SalesSummary';
import { SupportSummary } from './summaries/SupportSummary';
import { MarketingSummary } from './summaries/MarketingSummary';
import { OperationsSummary } from './summaries/OperationsSummary';
import { GenericSummary } from './summaries/GenericSummary';

export const PORTFOLIO_SUMMARIES = {
  Engineering: EngineeringSummary,
  Sales: SalesSummary,
  Support: SupportSummary,
  Marketing: MarketingSummary,
  Operations: OperationsSummary,
  Generic: GenericSummary,
};

export function summaryForType(type) {
  return PORTFOLIO_SUMMARIES[type] ?? null;
}
