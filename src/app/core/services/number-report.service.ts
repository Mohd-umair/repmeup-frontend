import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportOverview {
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  autoReplied: number;
  resolvedConversations: number;
  totalCampaigns: number;
  campaignRecipients: number;
  campaignDelivered: number;
  campaignFailed: number;
  deliveryRate: number;
}

export interface VolumeDayPoint {
  date: string;       // 'YYYY-MM-DD'
  inbound: number;
  outbound: number;
}

export interface CampaignStatusStat {
  count: number;
  sent: number;
  failed: number;
  recipients: number;
}

export interface TemplateStat {
  name: string;
  language: string;
  campaigns: number;
  totalRecipients: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ConversationFunnel {
  total: number;
  replied: number;
  resolved: number;
  autoReplied: number;
  escalated: number;
  unreplied: number;
}

export interface RecentCampaign {
  _id: string;
  name: string;
  status: string;
  stats: { total: number; sent: number; failed: number; pending: number };
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  templateSnapshot?: { name: string; languageCode: string };
}

export interface NumberReport {
  connection: {
    _id: string;
    displayName: string;
    phone: string;
    isActive: boolean;
  };
  period: { days: number; since: string };
  overview: ReportOverview;
  volumeTimeSeries: VolumeDayPoint[];
  campaignBreakdown: Record<string, CampaignStatusStat>;
  templatePerformance: TemplateStat[];
  sentimentBreakdown: SentimentBreakdown;
  conversationFunnel: ConversationFunnel;
  recentCampaigns: RecentCampaign[];
}

export interface NumberReportResponse {
  success: boolean;
  report: NumberReport;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NumberReportService {
  constructor(private api: ApiService) {}

  getReport(connectionId: string, days = 30): Observable<NumberReportResponse> {
    return this.api.get<NumberReportResponse>(
      `/reports/number/${connectionId}`,
      { days }
    );
  }
}
