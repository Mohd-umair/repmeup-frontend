import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Media } from '../../core/models/media.model';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MediaSelectorModalComponent } from '../../shared/components/media-selector-modal/media-selector-modal.component';
import { AuthService } from '../../core/services/auth.service';
import { PaginationComponent, PaginationMeta } from '../../shared/components/pagination/pagination.component';

export interface PostUser {
  name: string;
  email: string;
}

export interface PendingPost {
  _id: string;
  content: string;
  originalContent?: string;
  platform: string;
  generatedBy: 'ai' | 'human';
  riskScore?: number;
  complianceFlags?: string[];
  scheduledFor?: string;
  platformConnection?: { platform: string; platformUsername?: string };
  user?: PostUser;
  status: 'pending_approval' | 'rejected' | 'draft' | 'scheduled' | 'published';
  rejectedReason?: string;
  rejectedBy?: { name: string };
  rejectedAt?: string;
  approvedBy?: { name: string };
  approvedAt?: string;
  // Media fields
  mediaUrl?: string;
  mediaStoragePath?: string;
  mediaStoragePaths?: string[];
  mediaType?: 'image' | 'video';
  mediaTypes?: ('image' | 'video')[];
  postType?: string;
  platformPostUrl?: string;
}

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, ButtonComponent, MediaSelectorModalComponent, PaginationComponent],
  templateUrl: './approval-queue.component.html',
  styleUrls: ['./approval-queue.component.scss']
})
export class ApprovalQueueComponent implements OnInit {
  posts: PendingPost[] = [];
  loading = true;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalItems = 0;

  selectedId: string | null = null;
  selectedPost: PendingPost | null = null;
  filterPlatform = '';
  filterRisk = '';
  filterStatus = '';
  selectedIds = new Set<string>();
  bulkApproving = false;
  showBulkConfirm = false;
  rejectReason = '';
  showRejectModal = false;
  rejectingId: string | null = null;
  approvingId: string | null = null;
  scheduleDate = '';
  scheduleTime = '';
  showScheduleModal = false;

  // Edit & resubmit (agent) — sidebar panel
  agentEditMode = false;
  agentEditContent = '';
  agentSelectedLibraryMedia: Media | null = null;
  showAgentMediaLibrary = false;
  agentSaving = false;
  agentEditError = '';

  // Approve feedback
  approveSuccess = '';
  approveError = '';

  // Admin: edit pending post before approve (panel starts read-only; edit mode after "Edit post")
  adminEditMode = false;
  adminEditContent = '';
  /** Staged replacement from media library (saved on Save / approve flow) */
  adminSelectedLibraryMedia: Media | null = null;
  showAdminMediaLibrary = false;
  adminSavingPending = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  get isAgent(): boolean {
    return this.authService.currentUserValue?.role === 'agent';
  }

  get pageTitle(): string {
    return this.isAgent ? 'My Approval History' : 'Pending Approval';
  }

  get pendingPosts(): PendingPost[] {
    return this.filteredPosts.filter(p => p.status === 'pending_approval');
  }

