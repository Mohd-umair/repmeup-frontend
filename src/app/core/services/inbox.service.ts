import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import { IInteraction, IInboxFilters, IInboxStats } from '../models/interaction.model';

/** DM thread page size — must match backend DEFAULT_INCOMING_MSG_LIMIT (GET /inbox/:id). */
export const INBOX_THREAD_MESSAGE_PAGE_SIZE = 10;

/**
 * Inbox Service - Single Responsibility Principle
 * Handles all inbox/interaction related operations
 * 
 * Dependencies: ApiService (abstraction)
 * Following Dependency Inversion Principle
 */
@Injectable({
  providedIn: 'root'
})
export class InboxService {
  private interactionsSubject = new BehaviorSubject<IInteraction[]>([]);
  public interactions$ = this.interactionsSubject.asObservable();

  private statsSubject = new BehaviorSubject<IInboxStats | null>(null);
  public stats$ = this.statsSubject.asObservable();

  private selectedInteractionSubject = new BehaviorSubject<IInteraction | null>(null);
  public selectedInteraction$ = this.selectedInteractionSubject.asObservable();

  constructor(private apiService: ApiService) {}

  /**
   * Get interactions for one page (server default limit is 10 chats per request).
   * - Default: replace list with this page (initial load / filter change).
   * - `append`: concat next page for infinite scroll (dedupe by `_id`).
   * - `mergeFirstPage`: refresh page-1 data while keeping tail rows loaded via scroll (polling).
   */
  getInteractions(
    filters?: IInboxFilters,
    opts?: { append?: boolean; mergeFirstPage?: boolean }
  ): Observable<IApiResponse<any>> {
    return this.apiService.get<IApiResponse<any>>('/inbox', filters).pipe(
      tap(response => {
        if (!response.success || !response.data) return;
        const fromApi: IInteraction[] = response.data.interactions || [];
        const append = opts?.append === true;
        const mergeFirstPage = opts?.mergeFirstPage === true;

        if (mergeFirstPage && !append) {
          const current = this.interactionsSubject.value;
          const freshIds = new Set(fromApi.map(i => i._id));
          const tail = current.filter(i => !freshIds.has(i._id));
          this.interactionsSubject.next([...fromApi, ...tail]);
          return;
        }
        if (append) {
          const current = this.interactionsSubject.value;
          const seen = new Set(current.map(i => i._id));
          const merged = [...current];
          for (const item of fromApi) {
            if (!seen.has(item._id)) {
              seen.add(item._id);
              merged.push(item);
            }
          }
          this.interactionsSubject.next(merged);
          return;
        }
        this.interactionsSubject.next(fromApi);
      })
    );
  }

  /**
   * Analyze sentiment for interactions that have no sentiment (keyword-based backfill)
   */
  analyzeSentiment(limit?: number): Observable<IApiResponse<{ analyzed: number; sample: any[]; message?: string }>> {
    return this.apiService.post<IApiResponse<{ analyzed: number; sample: any[]; message?: string }>>('/inbox/analyze-sentiment', { limit });
  }

  /**
   * Get single interaction by ID.
   * Pass `markRead: true` only when the user explicitly opens a conversation —
   * never from background refreshes, polling, or socket-triggered re-fetches.
   */
  getInteraction(
    id: string,
    params?: {
      sortOrder?: 'asc' | 'desc';
      markRead?: boolean;
      /** Unix-ms cursor: load messages older than this timestamp (load-more flow) */
      msgBefore?: number;
      /** Max incoming DM messages per page (default INBOX_THREAD_MESSAGE_PAGE_SIZE; server cap 300) */
      msgLimit?: number;
    }
  ): Observable<IApiResponse<IInteraction> & { pagination?: { hasOlderMessages: boolean; oldestMessageTimestamp: number | null; totalMessages: number; returnedMessages: number } }> {
    const query = {
      ...params,
      msgLimit: params?.msgLimit ?? INBOX_THREAD_MESSAGE_PAGE_SIZE
    };
    return this.apiService.get<IApiResponse<IInteraction>>(`/inbox/${id}`, query as any)
      .pipe(
        tap(response => {
          if (response.success && response.data && !(params as any)?.msgBefore) {
            // Only update the global selected subject on initial load, not on load-more
            this.selectedInteractionSubject.next(response.data);
          }
        })
      );
  }

