import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import { IInteraction, IInboxFilters, IInboxStats } from '../models/interaction.model';

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
   * Get all interactions with filters
   */
  getInteractions(filters?: IInboxFilters): Observable<IApiResponse<any>> {
    return this.apiService.get<IApiResponse<any>>('/inbox', filters)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.interactionsSubject.next(response.data.interactions || []);
          }
        })
      );
  }

  /**
   * Get single interaction by ID
   */
  getInteraction(id: string): Observable<IApiResponse<IInteraction>> {
    return this.apiService.get<IApiResponse<IInteraction>>(`/inbox/${id}`)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.selectedInteractionSubject.next(response.data);
          }
        })
      );
  }

  /**
   * Get inbox statistics
   */
  getStats(): Observable<IApiResponse<IInboxStats>> {
    return this.apiService.get<IApiResponse<IInboxStats>>('/inbox/stats')
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
  replyToInteraction(id: string, content: string, useTemplate?: boolean, templateId?: string): Observable<IApiResponse> {
    return this.apiService.post<IApiResponse>(`/inbox/${id}/reply`, {
      content,
      useTemplate,
      templateId
    });
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
    return this.apiService.put<IApiResponse>(`/inbox/${id}/status`, { status });
  }

  /**
   * Set selected interaction
   */
  setSelectedInteraction(interaction: IInteraction | null): void {
    this.selectedInteractionSubject.next(interaction);
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
}

