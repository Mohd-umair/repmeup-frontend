/**
 * Analytics Models - Scalable data structures for analytics
 */

export interface IAnalyticsDateRange {
  startDate: Date;
  endDate: Date;
  preset?: 'today' | '7days' | '30days' | '90days' | 'custom';
}

export interface IMetricCard {
  label: string;
  value: number;
  change?: number; // Percentage change from previous period
  changeType?: 'increase' | 'decrease';
  icon: string;
  color: string;
  trend?: number[]; // Mini sparkline data
}

export interface IPlatformMetrics {
  platform: string;
  totalInteractions: number;
  responded: number;
  pending: number;
  avgResponseTime: number; // in minutes
  sentimentScore?: number; // 0-100
  engagementRate?: number; // percentage
}

export interface ITimeSeriesData {
  date: string;
  interactions: number;
  responses: number;
  avgResponseTime?: number;
  [key: string]: any; // For dynamic metrics
}

export interface ISentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export interface IAutoReplyMetrics {
  totalAutoReplies: number;
  successRate: number;
  avgConfidence: number;
  byPlatform: {
    [platform: string]: {
      sent: number;
      approved: number;
      rejected: number;
    };
  };
}

export interface IResponseTimeMetrics {
  avg: number;
  median: number;
  fastest: number;
  slowest: number;
  within1Hour: number;
  within24Hours: number;
  over24Hours: number;
}

export interface ITopPerformers {
  posts: Array<{
    id: string;
    platform: string;
    content: string;
    engagementScore: number;
    commentsCount: number;
    date: string;
  }>;
  replies: Array<{
    id: string;
    platform: string;
    content: string;
    sentiment: string;
    likes?: number;
    date: string;
  }>;
}

export interface IIntentBucketMeta {
  name?: string;
  label?: string;
  color: string;
  icon: string;
}

export interface IIntentBreakdown {
  data: { [key: string]: number };
  /** Display metadata (name, color, icon) per bucket key — populated from IntentBucket collection */
  meta?: { [key: string]: IIntentBucketMeta };
  total: number;
}

export interface IAiVsHuman {
  aiReplies: number;
  humanReplies: number;
  totalReplies: number;
  aiPercent: number;
}

export interface ITopInteraction {
  postId: string;
  platform: string;
  postUrl?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  commentCount: number;
  totalLikes: number;
  totalViews: number;
  positiveCount: number;
  negativeCount: number;
  sentiment: 'positive' | 'negative';
  latestDate: string;
}

export interface IAnalyticsDashboard {
  dateRange: IAnalyticsDateRange;
  overview: {
    totalInteractions: IMetricCard;
    responseRate: IMetricCard;
    avgResponseTime: IMetricCard;
    sentimentScore: IMetricCard;
  };
  platformMetrics: IPlatformMetrics[];
  timeSeries: ITimeSeriesData[];
  sentimentBreakdown: ISentimentBreakdown;
  autoReplyMetrics?: IAutoReplyMetrics;
  responseTimeMetrics: IResponseTimeMetrics;
  topPerformers?: ITopPerformers;
  intentBreakdown?: IIntentBreakdown;
  aiVsHuman?: IAiVsHuman;
  topInteractions?: ITopInteraction[];
}

export interface IAnalyticsFilters {
  dateRange: IAnalyticsDateRange;
  platforms?: string[];
  types?: string[]; // comment, review, message
  sentiment?: string[]; // positive, neutral, negative
  status?: string[]; // unread, read, replied
  /** Narrow analytics to a single connected account */
  connectionId?: string;
}

export interface IAnalyticsResponse {
  success: boolean;
  data: IAnalyticsDashboard;
  error?: string;
}

// Export metrics for comparison
export interface IComparisonMetrics {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
}

// Agent analytics
export interface IAgentStats {
  userId: string;
  name: string;
  totalAssigned: number;
  totalResolved: number;
  avgResponseTime: number;
  sentimentBreakdown: ISentimentBreakdown;
  performanceScore: number;
}

export interface IAgentAnalytics {
  agents: IAgentStats[];
  teamAverages: {
    avgResponseTime: number;
    resolutionRate: number;
  };
}

// Engagement analytics
export interface IEngagementOverview {
  totalLikes: number;
  totalShares: number;
  totalViews: number;
  totalInteractions: number;
  avgEngagementRate: number;
}

export interface IEngagementByPlatform {
  platform: string;
  likes: number;
  shares: number;
  views: number;
  engagementRate: number;
}

export interface IEngagementTimeSeries {
  date: string;
  likes: number;
  shares: number;
  views: number;
}

export interface IEngagementAnalytics {
  overview: IEngagementOverview;
  byPlatform: IEngagementByPlatform[];
  topInteractions: any[];
  timeSeries: IEngagementTimeSeries[];
}

// Report types
export type ReportType = 'sentiment' | 'response' | 'autoreply' | 'platform' | 'agent' | 'engagement';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