  /**
   * Get inbox statistics
   * @param filters Optional filters (e.g. platform) for per-platform stats
   */
  getStats(filters?: { platform?: string | string[] }): Observable<IApiResponse<IInboxStats>> {
    const params =
      filters?.platform != null && filters.platform !== ''
        ? { platform: filters.platform }
        : undefined;
    return this.apiService.get<IApiResponse<IInboxStats>>('/inbox/stats', params)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.statsSubject.next(response.data);
          }
        })
      );
  }

  /**
   * Reply to an interaction
   */
  replyToInteraction(
    id: string,
    content: string,
    useTemplate?: boolean,
    templateId?: string,
    attachmentUrl?: string,
    attachmentType?: 'image' | 'video' | 'file' | 'audio'
  ): Observable<IApiResponse> {
    const body: Record<string, unknown> = { content, useTemplate, templateId };
    if (attachmentUrl) body['attachmentUrl'] = attachmentUrl;
    if (attachmentType) body['attachmentType'] = attachmentType;
    return this.apiService.post<IApiResponse>(`/inbox/${id}/reply`, body);
  }

  /**
   * Upload a media file (image or audio blob) and return its public URL.
   * Uses the existing /media-library/upload endpoint which stores files on disk
   * and returns a persistent public URL safe to send to the backend.
   */
  uploadAttachment(blob: Blob, filename: string): Observable<IApiResponse> {
    const form = new FormData();
    form.append('media', blob, filename);
    return this.apiService.postForm<IApiResponse>('/media-library/upload', form);
  }

  deleteReply(interactionId: string, replyId: string): Observable<IApiResponse> {
    return this.apiService.delete<IApiResponse>(`/inbox/${interactionId}/replies/${replyId}`);
  }

  /**
   * Generate AI suggested reply for an interaction
   */
  suggestReply(id: string): Observable<IApiResponse<any>> {
    return this.apiService.post<IApiResponse<any>>(`/inbox/${id}/suggest-reply`, {});
  }

  aiAssist(id: string): Observable<IApiResponse<{ short: string; detailed: string; sales: string; usedKnowledgeBase: boolean; knowledgeBaseCount: number }>> {
    return this.apiService.post<IApiResponse<any>>(`/inbox/${id}/ai-assist`, {});
  }

  aiAssistRegenerate(id: string, type: 'short' | 'detailed' | 'sales'): Observable<IApiResponse<{ type: string; content: string }>> {
    return this.apiService.post<IApiResponse<any>>(`/inbox/${id}/ai-assist/regenerate`, { type });
  }

  /** Generate AI chat summary (costs 1 credit). */
  generateAISummary(id: string): Observable<IApiResponse<{
    summary: string;
    suggestedAction?: string | null;
    generatedBy: string;
    generatedAt: Date;
  }>> {
    return this.apiService.post<IApiResponse<any>>(`/inbox/${id}/summary/generate`, {});
  }

  /** Save a manual (or edited) chat summary. */
  saveSummary(id: string, summary: string): Observable<IApiResponse<{ summary: string; generatedBy: string; generatedAt: Date }>> {
    return this.apiService.put<IApiResponse<any>>(`/inbox/${id}/summary`, { summary });
  }

  /**
   * Assign interaction to agent
   */
  assignInteraction(id: string, userId: string, reason?: string): Observable<IApiResponse> {
    return this.apiService.put<IApiResponse>(`/inbox/${id}/assign`, {
      userId,
      reason
    });
  }

  /**
   * Get org labels
   */
  getLabels(): Observable<IApiResponse<{ _id: string; name: string; color?: string; icon?: string }[]>> {
    return this.apiService.get<IApiResponse<any>>('/inbox/labels');
  }

  /**
   * Add label to interaction
   */
  addLabel(id: string, labelId: string): Observable<IApiResponse> {
    return this.apiService.put<IApiResponse>(`/inbox/${id}/labels`, { labelId });
  }

  /**
   * Add internal note
   */
  addNote(id: string, note: string, isPrivate: boolean = false): Observable<IApiResponse> {
    return this.apiService.post<IApiResponse>(`/inbox/${id}/notes`, {
      note,
      isPrivate
    });
  }

  /**
   * Update interaction status
   */
  updateStatus(id: string, status: string): Observable<IApiResponse> {
    return this.apiService.put<IApiResponse>(`/inbox/${id}/status`, { status }).pipe(
      tap((response) => {
        if (response.success) {
          const list = this.interactionsSubject.value.map((i) =>
            i._id === id ? { ...i, status: status as any } : i
          );
          this.interactionsSubject.next(list);
          const sel = this.selectedInteractionSubject.value;
          if (sel?._id === id) {
            this.selectedInteractionSubject.next({ ...sel, status: status as any });
          }
        }
      })
    );
  }

  /**
   * Mark conversation chat session open or closed (inbox workflow).
   */
  updateChatOpen(id: string, chatOpen: boolean): Observable<IApiResponse<IInteraction>> {
    return this.apiService.put<IApiResponse<IInteraction>>(`/inbox/${id}/chat-open`, { chatOpen }).pipe(
      tap((response) => {
        if (response.success && response.data) {
          const updated = response.data;
          const list = this.interactionsSubject.value.map((i) =>
            i._id === id ? { ...i, ...updated } : i
          );
          this.interactionsSubject.next(list);
          const sel = this.selectedInteractionSubject.value;
          if (sel?._id === id) {
            this.selectedInteractionSubject.next({ ...sel, ...updated });
          }
        }
      })
    );
  }

  /**
   * Delete interaction. For Facebook comments, deletes on Facebook and in DB; otherwise removes from DB only.
   */
  deleteInteraction(id: string): Observable<IApiResponse> {
    return this.apiService.delete<IApiResponse>(`/inbox/${id}`);
  }

  /**
   * Manually escalate interaction to human agent
   */
  escalate(id: string, reason?: string): Observable<IApiResponse> {
    return this.apiService.post<IApiResponse>(`/inbox/${id}/escalate`, { reason });
  }

  /**
   * Bulk assign interactions to agent
   */
  assignBulk(interactionIds: string[], userId: string): Observable<IApiResponse> {
    return this.apiService.post<IApiResponse>('/inbox/assign-bulk', { interactionIds, userId });
  }

  /**
   * Bulk update interaction status
   */
  updateStatusBulk(interactionIds: string[], status: string): Observable<IApiResponse> {
    return this.apiService.post<IApiResponse>('/inbox/status-bulk', { interactionIds, status });
  }

  /**
   * Bulk add label to interactions
   */
  addLabelBulk(interactionIds: string[], labelId: string): Observable<IApiResponse> {
    return this.apiService.post<IApiResponse>('/inbox/labels-bulk', { interactionIds, labelId });
  }

  /**
   * Set selected interaction
   */
  setSelectedInteraction(interaction: IInteraction | null): void {
    this.selectedInteractionSubject.next(interaction);
  }

  /**
   * Prepend or move an interaction to the top (e.g. from real-time socket).
   */
  prependOrUpdateInteraction(interaction: IInteraction): void {
    const current = this.interactionsSubject.value;
    const idx = current.findIndex(i => i._id === interaction._id);
    const next = idx !== -1
      ? [interaction, ...current.filter((_, i) => i !== idx)]
      : [interaction, ...current];
    this.interactionsSubject.next(next);
  }

  /**
   * Clear all in-memory inbox state.
   * Call on inbox component destroy (route leave) and on logout so stale
   * conversations never appear when a different user opens the inbox.
   */
  clearState(): void {
    this.selectedInteractionSubject.next(null);
    this.interactionsSubject.next([]);
    this.statsSubject.next(null);
  }

  /**
   * Refresh interactions
   */
  refresh(filters?: IInboxFilters): void {
    this.getInteractions(filters).subscribe();
  }

  /**
   * Get current interactions value
   */
  get interactionsValue(): IInteraction[] {
    return this.interactionsSubject.value;
  }

  /**
   * Get current stats value
   */
  get statsValue(): IInboxStats | null {
    return this.statsSubject.value;
  }

  /**
   * Get interactions grouped by intent bucket (kanban board view)
   */
  getBucketView(filters?: any): Observable<IApiResponse<any>> {
    return this.apiService.get<IApiResponse<any>>('/inbox/bucket-view', filters);
  }

  /**
   * Update an interaction's intent bucket (drag-and-drop)
   */
  updateInteractionBucket(interactionId: string, intentBucket: string | null): Observable<IApiResponse<any>> {
    return this.apiService.put<IApiResponse<any>>(`/inbox/${interactionId}/bucket`, { intentBucket });
  }

  getTopicInsights(filters?: any): Observable<IApiResponse<any>> {
    return this.apiService.get<IApiResponse<any>>('/inbox/topic-insights', filters);
  }
}

