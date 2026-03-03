import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface ScheduledPost {
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
  selector: 'app-published-posts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './published-posts.component.html',
  styleUrls: ['./published-posts.component.scss']
})
export class PublishedPostsComponent implements OnInit {
  publishedPosts: ScheduledPost[] = [];
  loading: boolean = false;
  
  // Filters
  selectedPlatform: string = 'all';
  searchQuery: string = '';
  
  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPublishedPosts();
  }

  navigateToComposer(): void {
    this.router.navigate(['/app/publish']);
  }

  navigateToCalendar(): void {
    this.router.navigate(['/app/publish/calendar']);
  }

  loadPublishedPosts(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/posts/published`).subscribe({
      next: (response) => {
        this.publishedPosts = response.posts || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading published posts:', error);
        this.loading = false;
      }
    });
  }

  getFilteredPosts(): ScheduledPost[] {
    return this.publishedPosts.filter(post => {
      const platformMatch = this.selectedPlatform === 'all' || 
                           post.platform === this.selectedPlatform;
      const searchMatch = !this.searchQuery || 
                         post.content.toLowerCase().includes(this.searchQuery.toLowerCase());
      return platformMatch && searchMatch;
    });
  }

  getUniquePlatforms(): string[] {
    const platforms = new Set<string>();
    this.publishedPosts.forEach(post => {
      if (post.platform) {
        platforms.add(post.platform);
      }
    });
    return Array.from(platforms);
  }

  getPlatformName(platform: string): string {
    const names: { [key: string]: string } = {
      instagram: 'Instagram',
      facebook: 'Facebook',
      youtube: 'YouTube',
      linkedin: 'LinkedIn',
      google: 'Google My Business'
    };
    return names[platform] || platform;
  }

  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook',
      youtube: 'fab fa-youtube',
      linkedin: 'fab fa-linkedin',
      google: 'fab fa-google'
    };
    return icons[platform] || 'fas fa-share-alt';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }

  getRelativeTime(date: Date | string): string {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return this.formatDate(date);
  }

  getPostsPerWeek(): number {
    return this.publishedPosts.length > 0 ? Math.ceil(this.publishedPosts.length / 7) : 0;
  }
}
