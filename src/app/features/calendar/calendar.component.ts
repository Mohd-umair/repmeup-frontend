import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

interface ScheduledPost {
  _id?: string;
  platform?: string;
  platforms?: string[];
  content: string;
  mediaUrls?: string[];
  scheduledFor?: Date;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  publishedAt?: Date;
  platformPostId?: string;
  platformPostUrl?: string;
  firstComment?: string;
  location?: string;
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  // Calendar
  calendarDates: Date[] = [];
  selectedCalendarDate: Date | null = null;
  calendarPosts: Map<string, ScheduledPost[]> = new Map();
  showPostsModal: boolean = false;
  selectedDatePosts: ScheduledPost[] = [];
  
  // Data
  scheduledPosts: ScheduledPost[] = [];
  publishedPosts: ScheduledPost[] = [];
  loading: boolean = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.generateCalendarDates();
    this.loadScheduledPosts();
    this.loadPublishedPosts();
  }

  navigateToComposer(): void {
    this.router.navigate(['/app/publish']);
  }

  navigateToPublished(): void {
    this.router.navigate(['/app/publish/published']);
  }

  generateCalendarDates(): void {
    this.calendarDates = [];
    const today = new Date();
    
    for (let i = -30; i < 60; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      this.calendarDates.push(date);
    }
    
    this.updateCalendarPosts();
  }

  loadScheduledPosts(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/posts/scheduled`).subscribe({
      next: (response) => {
        this.scheduledPosts = response.posts || [];
        this.updateCalendarPosts();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading scheduled posts:', error);
        this.loading = false;
      }
    });
  }

  loadPublishedPosts(): void {
    this.http.get<any>(`${environment.apiUrl}/posts/published`).subscribe({
      next: (response) => {
        this.publishedPosts = response.posts || [];
        this.updateCalendarPosts();
      },
      error: (error) => {
        console.error('Error loading published posts:', error);
      }
    });
  }

  updateCalendarPosts(): void {
    this.calendarPosts.clear();
    
    this.scheduledPosts.forEach(post => {
      if (post.scheduledFor) {
        const dateKey = new Date(post.scheduledFor).toDateString();
        if (!this.calendarPosts.has(dateKey)) {
          this.calendarPosts.set(dateKey, []);
        }
        this.calendarPosts.get(dateKey)!.push(post);
      }
    });
    
    this.publishedPosts.forEach(post => {
      if (post.publishedAt) {
        const dateKey = new Date(post.publishedAt).toDateString();
        if (!this.calendarPosts.has(dateKey)) {
          this.calendarPosts.set(dateKey, []);
        }
        this.calendarPosts.get(dateKey)!.push(post);
      }
    });
  }

  getPostsForDate(date: Date): ScheduledPost[] {
    const dateKey = date.toDateString();
    return this.calendarPosts.get(dateKey) || [];
  }

  getPostCountForDate(date: Date): number {
    return this.getPostsForDate(date).length;
  }

  dateHasPosts(date: Date): boolean {
    return this.getPostCountForDate(date) > 0;
  }

  openPostsModal(date: Date): void {
    this.selectedCalendarDate = date;
    this.selectedDatePosts = this.getPostsForDate(date);
    
    if (this.selectedDatePosts.length > 0) {
      this.showPostsModal = true;
    }
  }

  closePostsModal(): void {
    this.showPostsModal = false;
    this.selectedCalendarDate = null;
    this.selectedDatePosts = [];
  }

  deleteScheduledPost(postId: string): void {
    if (!confirm('Are you sure you want to delete this scheduled post?')) {
      return;
    }
    
    this.http.delete(`${environment.apiUrl}/posts/scheduled/${postId}`).subscribe({
      next: () => {
        this.scheduledPosts = this.scheduledPosts.filter(p => p._id !== postId);
        this.selectedDatePosts = this.selectedDatePosts.filter(p => p._id !== postId);
        this.updateCalendarPosts();
        this.notificationService.success('Post Deleted', 'Scheduled post has been deleted');
      },
      error: (error) => {
        console.error('Error deleting post:', error);
        const errorMessage = error.error?.message || 'Failed to delete post';
        this.notificationService.error('Delete Failed', errorMessage);
      }
    });
  }

  // Helper methods
  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isPastDate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  }

  getDayOfWeek(date: Date): string {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[date.getDay()];
  }

  getDateNumber(date: Date): number {
    return date.getDate();
  }

  getMonthShort(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[date.getMonth()];
  }

  getFullDateString(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
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

  getPostPlatform(post: ScheduledPost): string {
    return post.platform || post.platforms?.[0] || '';
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
}
