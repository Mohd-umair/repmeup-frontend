import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { Subscription, timer } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(400px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateX(400px)', opacity: 0 }))
      ])
    ])
  ]
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription?: Subscription;
  private readonly dismissTimers = new Map<string, Subscription>();

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notifications$.subscribe(
      (notification) => {
        this.addNotification(notification);
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.dismissTimers.forEach((sub) => sub.unsubscribe());
    this.dismissTimers.clear();
  }

  addNotification(notification: Notification): void {
    console.log('📬 [NotificationComponent] Adding notification:', notification);
    // Add to the list
    this.notifications.push(notification);
    console.log('📋 [NotificationComponent] Total notifications:', this.notifications.length);

    const sub = timer(notification.duration || 4000)
      .pipe(take(1))
      .subscribe(() => this.removeNotification(notification.id));
    this.dismissTimers.set(notification.id, sub);

    // Limit to 5 notifications
    if (this.notifications.length > 5) {
      const oldest = this.notifications[0];
      this.removeNotification(oldest.id);
    }
  }

  removeNotification(id: string): void {
    const sub = this.dismissTimers.get(id);
    if (sub) {
      sub.unsubscribe();
      this.dismissTimers.delete(id);
    }
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success':
        return 'fas fa-check-circle';
      case 'error':
        return 'fas fa-times-circle';
      case 'warning':
        return 'fas fa-exclamation-triangle';
      case 'info':
        return 'fas fa-info-circle';
      default:
        return 'fas fa-bell';
    }
  }

  getIconColor(type: string): string {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  }

  getBorderColor(type: string): string {
    switch (type) {
      case 'success':
        return 'border-l-green-500';
      case 'error':
        return 'border-l-red-500';
      case 'warning':
        return 'border-l-yellow-500';
      case 'info':
        return 'border-l-blue-500';
      default:
        return 'border-l-gray-500';
    }
  }
}

