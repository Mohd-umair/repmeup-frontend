import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ThemeService } from '../../core/services/theme.service';

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
  commentCount?: number;
}

export interface RepMeUpPublishedPost {
  _id?: string;
  platform: string;
  platformConnection?: {
    platform: string;
    platformUsername: string;
  };
  content: string;
  mediaUrls?: string[];
  mediaStoragePath?: string;
  status: string;
  publishedAt?: Date;
  platformPostId?: string;
  platformPostUrl?: string;
}

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.scss']
})
export class ContentComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  posts: PlatformPost[] = [];
  loading = false;
  error: string | null = null;
  syncing = false;
  lastSyncedAt: string | null = null;
  selectedPlatform = 'all';
  selectedContentType = 'all';
  platformFilterOptions: string[] = ['facebook', 'instagram'];
  contentTypes: { value: string; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'fas fa-th-large' },
    { value: 'post', label: 'Posts', icon: 'fas fa-image' },
    { value: 'reel', label: 'Reels', icon: 'fas fa-film' },
    { value: 'video', label: 'Videos', icon: 'fas fa-video' },
    { value: 'carousel', label: 'Carousel', icon: 'fas fa-images' },
    { value: 'story', label: 'Stories', icon: 'fas fa-bolt' }
  ];

  /** `library` = platform posts from Meta; `published` = posts published via RepMeUp */
  contentView: 'library' | 'published' = 'library';

  repMeUpPublished: RepMeUpPublishedPost[] = [];
  publishedLoading = false;
  pubPlatform = 'all';
  pubSearch = '';

  constructor(
    private http: HttpClient,
    private themeService: ThemeService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  get publishedTotalCount(): number {
    return this.repMeUpPublished.length;
  }

  ngOnInit(): void {
    this.posts = [];
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.contentView = params.get('view') === 'published' ? 'published' : 'library';
    });
    this.loadRepMeUpPublished();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setContentView(view: 'library' | 'published'): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: view === 'published' ? { view: 'published' } : { view: null },
      replaceUrl: true
    });
  }

  loadRepMeUpPublished(): void {
    this.publishedLoading = true;
    this.http.get<{ posts?: RepMeUpPublishedPost[] }>(`${environment.apiUrl}/posts/published`).subscribe({
      next: (response) => {
        this.repMeUpPublished = response.posts || [];
        this.publishedLoading = false;
      },
      error: () => {
        this.repMeUpPublished = [];
        this.publishedLoading = false;
      }
    });
  }

  getFilteredRepMeUpPublished(): RepMeUpPublishedPost[] {
    return this.repMeUpPublished.filter((post) => {
      const platformMatch = this.pubPlatform === 'all' || post.platform === this.pubPlatform;
      const searchMatch =
        !this.pubSearch || post.content.toLowerCase().includes(this.pubSearch.toLowerCase());
      return platformMatch && searchMatch;
    });
  }

  getUniqueRepMeUpPlatforms(): string[] {
    const platforms = new Set<string>();
    this.repMeUpPublished.forEach((post) => {
      if (post.platform) platforms.add(post.platform);
    });
    return Array.from(platforms);
  }

  getPostsPerWeekRepMeUp(): number {
    return this.repMeUpPublished.length > 0 ? Math.ceil(this.repMeUpPublished.length / 7) : 0;
  }

  openPostComments(post: PlatformPost): void {
    this.router.navigate(['/app/inbox'], {
      queryParams: {
        platform: post.platform,
        postId: post.externalId,
        type: 'comment'
      }
    });
  }

  setPlatform(platform: string): void {
    this.selectedPlatform = platform;
  }

  loadPosts(): void {
    if (this.selectedPlatform === 'all') {
      this.posts = [];
      this.lastSyncedAt = null;
      return;
    }
    this.loading = true;
    this.error = null;
    const params = new HttpParams().set('platform', this.selectedPlatform);
    this.http
      .get<{
        success: boolean;
        posts: PlatformPost[];
        meta?: { total: number; platformFilter: string; lastSyncedAt?: string };
      }>(`${environment.apiUrl}/platform-posts`, { params })
      .subscribe({
        next: (res) => {
          this.posts = res.posts || [];
          this.lastSyncedAt = res.meta?.lastSyncedAt ?? null;
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
    this.error = null;
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
          this.loadPosts();
        },
        error: (err) => {
          this.syncing = false;
          this.error = err?.error?.error || err?.error?.message || err?.message || 'Sync failed';
        }
      });
  }

  setContentType(value: string): void {
    this.selectedContentType = value;
  }

  get showContentTypeFilter(): boolean {
    return this.selectedPlatform === 'facebook' || this.selectedPlatform === 'instagram';
  }

  getFilteredPosts(): PlatformPost[] {
    if (this.selectedContentType === 'all') return this.posts;
    return this.posts.filter((p) => (p.contentType || 'post') === this.selectedContentType);
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
    return {
      primary: theme.primaryColor,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo
    };
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
}
