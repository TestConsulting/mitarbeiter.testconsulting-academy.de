export type AnalyticsTotals = { activeUsers: number; sessions: number; pageViews: number };
export type MarketingAnalytics = {
  stub: boolean;
  canSync: boolean;
  syncStatus: { lastRunAt: string; lastOkAt: string | null; lastError: string | null } | null;
  days: 7 | 28 | 90;
  from: string; // YYYY-MM-DD, Europe/Berlin
  to: string;
  totals: AnalyticsTotals;
  previousTotals: AnalyticsTotals;
  daily: ({ date: string } & AnalyticsTotals)[];          // lückenlos from..to
  previousDaily: ({ date: string } & AnalyticsTotals)[];  // lückenlos Vorperiode
  channels: ({ key: string } & AnalyticsTotals)[];        // Top 10 nach sessions
  pages: ({ key: string } & AnalyticsTotals)[];           // Top 10 nach pageViews
  posts: { campaign: string; title: string | null; date: string | null; pillar: string | null; pillarLabel: string | null; format: string | null; url: string | null; sessions: number; activeUsers: number }[];
  byPillar: { key: string; label: string; sessions: number; activeUsers: number; posts: number }[];
  byFormat: { key: string; sessions: number; activeUsers: number; posts: number }[];
};
