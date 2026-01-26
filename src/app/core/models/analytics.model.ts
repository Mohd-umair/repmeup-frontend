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
}

export interface IAnalyticsFilters {
  dateRange: IAnalyticsDateRange;
  platforms?: string[];
  types?: string[]; // comment, review, message
  sentiment?: string[]; // positive, neutral, negative
  status?: string[]; // unread, read, replied
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

