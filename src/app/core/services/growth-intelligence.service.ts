import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformMetric {
  platform: string;
  total: number;
  responded: number;
  pending: number;
  responseRate: number;
  avgResponseTimeMins: number;
}

export interface SentimentData {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  score: number;   // 0–100
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  action: string;
}

export interface Benchmarks {
  responseRate: number;      // %
  avgResponseTime: number;   // minutes
  googleRating: number;
}

export interface GIDashboard {
  period: { days: number; start: string; end: string };
  conversationScore: number;  // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  responseRate: number;       // %
  avgResponseTimeMins: number;
  totalInteractions: number;
  repliedCount: number;
  unansweredCount: number;
  unansweredRate: number;     // %
  inquiryRate: number | null;
  unansweredInquiries: number;
  sentiment: SentimentData;
  revenueLeakEstimate: number;  // INR / month
  platforms: PlatformMetric[];
  benchmarks: Benchmarks;
  recommendations: Recommendation[];
}

export interface TrendPoint {
  date: string;
  score: number;
  responseRate: number;
  avgResponseTime: number;
  revenueLeak: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GrowthIntelligenceService {
  private readonly base = `${environment.apiUrl}/growth-intelligence`;

  constructor(private http: HttpClient) {}

  getDashboard(opts: {
    days?: number;
    industry?: string;
    avgOrderValue?: number;
    withAI?: boolean;
  } = {}): Observable<GIDashboard> {
    let params = new HttpParams();
    if (opts.days)          params = params.set('days', opts.days);
    if (opts.industry)      params = params.set('industry', opts.industry);
    if (opts.avgOrderValue) params = params.set('avgOrderValue', opts.avgOrderValue);
    if (opts.withAI)        params = params.set('withAI', 'true');

    return this.http
      .get<{ success: boolean; dashboard: GIDashboard }>(`${this.base}/dashboard`, { params })
      .pipe(map(r => r.dashboard));
  }

  getTrends(days: 30 | 60 | 90 = 30): Observable<TrendPoint[]> {
    const params = new HttpParams().set('days', days);
    return this.http
      .get<{ success: boolean; trend: TrendPoint[] }>(`${this.base}/trends`, { params })
      .pipe(map(r => r.trend));
  }
}
