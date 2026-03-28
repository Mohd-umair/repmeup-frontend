import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

interface ScheduledPost {
  _id: string;
  platform: string;
  content: string;
  scheduledFor: string;
  status: string;
  postType: string;
  mediaStoragePath?: string;
  platformConnection?: { platform: string; platformUsername?: string };
}

@Component({
  selector: 'app-scheduled-posts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ButtonComponent],
  templateUrl: './scheduled-posts.component.html'
})
export class ScheduledPostsComponent implements OnInit, OnDestroy {
  posts: ScheduledPost[] = [];
  loading = true;
  deletingId: string | null = null;
  rescheduleId: string | null = null;
  rescheduleDate = '';
  rescheduleTime = '';
  rescheduling = false;

  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPosts(): void {
    this.loading = true;
    this.http.get<{ success: boolean; data: ScheduledPost[] }>(`${environment.apiUrl}/posts/scheduled`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.posts = res.data || [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.notify.error('Error', 'Failed to load scheduled posts.');
        }
      });
  }

  getPlatformIcon(platform: string): string {
    const map: Record<string, string> = {
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook',
      linkedin: 'fab fa-linkedin',
      twitter: 'fab fa-x-twitter',
      x: 'fab fa-x-twitter'
    };
    return map[platform?.toLowerCase()] || 'fas fa-share-alt';
  }

  getPlatformLabel(platform: string): string {
    const map: Record<string, string> = {
      instagram: 'Instagram',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
      twitter: 'X',
      x: 'X'
    };
    return map[platform?.toLowerCase()] || platform;
  }

  truncate(text: string, len = 120): string {
    if (!text) return '';
    return text.length > len ? text.slice(0, len).trim() + '…' : text;
  }

  openReschedule(post: ScheduledPost): void {
    this.rescheduleId = post._id;
    const d = new Date(post.scheduledFor);
    this.rescheduleDate = d.toISOString().split('T')[0];
    this.rescheduleTime = d.toTimeString().slice(0, 5);
  }

  closeReschedule(): void {
    this.rescheduleId = null;
    this.rescheduleDate = '';
    this.rescheduleTime = '';
  }

  submitReschedule(): void {
    if (!this.rescheduleId || !this.rescheduleDate || !this.rescheduleTime) return;
    this.rescheduling = true;
    const scheduledFor = new Date(`${this.rescheduleDate}T${this.rescheduleTime}`).toISOString();
    this.http.patch<any>(`${environment.apiUrl}/posts/scheduled/${this.rescheduleId}/reschedule`, { scheduledFor })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.rescheduling = false;
          this.closeReschedule();
          this.notify.success('Rescheduled', 'Post rescheduled successfully.');
          this.loadPosts();
        },
        error: (err) => {
          this.rescheduling = false;
          this.notify.error('Failed', err?.error?.message || 'Failed to reschedule.');
        }
      });
  }

  deletePost(id: string): void {
    this.deletingId = id;
    this.http.delete<any>(`${environment.apiUrl}/posts/scheduled/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.deletingId = null;
          this.posts = this.posts.filter(p => p._id !== id);
          this.notify.success('Deleted', 'Scheduled post deleted.');
        },
        error: (err) => {
          this.deletingId = null;
          this.notify.error('Failed', err?.error?.message || 'Failed to delete post.');
        }
      });
  }
}
