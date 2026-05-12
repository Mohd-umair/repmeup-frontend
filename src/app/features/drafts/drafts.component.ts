import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { validateScheduleDateTimeStrings } from '../../shared/utils/schedule-validation';
import { PaginationComponent, PaginationMeta } from '../../shared/components/pagination/pagination.component';

interface DraftMetadata {
  topic?: string;
  audience?: string;
  intent?: string;
  mood?: string;
  contentType?: string;
  postFormat?: string;
  visualStyle?: string;
  logoOverlay?: boolean;
  logoPosition?: string;
}

interface DraftPost {
  _id: string;
  platform: string;
  postType: string;
  content: string;
  mediaUrl?: string;
  mediaStoragePath?: string;
  mediaType?: 'image' | 'video';
  generatedBy?: string;
  createdAt: string;
  platformConnection?: { platform: string; platformUsername?: string };
  metadata?: DraftMetadata;
}

@Component({
  selector: 'app-drafts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ButtonComponent, PaginationComponent],
  templateUrl: './drafts.component.html'
})
export class DraftsComponent implements OnInit, OnDestroy {
  drafts: DraftPost[] = [];
  loading = true;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalItems = 0;

  /** View mode: grid (cards) or list (table) */
  viewMode: 'grid' | 'list' = 'grid';

  /** Sidebar detail panel */
  selectedDraft: DraftPost | null = null;

  /** Inline edit state */
  editingId: string | null = null;
  editContent = '';
  savingEdit = false;

  /** Schedule modal state */
  schedulingId: string | null = null;
  scheduleDate = '';
  scheduleTime = '';
  scheduling = false;

  /** Publish state */
  publishingId: string | null = null;

  /** Delete state */
  deletingId: string | null = null;