  get allPendingSelected(): boolean {
    return this.pendingPosts.length > 0 && this.selectedIds.size === this.pendingPosts.length;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    // Agents load full history; admins/managers load only pending queue
    const endpoint = this.isAgent
      ? `${environment.apiUrl}/posts/approval-history`
      : `${environment.apiUrl}/posts/pending-approval`;

    const params = { page: this.currentPage, limit: this.pageSize };

    this.http.get<{ success: boolean; data: PendingPost[]; pagination: PaginationMeta }>(endpoint, { params }).subscribe({
      next: (res) => {
        this.posts = res.success && res.data ? res.data : [];
        if (res.pagination) {
          this.totalItems = res.pagination.total;
          this.totalPages = res.pagination.pages;
          this.currentPage = res.pagination.page;
        }
        this.loading = false;
      },
      error: () => {
        this.posts = [];
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.selectedIds.clear();
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.selectedIds.clear();
    this.load();
  }

  get filteredPosts(): PendingPost[] {
    let list = this.posts;
    if (this.filterPlatform) {
      list = list.filter(p => p.platform?.toLowerCase() === this.filterPlatform.toLowerCase());
    }
    if (this.filterRisk === 'high') {
      list = list.filter(p => (p.riskScore ?? 0) >= 70);
    } else if (this.filterRisk === 'low') {
      list = list.filter(p => (p.riskScore ?? 0) < 70);
    }
    if (this.filterStatus) {
      if (this.filterStatus === 'approved') {
        list = list.filter(p => p.status === 'draft' || p.status === 'scheduled' || p.status === 'published');
      } else {
        list = list.filter(p => p.status === this.filterStatus);
      }
    }
    return list;
  }

  isApproved(post: PendingPost): boolean {
    return post.status === 'draft' || post.status === 'scheduled' || post.status === 'published';
  }

  /** Media URL for sidebar: staged library pick, then post asset */
  sidebarMediaUrl(post: PendingPost | null): string | null {
    if (!post) return null;
    if (this.adminSelectedLibraryMedia?.publicUrl) {
      return this.adminSelectedLibraryMedia.publicUrl;
    }
    return this.resolveMediaUrl(post);
  }

  sidebarMediaIsVideo(post: PendingPost | null): boolean {
    if (!post) return false;
    if (this.adminSelectedLibraryMedia) {
      return this.adminSelectedLibraryMedia.mediaType === 'video';
    }
    return post.mediaType === 'video' || post.mediaTypes?.[0] === 'video';
  }

  /** Default panel: saved post media only; edit mode: include unsaved replacement preview */
  detailPanelMediaUrl(post: PendingPost | null): string | null {
    if (!post) return null;
    if (!this.isAgent && post.status === 'pending_approval' && this.adminEditMode) {
      return this.sidebarMediaUrl(post);
    }
    return this.resolveMediaUrl(post);
  }

  detailPanelMediaIsVideo(post: PendingPost | null): boolean {
    if (!post) return false;
    if (!this.isAgent && post.status === 'pending_approval' && this.adminEditMode) {
      return this.sidebarMediaIsVideo(post);
    }
    return post.mediaType === 'video' || post.mediaTypes?.[0] === 'video';
  }

  resolveMediaUrl(post: PendingPost): string | null {
    // Prefer direct URL fields first
    if (post.mediaUrl && /^https?:\/\//i.test(post.mediaUrl)) return post.mediaUrl;
    // Resolve from storage path (local file served by the API, or S3 URL)
    const path = post.mediaStoragePath || (post.mediaStoragePaths?.[0] ?? null);
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const filename = path.split('/').pop();
    return filename ? `${environment.apiUrl}/posts/media/${filename}` : null;
  }

  openDetail(post: PendingPost): void {
    this.selectedId = post._id;
    this.selectedPost = post;
    this.resetAdminEditState(post);
    this.agentEditMode = false;
    this.agentEditContent = '';
    this.agentSelectedLibraryMedia = null;
    this.agentEditError = '';
  }

  closeDetail(): void {
    this.showAdminMediaLibrary = false;
    this.showAgentMediaLibrary = false;
    this.selectedId = null;
    this.selectedPost = null;
    this.adminEditMode = false;
    this.clearAdminMediaReplacement();
    this.adminEditContent = '';
    this.agentEditMode = false;
    this.agentEditContent = '';
    this.agentSelectedLibraryMedia = null;
    this.agentEditError = '';
  }

  private resetAdminEditState(post: PendingPost): void {
    this.adminEditMode = false;
    this.clearAdminMediaReplacement();
    this.adminEditContent = post.content || '';
  }

  startAdminEditMode(): void {
    if (this.isAgent || !this.selectedPost || this.selectedPost.status !== 'pending_approval') return;
    this.adminEditMode = true;
    this.adminEditContent = this.selectedPost.content || '';
    this.clearAdminMediaReplacement();
  }

  cancelAdminEditMode(): void {
    this.showAdminMediaLibrary = false;
    this.adminEditMode = false;
    this.clearAdminMediaReplacement();
    if (this.selectedPost) {
      this.adminEditContent = this.selectedPost.content || '';
    }
  }

  clearAdminMediaReplacement(): void {
    this.adminSelectedLibraryMedia = null;
  }

  openAdminMediaLibrary(): void {
    this.showAdminMediaLibrary = true;
  }

  onAdminMediaLibrarySelect(payload: Media | Media[]): void {
    const item = Array.isArray(payload) ? payload[0] : payload;
    this.showAdminMediaLibrary = false;
    if (!item) return;
    if (item.mediaType === 'audio') {
      this.approveError = 'Choose an image or video from the library.';
      setTimeout(() => { this.approveError = ''; }, 6000);
      return;
    }
    this.adminSelectedLibraryMedia = item;
  }

  saveAdminPendingEdits(): void {
    if (!this.selectedPost || this.isAgent || this.selectedPost.status !== 'pending_approval') return;
    const post = this.selectedPost;
    const contentChanged = this.adminEditContent.trim() !== (post.content || '').trim();
    const mediaStaged = !!this.adminSelectedLibraryMedia;
    if (!contentChanged && !mediaStaged) {
      this.approveSuccess = 'No changes to save.';
      setTimeout(() => { this.approveSuccess = ''; }, 3000);
      return;
    }
    if (!this.adminEditContent.trim()) {
      this.approveError = 'Post text cannot be empty.';
      setTimeout(() => { this.approveError = ''; }, 5000);
      return;
    }

    this.adminSavingPending = true;
    this.approveError = '';
    this.saveAdminPendingEditsRequest(post).subscribe({
      next: (data) => {
        this.adminSavingPending = false;
        this.patchPostInList(data);
        this.selectedPost = data;
        this.adminEditContent = data.content || '';
        this.clearAdminMediaReplacement();
        this.adminEditMode = false;
        this.approveSuccess = 'Post updated.';
        setTimeout(() => { this.approveSuccess = ''; }, 4000);
      },
      error: (err) => {
        this.adminSavingPending = false;
        this.approveError = err?.error?.message || err?.error?.error || 'Failed to save changes.';
        setTimeout(() => { this.approveError = ''; }, 7000);
      }
    });
  }

  private saveAdminPendingEditsRequest(post: PendingPost): Observable<PendingPost> {
    const form = new FormData();
    if (this.adminEditContent.trim()) {
      form.append('content', this.adminEditContent.trim());
    }
    if (this.adminSelectedLibraryMedia) {
      form.append('mediaLibraryId', this.adminSelectedLibraryMedia._id);
    }
    return this.http.patch<{ success: boolean; data: PendingPost }>(
      `${environment.apiUrl}/posts/${post._id}/update-pending`,
      form
    ).pipe(
      map((res) => {
        if (!res?.success || !res.data) {
          throw new Error('Invalid response from server');
        }
        return res.data;
      })
    );
  }

  private patchPostInList(updated: PendingPost): void {
    const i = this.posts.findIndex((p) => p._id === updated._id);
    if (i >= 0) {
      this.posts[i] = { ...this.posts[i], ...updated };
    }
  }

  /** Saves sidebar edits when needed; completes without HTTP when nothing to save */
  private ensureAdminEditsSaved(post: PendingPost): Observable<void> {
    // Only attempt to save if the admin explicitly entered edit mode for this post.
    // If edit mode is off (e.g. approve/reject clicked directly from the table),
    // there is nothing to persist.
    if (this.isAgent || post.status !== 'pending_approval' || !this.adminEditMode) {
      return of(undefined);
    }
    const contentChanged = this.adminEditContent.trim() !== (post.content || '').trim();
    const mediaStaged = !!this.adminSelectedLibraryMedia;
    if (!contentChanged && !mediaStaged) {
      return of(undefined);
    }
    if (!this.adminEditContent.trim()) {
      this.approveError = 'Post text cannot be empty. Fix the copy before continuing.';
      setTimeout(() => { this.approveError = ''; }, 7000);
      return throwError(() => new Error('empty content'));
    }

    this.adminSavingPending = true;
    this.approveError = '';
    return this.saveAdminPendingEditsRequest(post).pipe(
      tap((data) => {
        this.patchPostInList(data);
        if (this.selectedPost?._id === data._id) {
          this.selectedPost = data;
          this.adminEditContent = data.content || '';
        }
        this.clearAdminMediaReplacement();
        this.adminEditMode = false;
      }),
      switchMap(() => of(undefined)),
      catchError((err) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Failed to save changes.';
        this.approveError = msg;
        setTimeout(() => { this.approveError = ''; }, 7000);
        return throwError(() => err);
      }),
      finalize(() => {
        this.adminSavingPending = false;
      })
    );
  }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleSelectAll(): void {
    const pending = this.filteredPosts.filter(p => p.status === 'pending_approval');
    if (this.selectedIds.size === pending.length) {
      this.selectedIds.clear();
    } else {
      pending.forEach(p => this.selectedIds.add(p._id));
    }
  }

  openBulkConfirm(): void {
    if (this.selectedIds.size === 0) return;
    this.showBulkConfirm = true;
  }

  bulkApprove(): void {
    const ids = Array.from(this.selectedIds);
    this.bulkApproving = true;
    const next = (i: number) => {
      if (i >= ids.length) {
        this.bulkApproving = false;
        this.showBulkConfirm = false;
        this.selectedIds.clear();
        this.approveSuccess = `${ids.length} post(s) approved and published.`;
        this.load();
        setTimeout(() => { this.approveSuccess = ''; }, 5000);
        return;
      }
      this.http.patch(`${environment.apiUrl}/posts/${ids[i]}/approve`, {}).subscribe({
        next: () => next(i + 1),
        error: () => next(i + 1)
      });
    };
    next(0);
  }

  approve(post: PendingPost): void {
    this.approveSuccess = '';
    this.approveError = '';
    this.ensureAdminEditsSaved(post).subscribe({
      next: () => {
        this.approvingId = post._id;
        this.http.patch<{ success: boolean; published?: boolean; scheduled?: boolean; platformPostUrl?: string }>(
          `${environment.apiUrl}/posts/${post._id}/approve`, {}
        ).subscribe({
          next: (res) => {
            this.approvingId = null;
            this.approveSuccess = res.published
              ? `Post published successfully!${res.platformPostUrl ? ' View: ' + res.platformPostUrl : ''}`
              : 'Post approved and scheduled.';
            this.closeDetail();
            this.load();
            setTimeout(() => { this.approveSuccess = ''; }, 5000);
          },
          error: (err) => {
            this.approvingId = null;
            const msg = err?.error?.message || err?.error?.error || 'Approval failed. Please try again.';
            this.approveError = msg;
            setTimeout(() => { this.approveError = ''; }, 7000);
          }
        });
      },
      error: () => {}
    });
  }

  openScheduleModal(post: PendingPost): void {
    this.selectedPost = post;
    this.showScheduleModal = true;
  }

  confirmSchedule(): void {
    if (!this.selectedPost || !this.scheduleDate || !this.scheduleTime) return;
    const scheduledFor = new Date(`${this.scheduleDate}T${this.scheduleTime}`).toISOString();
    const post = this.selectedPost;
    this.approveSuccess = '';
    this.approveError = '';
    this.ensureAdminEditsSaved(post).subscribe({
      next: () => {
        this.http.patch<{ success: boolean; scheduled?: boolean }>(
          `${environment.apiUrl}/posts/${post._id}/approve`, { scheduledFor }
        ).subscribe({
          next: () => {
            this.showScheduleModal = false;
            this.scheduleDate = '';
            this.scheduleTime = '';
            this.approveSuccess = 'Post approved and scheduled successfully!';
            this.closeDetail();
            this.load();
            setTimeout(() => { this.approveSuccess = ''; }, 5000);
          },
          error: (err) => {
            this.approveError = err?.error?.message || 'Failed to schedule the post.';
            setTimeout(() => { this.approveError = ''; }, 7000);
          }
        });
      },
      error: () => {}
    });
  }

  openRejectModal(post: PendingPost): void {
    this.rejectReason = '';
    this.rejectingId = post._id;
    this.showRejectModal = true;
  }

  confirmReject(): void {
    if (!this.rejectingId) return;
    const post =
      this.selectedPost?._id === this.rejectingId
        ? this.selectedPost
        : this.posts.find((p) => p._id === this.rejectingId);

    const runReject = () => {
      this.http.patch(`${environment.apiUrl}/posts/${this.rejectingId}/reject`, { reason: this.rejectReason }).subscribe({
        next: () => {
          this.showRejectModal = false;
          this.rejectingId = null;
          this.rejectReason = '';
          this.closeDetail();
          this.load();
        },
        error: (err) => {
          this.approveError = err?.error?.message || err?.error?.error || 'Rejection failed. Please try again.';
          setTimeout(() => { this.approveError = ''; }, 7000);
        }
      });
    };

    if (post && !this.isAgent && post.status === 'pending_approval') {
      this.ensureAdminEditsSaved(post).subscribe({
        next: () => runReject(),
        error: () => {}
      });
    } else {
      runReject();
    }
  }

  // ── Edit & Resubmit (agent) — sidebar panel ──────────────────────────────

  startEdit(post: PendingPost): void {
    this.selectedId = post._id;
    this.selectedPost = post;
    this.resetAdminEditState(post);
    this.agentEditMode = true;
    this.agentEditContent = post.content;
    this.agentSelectedLibraryMedia = null;
    this.agentEditError = '';
  }

  startAgentEditMode(): void {
    if (!this.isAgent || !this.selectedPost || this.selectedPost.status !== 'rejected') return;
    this.agentEditMode = true;
    this.agentEditContent = this.selectedPost.content;
    this.agentSelectedLibraryMedia = null;
    this.agentEditError = '';
  }

  cancelAgentEditMode(): void {
    this.agentEditMode = false;
    this.agentEditContent = '';
    this.agentSelectedLibraryMedia = null;
    this.showAgentMediaLibrary = false;
    this.agentEditError = '';
  }

  openAgentMediaLibrary(): void {
    this.showAgentMediaLibrary = true;
  }

  onAgentMediaLibrarySelect(payload: Media | Media[]): void {
    const item = Array.isArray(payload) ? payload[0] : payload;
    this.showAgentMediaLibrary = false;
    if (!item) return;
    if (item.mediaType === 'audio') {
      this.agentEditError = 'Choose an image or video from the library.';
      setTimeout(() => { this.agentEditError = ''; }, 6000);
      return;
    }
    this.agentSelectedLibraryMedia = item;
  }

  agentResubmit(): void {
    if (!this.selectedPost || !this.agentEditContent.trim()) {
      this.agentEditError = 'Post content cannot be empty.';
      return;
    }
    this.agentSaving = true;
    this.agentEditError = '';
    const body: any = { content: this.agentEditContent.trim() };
    if (this.agentSelectedLibraryMedia) {
      body.mediaLibraryId = this.agentSelectedLibraryMedia._id;
    }
    this.http.patch<any>(`${environment.apiUrl}/posts/${this.selectedPost._id}/resubmit`, body).subscribe({
      next: () => {
        this.agentSaving = false;
        this.cancelAgentEditMode();
        this.closeDetail();
        this.approveSuccess = 'Post resubmitted for approval.';
        this.load();
        setTimeout(() => { this.approveSuccess = ''; }, 5000);
      },
      error: (err) => {
        this.agentSaving = false;
        this.agentEditError = err?.error?.message || err?.error?.error || 'Failed to resubmit. Please try again.';
      }
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  platformName(p: PendingPost): string {
    return p.platform === 'instagram' ? 'Instagram'
      : p.platform === 'facebook' ? 'Facebook'
      : p.platform === 'linkedin' ? 'LinkedIn'
      : p.platform || '';
  }

  statusLabel(post: PendingPost): string {
    if (post.status === 'pending_approval') return 'Pending';
    if (post.status === 'rejected') return 'Rejected';
    if (post.status === 'published') return 'Published';
    if (post.status === 'scheduled') return 'Scheduled';
    if (post.status === 'draft') return 'Approved';
    return post.status;
  }

  statusClass(post: PendingPost): string {
    if (post.status === 'pending_approval') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    if (post.status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (post.status === 'published') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (post.status === 'scheduled') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
}
