import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
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
  /** For filtering: 'post' | 'reel' | 'video' | 'carousel' | 'story' */
  contentType?: string;
  /** Number of comments (from inbox interactions) */
  commentCount?: number;
}

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.scss']
})
export class ContentComponent implements OnInit {
  posts: PlatformPost[] = [];
  loading = false;
  error: string | null = null;
  syncing = false;

  /** Last time posts were synced for the selected platform (from API meta) */
  lastSyncedAt: string | null = null;

  /** Filter: 'all' | 'facebook' | 'instagram' (extensible for youtube, linkedin, etc.) */
  selectedPlatform = 'all';

  /** Content type filter – used when a single platform is selected */
  selectedContentType = 'all';

  /** Platform options for icon filter (same order as analytics where applicable) */
  platformFilterOptions: string[] = ['facebook', 'instagram'];

  /** Content type filter options (shown when Facebook or Instagram is selected) */
  contentTypes: { value: string; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'fas fa-th-large' },
    { value: 'post', label: 'Posts', icon: 'fas fa-image' },
    { value: 'reel', label: 'Reels', icon: 'fas fa-film' },
    { value: 'video', label: 'Videos', icon: 'fas fa-video' },
    { value: 'carousel', label: 'Carousel', icon: 'fas fa-images' },
    { value: 'story', label: 'Stories', icon: 'fas fa-bolt' }
  ];

  constructor(
    private http: HttpClient,
    private themeService: ThemeService,
    private router: Router
  ) {}

  /** Navigate to unified inbox filtered to comments for this post */
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

  ngOnInit(): void {
    // Don't load until user selects a platform; show "Select platform first" by default
    this.posts = [];
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
    this.http.get<{ success: boolean; posts: PlatformPost[]; meta?: { total: number; platformFilter: string; lastSyncedAt?: string } }>(
      `${environment.apiUrl}/platform-posts`,
      { params }
    ).subscribe({
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

  /** Sync posts from Meta for the selected platform and save to DB */
  syncPosts(): void {
    if (this.selectedPlatform === 'all') return;
    this.syncing = true;
    this.error = null;
    const params = new HttpParams().set('platform', this.selectedPlatform);
    this.http.post<{ success: boolean; synced: number; platform: string; message?: string }>(
      `${environment.apiUrl}/platform-posts/sync`,
      {},
      { params }
    ).subscribe({
      next: () => {
        this.syncing = false;
        this.loadPosts(); // Refreshes posts and lastSyncedAt
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

  /** Whether to show the content-type filter (when a single platform is selected) */
  get showContentTypeFilter(): boolean {
    return this.selectedPlatform === 'facebook' || this.selectedPlatform === 'instagram';
  }

  /** Posts filtered by selected content type (client-side when platform is selected) */
  getFilteredPosts(): PlatformPost[] {
    if (this.selectedContentType === 'all') return this.posts;
    return this.posts.filter(p => (p.contentType || 'post') === this.selectedContentType);
  }

  getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      youtube: 'YouTube',
      linkedin: 'LinkedIn',
      google: 'Google'
    };
    return names[platform] || platform;
  }

  /** Font Awesome brand icons – same as analytics and inbox header (reliable rendering) */
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

  /** Platform colors from ThemeService – same as unified inbox */
  getPlatformColors(platform: string): { primary: string; gradientFrom: string; gradientTo: string } {
    const theme = this.themeService.getTheme(platform);
    return {
      primary: theme.primaryColor,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo
    };
  }

  /** Platform brand color (hex) for filter buttons when needed */
  getPlatformColor(platform: string): string {
    return this.themeService.getTheme(platform).primaryColor;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  getRelativeTime(iso: string): string {
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
