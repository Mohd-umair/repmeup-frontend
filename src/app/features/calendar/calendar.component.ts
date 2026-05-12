import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { validateScheduleDateTimeStrings } from '../../shared/utils/schedule-validation';

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
  postType?: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  // Calendar
  viewMode: 'month' | 'week' | 'list' = 'month';
  filterPlatform = '';
  filterStatus = '';
  currentMonth = new Date();
  calendarDates: Date[] = [];
  selectedCalendarDate: Date | null = null;
  calendarPosts: Map<string, ScheduledPost[]> = new Map();
  showPostsModal: boolean = false;
  selectedDatePosts: ScheduledPost[] = [];
  reschedulePostId: string | null = null;
  rescheduleDate = '';
  rescheduleTime = '';
  duplicatingId: string | null = null;
  duplicateDate = '';
  duplicateTime = '';
  
  // Data
  scheduledPosts: ScheduledPost[] = [];
  publishedPosts: ScheduledPost[] = [];
  loading: boolean = false;

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.generateCalendarDates();
    this.loadScheduledPosts();
    this.loadPublishedPosts();
  }

  generateCalendarDates(): void {
    this.calendarDates = [];
    const base = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    if (this.viewMode === 'month') {
      const start = new Date(base);
      start.setDate(start.getDate() - start.getDay());
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        this.calendarDates.push(d);
      }
    } else if (this.viewMode === 'week') {
      const start = new Date(this.currentMonth);
      start.setDate(start.getDate() - start.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        this.calendarDates.push(d);
      }
    } else {
      for (let i = 0; i < 30; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        this.calendarDates.push(d);
      }
    }
    this.updateCalendarPosts();
  }

  loadScheduledPosts(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/posts/scheduled`).subscribe({
      next: (response) => {
        this.scheduledPosts = response.data || response.posts || [];
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
        this.publishedPosts = response.posts || response.data || [];
        this.updateCalendarPosts();
      },
      error: (error) => {
        console.error('Error loading published posts:', error);
      }
    });
  }

  updateCalendarPosts(): void {
    this.calendarPosts.clear();
    let scheduled = this.scheduledPosts;
    if (this.filterPlatform) {
      scheduled = scheduled.filter(p => (p.platform || p.platforms?.[0]) === this.filterPlatform);
    }
    if (this.filterStatus) {
      scheduled = scheduled.filter(p => p.status === this.filterStatus);
    }
    scheduled.forEach(post => {
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
    this.showPostsModal = true;
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

  prevPeriod(): void {
    if (this.viewMode === 'month') {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1);
    } else {
      this.currentMonth.setDate(this.currentMonth.getDate() - 7);
    }
    this.generateCalendarDates();
  }

  nextPeriod(): void {
    if (this.viewMode === 'month') {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1);
    } else {
      this.currentMonth.setDate(this.currentMonth.getDate() + 7);
    }
    this.generateCalendarDates();
  }

  periodLabel(): string {
    if (this.viewMode === 'month') {
      return this.currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    if (this.viewMode === 'week') {
      const start = new Date(this.currentMonth);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return start.toLocaleDateString() + ' – ' + end.toLocaleDateString();
    }
    return 'List view';
  }

  openReschedule(post: ScheduledPost): void {
    this.reschedulePostId = post._id!;
    this.rescheduleDate = post.scheduledFor ? new Date(post.scheduledFor).toISOString().slice(0, 10) : '';
    this.rescheduleTime = post.scheduledFor ? new Date(post.scheduledFor).toTimeString().slice(0, 5) : '12:00';
  }

  confirmReschedule(): void {
    if (!this.reschedulePostId || !this.rescheduleDate || !this.rescheduleTime) return;
    const v = validateScheduleDateTimeStrings(this.rescheduleDate, this.rescheduleTime);
    if (!v.ok) {
      this.notificationService.error('Reschedule', v.message);
      return;
    }
    const scheduledFor = v.scheduled.toISOString();
    this.http.patch(`${environment.apiUrl}/posts/scheduled/${this.reschedulePostId}/reschedule`, { scheduledFor }).subscribe({
      next: () => {
        this.reschedulePostId = null;
        this.loadScheduledPosts();
      }
    });
  }

  openDuplicate(post: ScheduledPost): void {
    this.duplicatingId = post._id!;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    this.duplicateDate = d.toISOString().slice(0, 10);
    this.duplicateTime = '12:00';
  }

  confirmDuplicate(): void {
    if (!this.duplicatingId) return;
    const post = this.scheduledPosts.find(p => p._id === this.duplicatingId);
    if (!post || !post.content || !post.platform) return;
    const v = validateScheduleDateTimeStrings(this.duplicateDate, this.duplicateTime);
    if (!v.ok) {
      this.notificationService.error('Schedule', v.message);
      return;
    }
    const scheduledFor = v.scheduled.toISOString();
    this.http.post(`${environment.apiUrl}/posts/schedule`, {
      platform: post.platform,
      content: post.content,
      scheduledFor,
      postType: post.postType || 'post'
    }).subscribe({
      next: () => {
        this.duplicatingId = null;
        this.loadScheduledPosts();
      }
    });
  }
}
