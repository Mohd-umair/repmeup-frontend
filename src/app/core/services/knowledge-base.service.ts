import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { IApiResponse, IPagination } from '../models/api-response.model';

export interface IKbTemplateField { key: string; value: string; }

export interface IKnowledgeBase {
  _id: string;
  organization: string;
  source: 'manual' | 'pdf' | 'url' | 'import';
  type: string;
  category: string;
  title: string;
  content: string;
  templateFields?: IKbTemplateField[];
  tags: string[];
  keywords: string[];
  priority: number;
  isTrainingData: boolean;
  trainingContext?: string;
  trainingWeight: number;
  metadata: any;
  usageCount: number;
  lastUsedAt?: Date;
  isActive: boolean;
  createdBy: any;
  updatedBy?: any;
  createdAt: Date;
  updatedAt: Date;
}

/** Org-wide stats returned with each list request (sidebar analytics). */
export interface IKbListAnalytics {
  totalEntries: number;
  activeCount: number;
  inactiveCount: number;
  usedEntries: number;
  neverUsedEntries: number;
  totalUsage: number;
  avgTrainingWeight: number;
  highWeightCount: number;
  midWeightCount: number;
  lowWeightCount: number;
  topUsed: Array<{ _id: string; title: string; usageCount: number; source?: string; type?: string }>;
  bySource: Record<string, number>;
  byType: Array<{ type: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
}

export interface IKnowledgeBaseListResponse {
  success: boolean;
  data?: IKnowledgeBase[];
  pagination?: IPagination;
  analytics?: IKbListAnalytics;
  error?: string;
}

/** One discovered internal page (before user selects which to import). */
export interface IKbDiscoveredUrl {
  url: string;
  title: string;
  depth?: number;
}

/** Live status of a whole-website crawl job (polled after enqueue). */
export interface IKbCrawlStatus {
  crawlJobId: string;
  status: 'queued' | 'crawling' | 'completed' | 'failed' | 'partial';
  done: boolean;
  startUrl: string;
  maxPages: number;
  pagesFound: number;
  pagesProcessed: number;
  entriesCreated: number;
  currentUrl: string;
  creditsUsed: number;
  errors: Array<{ url: string; reason: string }>;
  error: string;
  startedAt?: string;
  finishedAt?: string;
}

/**
 * Knowledge Base Service - Single Responsibility Principle
 * Handles all knowledge base related API operations
 */
@Injectable({
  providedIn: 'root'
})
export class KnowledgeBaseService {
  constructor(private apiService: ApiService) {}

  /**
   * Paginated list; optional query: page, limit, category, source, search
   */
  getAllKnowledgeBase(params?: Record<string, string | number>): Observable<IKnowledgeBaseListResponse> {
    return this.apiService.get<IKnowledgeBaseListResponse>('/knowledge-base', params);
  }

  /**
   * Lightweight check — returns true if the org has at least one KB entry.
   * Used by the inbox setup guide to avoid running a full paginated query.
   */
  checkExists(): Observable<boolean> {
    return this.apiService.get<{ success: boolean; exists: boolean }>('/knowledge-base/exists').pipe(
      map(res => res.exists === true)
    );
  }

  /**
   * Get single knowledge base entry
   */
  getKnowledgeBase(id: string): Observable<IApiResponse<IKnowledgeBase>> {
    return this.apiService.get<IApiResponse<IKnowledgeBase>>(`/knowledge-base/${id}`);
  }

  /**
   * Create manual knowledge base entry
   */
  createManual(data: any): Observable<IApiResponse<IKnowledgeBase>> {
    return this.apiService.post<IApiResponse<IKnowledgeBase>>('/knowledge-base/manual', data);
  }

  /**
   * Create knowledge base from PDF
   */
  createFromPDF(formData: FormData): Observable<IApiResponse<IKnowledgeBase>> {
    return this.apiService.post<IApiResponse<IKnowledgeBase>>('/knowledge-base/pdf', formData);
  }

  /**
   * Create knowledge base from a single URL (homepage only).
   */
  createFromURL(data: any): Observable<IApiResponse<IKnowledgeBase>> {
    return this.apiService.post<IApiResponse<IKnowledgeBase>>('/knowledge-base/url', data);
  }

  /**
   * Discover internal URLs on a website (no AI). User picks pages via checkboxes next.
   */
  discoverWebsiteUrls(data: { url: string; maxPages?: number }): Observable<IApiResponse<{
    startUrl: string;
    urls: IKbDiscoveredUrl[];
    totalFound: number;
    maxPages: number;
  }>> {
    return this.apiService.post<IApiResponse<{
      startUrl: string;
      urls: IKbDiscoveredUrl[];
      totalFound: number;
      maxPages: number;
    }>>('/knowledge-base/url/discover', data);
  }

  /**
   * Import selected pages from a website crawl. Returns a crawlJobId to poll.
   */
  createFromWebsiteCrawl(data: {
    url: string;
    selectedUrls: string[];
    titlePrefix?: string;
    category?: string;
    priority?: number;
    targetWordCount?: number;
    targetTagCount?: number;
    tags?: string[];
  }): Observable<IApiResponse<{ crawlJobId: string; status: string; maxPages: number; selectedCount?: number }>> {
    return this.apiService.post<IApiResponse<{ crawlJobId: string; status: string; maxPages: number; selectedCount?: number }>>(
      '/knowledge-base/url/crawl', data
    );
  }

  /**
   * Poll the status of a website crawl job.
   */
  getCrawlStatus(crawlJobId: string): Observable<IApiResponse<IKbCrawlStatus>> {
    return this.apiService.get<IApiResponse<IKbCrawlStatus>>(`/knowledge-base/url/crawl/${crawlJobId}`);
  }

  /**
   * Update knowledge base entry
   */
  update(id: string, data: any): Observable<IApiResponse<IKnowledgeBase>> {
    return this.apiService.put<IApiResponse<IKnowledgeBase>>(`/knowledge-base/${id}`, data);
  }

  /**
   * Delete knowledge base entry
   */
  delete(id: string): Observable<IApiResponse> {
    return this.apiService.delete<IApiResponse>(`/knowledge-base/${id}`);
  }

  /**
   * Get categories
   */
  getCategories(): Observable<IApiResponse<string[]>> {
    return this.apiService.get<IApiResponse<string[]>>('/knowledge-base/categories');
  }
}