  /** Send-to-approval state */
  sendingApprovalId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('drafts_view_mode');
    if (saved === 'list' || saved === 'grid') this.viewMode = saved;
    this.loadDrafts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
    localStorage.setItem('drafts_view_mode', mode);
  }

  // ─── Sidebar detail ──────────────────────────────────────────────────────────

  openDetail(draft: DraftPost): void {
    this.selectedDraft = draft;
    this.editingId = null;
    this.editContent = '';
  }

  closeDetail(): void {
    this.selectedDraft = null;
    this.editingId = null;
    this.editContent = '';
  }

  // ─── Load ────────────────────────────────────────────────────────────────────

  loadDrafts(): void {
    this.loading = true;
    const params = { page: this.currentPage, limit: this.pageSize };
    this.http
      .get<{ success: boolean; data: DraftPost[]; pagination: PaginationMeta }>(`${environment.apiUrl}/posts/drafts`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.drafts = res.data || [];
          if (res.pagination) {
            this.totalItems = res.pagination.total;
            this.totalPages = res.pagination.pages;
            this.currentPage = res.pagination.page;
          }
          this.loading = false;
        },
        error: () => {
          this.notify.error('Failed to load drafts.');
          this.loading = false;
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadDrafts();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadDrafts();
  }

  // ─── Inline Edit ─────────────────────────────────────────────────────────────

  startEdit(draft: DraftPost): void {
    this.editingId = draft._id;
    this.editContent = draft.content;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editContent = '';
  }

  saveEdit(draft: DraftPost): void {
    if (!this.editContent.trim()) return;
    this.savingEdit = true;
    this.http
      .patch<{ success: boolean; data: DraftPost }>(
        `${environment.apiUrl}/posts/drafts/${draft._id}`,
        { content: this.editContent }
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const idx = this.drafts.findIndex(d => d._id === draft._id);
          if (idx > -1) this.drafts[idx].content = res.data.content;
          if (this.selectedDraft?._id === draft._id) {
            this.selectedDraft = { ...this.selectedDraft, content: res.data.content };
          }
          this.cancelEdit();
          this.savingEdit = false;
          this.notify.success('Draft updated.');
        },
        error: () => {
          this.notify.error('Failed to save changes.');
          this.savingEdit = false;
        }
      });
  }

  // ─── Publish Now ─────────────────────────────────────────────────────────────

  publishDraft(id: string): void {
    if (this.publishingId === id) return;
    this.publishingId = id;
    this.http
      .post<{ success: boolean; message: string; platformPostUrl?: string }>(
        `${environment.apiUrl}/posts/drafts/${id}/publish`,
        {}
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.drafts = this.drafts.filter(d => d._id !== id);
          if (this.selectedDraft?._id === id) this.closeDetail();
          this.publishingId = null;
          this.notify.success('Published!', res.message || 'Draft published successfully.');
        },
        error: (err) => {
          this.publishingId = null;
          const msg = err?.error?.message || err?.error?.error || 'Could not publish draft.';
          this.notify.error('Publish Failed', msg);
        }
      });
  }

  // ─── Schedule ────────────────────────────────────────────────────────────────

  openSchedule(draft: DraftPost): void {
    this.schedulingId = draft._id;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.scheduleDate = tomorrow.toISOString().split('T')[0];
    this.scheduleTime = '09:00';
  }

  closeSchedule(): void {
    this.schedulingId = null;
    this.scheduleDate = '';
    this.scheduleTime = '';
  }

  submitSchedule(): void {
    if (!this.scheduleDate || !this.scheduleTime || !this.schedulingId) return;
    const v = validateScheduleDateTimeStrings(this.scheduleDate, this.scheduleTime);
    if (!v.ok) {
      this.notify.error('Schedule', v.message);
      return;
    }
    this.scheduling = true;
    const scheduledFor = v.scheduled.toISOString();
    this.http
      .patch<{ success: boolean }>(
        `${environment.apiUrl}/posts/drafts/${this.schedulingId}/schedule`,
        { scheduledFor }
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.drafts = this.drafts.filter(d => d._id !== this.schedulingId);
          if (this.selectedDraft?._id === this.schedulingId) this.closeDetail();
          this.closeSchedule();
          this.scheduling = false;
          this.notify.success('Draft scheduled successfully!');
        },
        error: () => {
          this.notify.error('Failed to schedule draft.');
          this.scheduling = false;
        }
      });
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  deleteDraft(id: string): void {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    this.deletingId = id;
    this.http
      .delete<{ success: boolean }>(`${environment.apiUrl}/posts/drafts/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.drafts = this.drafts.filter(d => d._id !== id);
          if (this.selectedDraft?._id === id) this.closeDetail();
          this.deletingId = null;
          this.notify.success('Draft deleted.');
        },
        error: () => {
          this.notify.error('Failed to delete draft.');
          this.deletingId = null;
        }
      });
  }

  // ─── Send to Approval ────────────────────────────────────────────────────────

  sendToApproval(id: string): void {
    if (this.sendingApprovalId === id) return;
    this.sendingApprovalId = id;
    this.http
      .patch<{ success: boolean; message: string }>(
        `${environment.apiUrl}/posts/drafts/${id}/send-to-approval`,
        {}
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.drafts = this.drafts.filter(d => d._id !== id);
          if (this.selectedDraft?._id === id) this.closeDetail();
          this.sendingApprovalId = null;
          this.notify.success('Sent for approval!', res.message || 'Post moved to the Approval Queue.');
        },
        error: (err) => {
          this.sendingApprovalId = null;
          const msg = err?.error?.message || err?.error?.error || 'Could not send for approval.';
          this.notify.error('Failed', msg);
        }
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  truncate(text: string, len = 120): string {
    return text.length > len ? text.slice(0, len) + '…' : text;
  }

  getPlatformIcon(platform: string): string {
    const map: Record<string, string> = {
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook',
      linkedin: 'fab fa-linkedin',
      twitter: 'fab fa-x-twitter',
      youtube: 'fab fa-youtube',
      whatsapp: 'fab fa-whatsapp'
    };
    return map[platform?.toLowerCase()] ?? 'fas fa-globe';
  }

  getPlatformLabel(platform: string): string {
    const map: Record<string, string> = {
      instagram: 'Instagram',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
      twitter: 'X / Twitter',
      youtube: 'YouTube',
      whatsapp: 'WhatsApp'
    };
    return map[platform?.toLowerCase()] ?? platform;
  }

  getPostTypeLabel(type: string): string {
    const map: Record<string, string> = {
      post: 'Post',
      story: 'Story',
      reel: 'Reel',
      short: 'Short',
      video: 'Video'
    };
    return map[type?.toLowerCase()] ?? type ?? 'Post';
  }

  getContentTypeLabel(ct: string): string {
    const map: Record<string, string> = {
      'text': 'Text',
      'text-image': 'Text + Image',
      'text-video': 'Text + Video',
      'image-layover': 'Image Layover'
    };
    return map[ct] ?? ct;
  }

  resolveMediaUrl(draft: DraftPost): string | null {
    if (draft.mediaUrl) return draft.mediaUrl;
    if (draft.mediaStoragePath) {
      const filename = draft.mediaStoragePath.split('/').pop();
      return `${environment.apiUrl}/posts/media/${filename}`;
    }
    return null;
  }
}
