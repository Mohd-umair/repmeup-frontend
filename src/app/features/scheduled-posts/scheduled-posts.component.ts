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
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
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

  /** Reschedule modal state */
  rescheduleId: string | null = null;
  rescheduleDate = '';
  rescheduleTime = '';
  rescheduling = false;

  /** View mode: grid (cards) or list (table) */
  viewMode: 'grid' | 'list' = 'grid';

  /** Sidebar detail panel */
  selectedPost: ScheduledPost | null = null;

  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('scheduled_view_mode');
    if (saved === 'list' || saved === 'grid') this.viewMode = saved;
    this.loadPosts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
    localStorage.setItem('scheduled_view_mode', mode);
  }

  // ─── Sidebar detail ────────────────────────────────────────────────────────

  openDetail(post: ScheduledPost): void {
    this.selectedPost = post;
  }

  closeDetail(): void {
    this.selectedPost = null;
  }

  // ─── Load ──────────────────────────────────────────────────────────────────

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

  // ─── Reschedule ────────────────────────────────────────────────────────────

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
          const updated = this.posts.find(p => p._id === this.rescheduleId);
          if (updated) updated.scheduledFor = scheduledFor;
          if (this.selectedPost?._id === this.rescheduleId) {
            this.selectedPost = { ...this.selectedPost, scheduledFor };
          }
          this.closeReschedule();
          this.notify.success('Rescheduled', 'Post rescheduled successfully.');
        },
        error: (err) => {
          this.rescheduling = false;
          this.notify.error('Failed', err?.error?.message || 'Failed to reschedule.');
        }
      });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  deletePost(id: string): void {
    this.deletingId = id;
    this.http.delete<any>(`${environment.apiUrl}/posts/scheduled/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.deletingId = null;
          this.posts = this.posts.filter(p => p._id !== id);
          if (this.selectedPost?._id === id) this.closeDetail();
          this.notify.success('Deleted', 'Scheduled post deleted.');
        },
        error: (err) => {
          this.deletingId = null;
          this.notify.error('Failed', err?.error?.message || 'Failed to delete post.');
        }
      });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  resolveMediaUrl(post: ScheduledPost): string | null {
    if (post.mediaUrl) return post.mediaUrl;
    if (post.mediaStoragePath) return post.mediaStoragePath;
    return null;
  }

  getPlatformIcon(platform: string): string {
    const map: Record<string, string> = {
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook',
      linkedin: 'fab fa-linkedin',
      twitter: 'fab fa-x-twitter',
      x: 'fab fa-x-twitter'
    };
    return map[platform?.toLowerCase()] || 'fas fa-share-nodes';
  }

  getPlatformColor(platform: string): string {
    const map: Record<string, string> = {
      instagram: 'text-pink-500',
      facebook: 'text-blue-500',
      linkedin: 'text-blue-600',
      twitter: 'text-gray-900 dark:text-white',
      x: 'text-gray-900 dark:text-white'
    };
    return map[platform?.toLowerCase()] || 'text-gray-500';
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
}
