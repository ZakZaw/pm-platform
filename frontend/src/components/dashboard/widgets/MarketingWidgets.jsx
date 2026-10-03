import { Sparkline } from '@/components/ui';
import { channelTokens } from '@/constants/projectTypes';
import { DashboardWidget, MetricRow, StackedBar, WidgetRows } from '../DashboardWidget';

// polish D: Marketing widgets read the server-computed `/analytics/marketing`
// aggregate (passed down by TypedDashboard). Weekly publish throughput — the
// new depth metric — renders as a sparkline of assets shipped per week.

export function MarketingActiveCampaignsWidget({ data, loading }) {
  const active = data?.activeCampaigns ?? [];
  return (
    <DashboardWidget
      title="Active campaigns"
      loading={loading}
      empty={!loading && (data?.activeCampaignCount ?? 0) === 0}
      emptyText="No active campaigns."
    >
      <MetricRow label="Running" value={data?.activeCampaignCount ?? 0} />
      <WidgetRows
        rows={active.map((c) => ({ key: c.id, label: c.name, meta: `${c.publishedAssetCount}/${c.assetCount} assets` }))}
      />
    </DashboardWidget>
  );
}

export function MarketingThroughputWidget({ data, loading }) {
  const throughput = data?.throughput ?? [];
  const points = throughput.map((w) => w.count);
  const hasAny = points.some((n) => n > 0);
  return (
    <DashboardWidget
      title="Asset throughput"
      loading={loading}
      empty={!loading && !hasAny}
      emptyText="No assets published in the last 8 weeks."
    >
      <MetricRow
        label="Published · last 30 days"
        value={data?.publishedLast30 ?? 0}
        sublabel="Assets shipped per week"
      />
      <Sparkline points={points} width={240} height={40} stroke="var(--accent)" />
    </DashboardWidget>
  );
}

export function MarketingAssetsDueWidget({ data, loading }) {
  const items = data?.dueThisWeek ?? [];
  return (
    <DashboardWidget
      title="Assets due this week"
      loading={loading}
      empty={!loading && items.length === 0}
      emptyText="No assets scheduled in the next 7 days."
    >
      <MetricRow label="Scheduled" value={items.length} />
      <WidgetRows
        rows={items.map((a) => ({
          key: a.id,
          label: a.title,
          meta: a.publishDate
            ? new Date(a.publishDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : '—',
        }))}
      />
    </DashboardWidget>
  );
}

export function MarketingChannelMixWidget({ data, loading }) {
  const segments = (data?.channelMix ?? []).map(({ channel, count }) => ({
    label: channel,
    value: count,
    // Resolve the design-token foreground for the channel so the dashboard
    // matches the calendar / campaigns list.
    color: channelTokens(channel).fg,
  }));
  return (
    <DashboardWidget
      title="Channel mix"
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="Add campaigns to see the channel split."
    >
      {segments.length > 0 && <StackedBar segments={segments} />}
    </DashboardWidget>
  );
}
