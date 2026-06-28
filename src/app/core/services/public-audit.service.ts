import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, switchMap, takeWhile, takeUntil, Subject, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditTeaser {
  igReplyRate?: number;
  googleRating?: number;
  googleReviews?: number;
  googleReplyRate?: number;
  buyingIntentCount?: number;
}

export interface AuditModule_SocialPresence {
  igFollowers: number;
  igPosts: number;
  igComments: number;
  igReplies: number;
  igReplyRate: number;
  igBuyingIntentCount: number;
  igUnansweredBuying: number;
  igPostingGaps: boolean;
  igAvgEngagement: number;
  fbPosts: number;
  fbComments: number;
  fbReplies: number;
  fbReplyRate: number;
}

export interface AuditModule_Reputation {
  google: { rating: number; totalReviews: number; ownerReplyRate: number; unansweredNegative: number };
  facebook: { rating: number; commentReplyRate: number };
}

export interface AuditModule_RevenueLeak {
  number: number;
  unansweredBuying: number;
  estimatedConversion: number;
  avgOrderValue: number;
  formula: string;
}

export interface AuditRecommendation {
  rank: number;
  title: string;
  explanation: string;
  expectedImpact: string;
  feature: string;
}

export interface AuditOpportunity {
  metric: string;
  currentValue: number;
  improvedValue: number;
  unit: string;
  upliftLabel: string;
  upliftFraction: number;
}

export interface AuditModules {
  socialPresence?: AuditModule_SocialPresence;
  reputation?: AuditModule_Reputation;
  revenueLeak?: AuditModule_RevenueLeak;
  aiRecommendations?: AuditRecommendation[];
  opportunityCalc?: AuditOpportunity[];
}

export interface GrowthAudit {
  id: string;
  status: 'queued' | 'processing' | 'done' | 'partial' | 'failed';
  score?: number;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  businessName?: string;
  industry?: string;
  igHandle?: string;
  fbPageUrl?: string;
  googleQuery?: string;
  revenueLeak?: number;
  revenueLeakFormula?: string;
  unansweredBuying?: number;
  teaser?: AuditTeaser;
  modules?: AuditModules;
  benchmarks?: Record<string, number>;
  shareToken?: string;
  leadCaptured?: boolean;
  errorMessage?: string;
  createdAt?: string;
}

export interface AuditCreateInput {
  igHandle?: string;
  fbPageUrl?: string;
  googleQuery?: string;
  businessName?: string;
  industry?: string;
  avgOrderValue?: number;
}

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  business?: string;
}

export interface Industry {
  value: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class PublicAuditService implements OnDestroy {
  private readonly base = `${environment.apiUrl}/public/growth-audit`;
  private readonly destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  getIndustries(): Observable<{ success: boolean; industries: Industry[] }> {
    return this.http.get<{ success: boolean; industries: Industry[] }>(`${this.base}/industries`);
  }

  createAudit(input: AuditCreateInput): Observable<{ success: boolean; auditId: string; cached: boolean }> {
    return this.http.post<{ success: boolean; auditId: string; cached: boolean }>(this.base, input);
  }

  getAudit(id: string): Observable<{ success: boolean; audit: GrowthAudit }> {
    return this.http.get<{ success: boolean; audit: GrowthAudit }>(`${this.base}/${id}`);
  }

  captureLead(id: string, lead: LeadInput): Observable<{ success: boolean; audit: GrowthAudit }> {
    return this.http.post<{ success: boolean; audit: GrowthAudit }>(`${this.base}/${id}/lead`, lead);
  }

  getSharedAudit(id: string, token: string): Observable<{ success: boolean; audit: GrowthAudit }> {
    return this.http.get<{ success: boolean; audit: GrowthAudit }>(`${this.base}/${id}/share/${token}`);
  }

  getPdfUrl(id: string, token?: string): string {
    return token
      ? `${this.base}/${id}/pdf?token=${token}`
      : `${this.base}/${id}/pdf`;
  }

  /**
   * Poll an audit every 3s until it reaches done/partial/failed or 2 minutes elapse.
   * Callers take until their destroy$ fires.
   */
  pollUntilDone(id: string): Observable<GrowthAudit> {
    return interval(3000).pipe(
      switchMap(() => this.getAudit(id)),
      switchMap(resp => of(resp.audit)),
      takeWhile(audit => audit.status === 'queued' || audit.status === 'processing', true),
      takeUntil(this.destroy$)
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
