import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ThemeService } from '../../core/services/theme.service';
import { PaginationComponent, PaginationMeta } from '../../shared/components/pagination/pagination.component';

export interface PlatformPost {
  platform: string;
  externalId: string;
  connectionId: string;
  connectionName: string;
  text: string;
  createdAt: string;
  permalink: string | null;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | 'carousel' | null;
  contentType?: string;
  likeCount?: number;
  shareCount?: number;
  commentCount?: number;
}

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PaginationComponent],
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.scss']
})
export class ContentComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  posts: PlatformPost[] = [];
  loading = false;
  error: string | null = null;
  syncing = false;
  lastSyncedAt: string | null = null;
  noActiveConnections = false;

  selectedPlatform = 'all';
  selectedContentType = 'all';
  searchQuery = '';

  /** View mode: grid (cards) or list (table) */
  viewMode: 'grid' | 'list' = 'grid';

  /** Sidebar detail panel */
  selectedPost: PlatformPost | null = null;

  platformFilterOptions: string[] = ['facebook', 'instagram'];
  contentTypes: { value: string; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'fas fa-th-large' },
    { value: 'post', label: 'Posts', icon: 'fas fa-image' },
    { value: 'reel', label: 'Reels', icon: 'fas fa-film' },
    { value: 'video', label: 'Videos', icon: 'fas fa-video' },
    { value: 'carousel', label: 'Carousel', icon: 'fas fa-images' },
    { value: 'story', label: 'Stories', icon: 'fas fa-bolt' }
  ];

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalItems = 0;

  constructor(
    private http: HttpClient,
    private themeService: ThemeService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('content_view_mode');
    if (saved === 'list' || saved === 'grid') this.viewMode = saved;

    this.search$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadPosts();
    });

    this.loadPosts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
    localStorage.setItem('content_view_mode', mode);
  }

  // ─── Sidebar detail ──────────────────────────────────────────────────────────

  openDetail(post: PlatformPost): void {
    this.selectedPost = post;
  }

  closeDetail(): void {
    this.selectedPost = null;
  }

  // ─── Existing methods ────────────────────────────────────────────────────────

  onSearchInput(): void {
    this.search$.next(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadPosts();
  }

  openPostComments(post: PlatformPost): void {
    this.router.navigate(['/app/inbox'], {
      queryParams: { platform: post.platform, postId: post.externalId, type: 'comment' }
    });
  }

  setPlatform(platform: string): void {
    this.selectedPlatform = platform;
  }

  loadPosts(): void {
    this.loading = true;
    this.error = null;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.pageSize.toString());

    if (this.selectedPlatform !== 'all') {
      params = params.set('platform', this.selectedPlatform);
    }

    if (this.searchQuery.trim()) {
      params = params.set('search', this.searchQuery.trim());
    }
    if (this.selectedContentType !== 'all') {
      params = params.set('contentType', this.selectedContentType);
    }

    this.http
      .get<{
        success: boolean;
        posts: PlatformPost[];
        meta?: { total: number; platformFilter: string; lastSyncedAt?: string; noActiveConnections?: boolean };
        pagination?: PaginationMeta;
      }>(`${environment.apiUrl}/platform-posts`, { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.posts = res.posts || [];
          this.lastSyncedAt = res.meta?.lastSyncedAt ?? null;
          this.noActiveConnections = res.meta?.noActiveConnections ?? false;
          if (res.pagination) {
            this.totalItems = res.pagination.total;
            this.totalPages = res.pagination.pages;
            this.currentPage = res.pagination.page;
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.message || err?.message || 'Failed to load posts';
          this.posts = [];
          this.loading = false;
        }
      });
  }

  onPlatformChange(): void {
    this.selectedContentType = 'all';
    this.searchQuery = '';
    this.currentPage = 1;
    this.error = null;
    this.closeDetail();
    this.loadPosts();
  }

  setContentType(value: string): void {
    this.selectedContentType = value;
    this.currentPage = 1;
    this.loadPosts();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadPosts();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadPosts();
  }

  syncPosts(): void {
    if (this.selectedPlatform === 'all') return;
    this.syncing = true;
    this.error = null;
    const params = new HttpParams().set('platform', this.selectedPlatform);
    this.http
      .post<{ success: boolean; synced: number; platform: string; message?: string }>(
        `${environment.apiUrl}/platform-posts/sync`,
        {},
        { params }
      )
      .subscribe({
        next: () => {
          this.syncing = false;
          this.currentPage = 1;
          this.loadPosts();
        },
        error: (err) => {
          this.syncing = false;
          this.error = err?.error?.error || err?.error?.message || err?.message || 'Sync failed';
        }
      });
  }

  get showContentTypeFilter(): boolean {
    return true;
  }

  get canSync(): boolean {
    return this.selectedPlatform === 'facebook' || this.selectedPlatform === 'instagram';
  }

  getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      youtube: 'YouTube',
      linkedin: 'LinkedIn',
      google: 'Google',
      google_my_business: 'Google My Business'
    };
    return names[platform] || platform;
  }

  getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook',
      youtube: 'fab fa-youtube',
      google: 'fab fa-google',
      linkedin: 'fab fa-linkedin-in',
      whatsapp: 'fab fa-whatsapp',
      website: 'fas fa-globe'
    };
    return icons[platform?.toLowerCase()] || 'fas fa-share-alt';
  }

  getPlatformColors(platform: string): { primary: string; gradientFrom: string; gradientTo: string } {
    const theme = this.themeService.getTheme(platform);
    return { primary: theme.primaryColor, gradientFrom: theme.gradientFrom, gradientTo: theme.gradientTo };
  }

  getPlatformColor(platform: string): string {
    return this.themeService.getTheme(platform).primaryColor;
  }

  formatDate(iso: string | Date): string {
    return new Date(iso).toLocaleString();
  }

  getRelativeTime(iso: string | Date): string {
    const now = new Date();
    const postDate = new Date(iso);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return this.formatDate(iso);
  }

  truncate(text: string, len = 100): string {
    if (!text) return '';
    return text.length > len ? text.slice(0, len) + '…' : text;
  }
}
