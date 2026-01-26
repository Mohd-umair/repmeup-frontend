import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  details?: string[]; // For multi-line details
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new Subject<Notification>();
  public notifications$ = this.notificationSubject.asObservable();

  /**
   * Show a success notification
   */
  success(title: string, message?: string, duration = 4000): void {
    this.show({
      id: this.generateId(),
      type: 'success',
      title,
      message,
      duration
    });
  }

  /**
   * Show an error notification
   */
  error(title: string, message?: string, duration = 6000): void {
    this.show({
      id: this.generateId(),
      type: 'error',
      title,
      message,
      duration
    });
  }

  /**
   * Show a warning notification
   */
  warning(title: string, message?: string, duration = 5000): void {
    this.show({
      id: this.generateId(),
      type: 'warning',
      title,
      message,
      duration
    });
  }

  /**
   * Show an info notification
   */
  info(title: string, message?: string, duration = 4000): void {
    this.show({
      id: this.generateId(),
      type: 'info',
      title,
      message,
      duration
    });
  }

  /**
   * Show a notification with detailed list
   */
  showWithDetails(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message?: string,
    details?: string[],
    duration = 8000
  ): void {
    this.show({
      id: this.generateId(),
      type,
      title,
      message,
      details,
      duration
    });
  }

  /**
   * Show a notification
   */
  private show(notification: Notification): void {
    console.log('🔔 [NotificationService] Showing notification:', notification);
    this.notificationSubject.next(notification);
  }

  /**
   * Generate a unique ID for notifications
   */
  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

