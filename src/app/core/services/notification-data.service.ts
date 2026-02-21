import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';

export interface INotification {
  _id: string;
  user: string;
  organization: string;
  type: 'new_interaction' | 'assignment' | 'mention' | 'escalation' | 'negative_spike' | 'response_received' | 'platform_error' | 'system';
  title: string;
  message: string;
  relatedTo?: {
    model: string;
    id: string;
  };
  actionUrl?: string;
  isRead: boolean;
  readAt?: Date;
  deliveryMethod: string[];
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification Data Service - Single Responsibility Principle
 * Manages in-app notifications and badge counts
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationDataService {
  private notificationsSubject = new BehaviorSubject<INotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private pollingInterval = 30000; // 30 seconds
  private polling = false;

  constructor(private apiService: ApiService) {}

  /**
   * Start polling for new notifications
   */
  startPolling(): void {
    if (this.polling) return;
    
    this.polling = true;
    
    // Initial load
    this.refresh();
    
    // Poll every 30 seconds
    interval(this.pollingInterval)
      .pipe(
        switchMap(() => this.getUnreadCount())
      )
      .subscribe();
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    this.polling = false;
  }

  /**
   * Get all notifications
   */
  getNotifications(unreadOnly: boolean = false): Observable<any> {
    const params = unreadOnly ? { unreadOnly: 'true' } : {};
    return this.apiService.get<any>('/notifications', params)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.notificationsSubject.next(response.data);
            if (response.unreadCount !== undefined) {
              this.unreadCountSubject.next(response.unreadCount);
            }
          }
        })
      );
  }

  /**
   * Get unread count
   */
  getUnreadCount(): Observable<IApiResponse<{ count: number }>> {
    // Use silent (no loader) because this is called on a 30-second interval
    return this.apiService.getSilent<IApiResponse<{ count: number }>>('/notifications/unread-count')
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            this.unreadCountSubject.next(response.data.count);
          }
        })
      );
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): Observable<IApiResponse> {
    return this.apiService.put<IApiResponse>(`/notifications/${notificationId}/read`, {})
      .pipe(
        tap(() => {
          // Decrease unread count
          const currentCount = this.unreadCountSubject.value;
          this.unreadCountSubject.next(Math.max(0, currentCount - 1));
        })
      );
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): Observable<IApiResponse> {
    return this.apiService.put<IApiResponse>('/notifications/mark-all-read', {})
      .pipe(
        tap(() => {
          this.unreadCountSubject.next(0);
        })
      );
  }

  /**
   * Delete notification
   */
  deleteNotification(notificationId: string): Observable<IApiResponse> {
    return this.apiService.delete<IApiResponse>(`/notifications/${notificationId}`);
  }

  /**
   * Clear all read notifications
   */
  clearReadNotifications(): Observable<IApiResponse> {
    return this.apiService.delete<IApiResponse>('/notifications/clear-read');
  }

  /**
   * Refresh notifications
   */
  refresh(): void {
    this.getNotifications().subscribe();
  }

  /**
   * Get current unread count (synchronous)
   */
  get unreadCountValue(): number {
    return this.unreadCountSubject.value;
  }
}
