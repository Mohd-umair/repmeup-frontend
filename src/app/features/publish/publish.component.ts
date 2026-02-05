import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

interface Platform {
  id: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  platformUserId?: string;
  platformUsername?: string;
  selected?: boolean;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  order: number;
}

interface ScheduledPost {
  _id?: string;
  platforms: string[];
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

interface Draft {
  id: string;
  content: string;
  platforms: string[];
  mediaFiles: MediaFile[];
  firstComment?: string;
  savedAt: Date;
}

@Component({
  selector: 'app-publish',
  templateUrl: './publish.component.html',
  styleUrls: ['./publish.component.scss']
})
export class PublishComponent implements OnInit {
  // Platforms
  platforms: Platform[] = [];
  selectedPlatforms: Platform[] = [];
  
  // Post composition
  postContent: string = '';
  mediaFiles: MediaFile[] = [];
  firstComment: string = '';
  location: string = '';
  
  // Scheduling
  scheduleEnabled: boolean = false;
  scheduledDate: string = '';
  scheduledTime: string = '';
  
  // Advanced features
  showEmojiPicker: boolean = false;
  showHashtagHelper: boolean = false;
  showFirstComment: boolean = false;
  showLocationPicker: boolean = false;
  showPreview: boolean = false;
  
  // Hashtag suggestions
  suggestedHashtags: string[] = [
    '#socialmedia', '#marketing', '#business', '#entrepreneur',
    '#digitalmarketing', '#contentcreator', '#socialmediamarketing',
    '#branding', '#smallbusiness', '#inspiration'
  ];
  
  // Popular emojis
  popularEmojis: string[] = [
    '😊', '❤️', '🔥', '✨', '💯', '👍', '🎉', '💪', '🚀', '⭐',
    '👏', '💡', '🌟', '🎯', '📸', '💼', '🌍', '🎨', '📱', '💰'
  ];
  
  // State
  loading: boolean = false;
  publishing: boolean = false;
  error: string | null = null;
  success: string | null = null;
  
  // Data
  scheduledPosts: ScheduledPost[] = [];
  drafts: Draft[] = [];
  loadingPosts: boolean = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadConnectedPlatforms();
    this.loadScheduledPosts();
    this.loadDrafts();
    this.setDefaultScheduleTime();
  }
  
  navigateToCalendar(): void {
    this.router.navigate(['/app/publish/calendar']);
  }
  
  navigateToPublished(): void {
    this.router.navigate(['/app/publish/published']);
  }

  /**
   * Load connected platforms
   */
  loadConnectedPlatforms(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/platforms/connections`).subscribe({
      next: (response) => {
        const connections = response.data || response.connections || [];
        
        const platformMap = new Map<string, Platform>();
        
        connections.forEach((conn: any) => {
          const platform = conn.platform.toLowerCase();
          if (!platformMap.has(platform)) {
            platformMap.set(platform, {
              id: platform,
              name: this.getPlatformName(platform),
              icon: this.getPlatformIcon(platform),
              color: this.getPlatformColor(platform),
              connected: true,
              platformUserId: conn.platformUserId,
              platformUsername: conn.platformUsername,
              selected: false
            });
          }
        });
        
        this.platforms = Array.from(platformMap.values());
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading platforms:', error);
        this.error = 'Failed to load connected platforms';
        this.loading = false;
      }
    });
  }

  /**
   * Toggle platform selection
   */
  togglePlatform(platform: Platform): void {
    platform.selected = !platform.selected;
    this.selectedPlatforms = this.platforms.filter(p => p.selected);
  }

  /**
   * Select all platforms
   */
  selectAllPlatforms(): void {
    this.platforms.forEach(p => p.selected = true);
    this.selectedPlatforms = [...this.platforms];
  }

  /**
   * Deselect all platforms
   */
  deselectAllPlatforms(): void {
    this.platforms.forEach(p => p.selected = false);
    this.selectedPlatforms = [];
  }

  /**
   * Handle media file selection (supports multiple)
   */
  onMediaSelect(event: any): void {
    const files = Array.from(event.target.files || []) as File[];
    
    if (this.mediaFiles.length + files.length > 10) {
      this.error = 'Maximum 10 media files allowed';
      return;
    }
    
    files.forEach((file: File) => {
      // Validate file size
      const maxSize = 8 * 1024 * 1024;
      if (file.size > maxSize) {
        this.error = `${file.name} is too large. Max 8MB per file.`;
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'video/mp4'];
      if (!allowedTypes.includes(file.type)) {
        this.error = `${file.name} is not a supported format`;
        return;
      }
      
      const mediaType = file.type.startsWith('image') ? 'image' : 'video';
      
      // Generate preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.mediaFiles.push({
          file: file,
          preview: e.target.result,
          type: mediaType,
          order: this.mediaFiles.length
        });
      };
      reader.readAsDataURL(file);
    });
    
    this.error = null;
  }

  /**
   * Remove media file
   */
  removeMedia(index: number): void {
    this.mediaFiles.splice(index, 1);
    // Reorder remaining files
    this.mediaFiles.forEach((media, i) => {
      media.order = i;
    });
  }

  /**
   * Reorder media files (for carousel)
   */
  moveMediaUp(index: number): void {
    if (index === 0) return;
    [this.mediaFiles[index], this.mediaFiles[index - 1]] = 
    [this.mediaFiles[index - 1], this.mediaFiles[index]];
    this.mediaFiles.forEach((media, i) => {
      media.order = i;
    });
  }

  moveMediaDown(index: number): void {
    if (index === this.mediaFiles.length - 1) return;
    [this.mediaFiles[index], this.mediaFiles[index + 1]] = 
    [this.mediaFiles[index + 1], this.mediaFiles[index]];
    this.mediaFiles.forEach((media, i) => {
      media.order = i;
    });
  }

  /**
   * Insert emoji at cursor position
   */
  insertEmoji(emoji: string): void {
    this.postContent += emoji;
    this.showEmojiPicker = false;
  }

  /**
   * Insert hashtag
   */
  insertHashtag(hashtag: string): void {
    this.postContent += ' ' + hashtag;
  }

  /**
   * Set default schedule time
   */
  setDefaultScheduleTime(): void {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    this.scheduledDate = `${year}-${month}-${day}`;
    this.scheduledTime = `${hours}:${minutes}`;
  }

  /**
   * Save as draft
   */
  saveDraft(): void {
    const draft: Draft = {
      id: Date.now().toString(),
      content: this.postContent,
      platforms: this.selectedPlatforms.map(p => p.id),
      mediaFiles: this.mediaFiles,
      firstComment: this.firstComment,
      savedAt: new Date()
    };
    
    this.drafts.unshift(draft);
    localStorage.setItem('publishDrafts', JSON.stringify(this.drafts));
    
    this.notificationService.success('Draft Saved', 'Your draft has been saved locally');
  }

  /**
   * Load draft
   */
  loadDraft(draft: Draft): void {
    this.postContent = draft.content;
    this.firstComment = draft.firstComment || '';
    this.mediaFiles = draft.mediaFiles;
    
    // Select platforms
    this.platforms.forEach(p => {
      p.selected = draft.platforms.includes(p.id);
    });
    this.selectedPlatforms = this.platforms.filter(p => p.selected);
    
    this.notificationService.info('Draft Loaded', 'Your draft has been restored');
  }

  /**
   * Delete draft
   */
  deleteDraft(draftId: string): void {
    this.drafts = this.drafts.filter(d => d.id !== draftId);
    localStorage.setItem('publishDrafts', JSON.stringify(this.drafts));
  }

  /**
   * Load drafts from localStorage
   */
  loadDrafts(): void {
    const saved = localStorage.getItem('publishDrafts');
    if (saved) {
      this.drafts = JSON.parse(saved);
    }
  }

  /**
   * Publish or schedule post
   */
  async publishPost(asDraft: boolean = false): Promise<void> {
    if (this.selectedPlatforms.length === 0) {
      this.notificationService.error('Validation Error', 'Please select at least one platform');
      return;
    }
    
    if (!this.postContent.trim() && this.mediaFiles.length === 0) {
      this.notificationService.error('Validation Error', 'Please add some content or media');
      return;
    }
    
    this.publishing = true;
    this.error = null;
    this.success = null;
    
    try {
      // Publish to each platform
      for (const platform of this.selectedPlatforms) {
        const formData = new FormData();
        formData.append('platform', platform.id);
        formData.append('content', this.postContent);
        
        if (this.firstComment) {
          formData.append('firstComment', this.firstComment);
        }
        
        if (this.location) {
          formData.append('location', this.location);
        }
        
        // Add media files
        this.mediaFiles.forEach((media, index) => {
          formData.append('media', media.file);
        });
        
        if (this.scheduleEnabled && this.scheduledDate && this.scheduledTime) {
          const scheduledFor = new Date(`${this.scheduledDate}T${this.scheduledTime}`);
          formData.append('scheduledFor', scheduledFor.toISOString());
        }
        
        if (asDraft) {
          formData.append('status', 'draft');
        }
        
        const endpoint = this.scheduleEnabled || asDraft ? '/posts/schedule' : '/posts/publish';
        
        await this.http.post<any>(`${environment.apiUrl}${endpoint}`, formData).toPromise();
      }
      
      // Show success notification
      if (asDraft) {
        this.notificationService.success('Draft Saved', 'Your draft has been saved successfully!');
      } else if (this.scheduleEnabled) {
        this.notificationService.success(
          'Post Scheduled',
          `Your post has been scheduled for ${this.selectedPlatforms.length} platform(s)!`
        );
      } else {
        this.notificationService.success(
          'Post Published',
          `Your post has been published to ${this.selectedPlatforms.length} platform(s)!`
        );
      }
      
      // Reset form
      this.resetForm();
      
      // Reload data
      this.loadScheduledPosts();
      
      this.publishing = false;
    } catch (error: any) {
      // Check for detailed platform error
      if (error.error?.platformError) {
        const platformError = error.error.platformError;
        this.notificationService.error(
          platformError.title || 'Platform Error',
          platformError.message || error.error?.message || 'Failed to publish post'
        );
      } else {
        const errorMessage = error.error?.error || error.error?.message || 'Failed to publish post';
        this.notificationService.error('Publish Failed', errorMessage);
      }
      this.publishing = false;
    }
  }

  /**
   * Reset form
   */
  resetForm(): void {
    this.postContent = '';
    this.firstComment = '';
    this.location = '';
    this.mediaFiles = [];
    this.deselectAllPlatforms();
    this.scheduleEnabled = false;
    this.showFirstComment = false;
    this.showLocationPicker = false;
  }

  /**
   * Load scheduled posts
   */
  loadScheduledPosts(): void {
    this.loadingPosts = true;
    this.http.get<any>(`${environment.apiUrl}/posts/scheduled`).subscribe({
      next: (response) => {
        this.scheduledPosts = response.posts || [];
        this.loadingPosts = false;
      },
      error: (error) => {
        console.error('Error loading scheduled posts:', error);
        this.loadingPosts = false;
      }
    });
  }

  /**
   * Delete scheduled post
   */
  deleteScheduledPost(postId: string): void {
    if (!confirm('Are you sure you want to delete this scheduled post?')) {
      return;
    }
    
    this.http.delete(`${environment.apiUrl}/posts/scheduled/${postId}`).subscribe({
      next: () => {
        this.scheduledPosts = this.scheduledPosts.filter(p => p._id !== postId);
        this.notificationService.success('Post Deleted', 'Scheduled post has been deleted');
      },
      error: (error) => {
        console.error('Error deleting post:', error);
        const errorMessage = error.error?.message || 'Failed to delete post';
        this.notificationService.error('Delete Failed', errorMessage);
      }
    });
  }

  /**
   * Get character count
   */
  getCharacterCount(): number {
    return this.postContent.length;
  }

  /**
   * Get max characters for selected platforms
   */
  getMaxCharacters(): number {
    if (this.selectedPlatforms.length === 0) return 2200;
    
    const limits = this.selectedPlatforms.map(p => {
      switch (p.id) {
        case 'instagram': return 2200;
        case 'facebook': return 63206;
        case 'linkedin': return 3000;
        case 'youtube': return 5000;
        default: return 2200;
      }
    });
    
    return Math.min(...limits);
  }

  /**
   * Check if character limit exceeded
   */
  isOverLimit(): boolean {
    return this.getCharacterCount() > this.getMaxCharacters();
  }

  /**
   * Helper methods
   */
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

  getPlatformColor(platform: string): string {
    const colors: { [key: string]: string } = {
      instagram: 'from-pink-500 to-purple-600',
      facebook: 'from-blue-500 to-blue-700',
      youtube: 'from-red-500 to-red-700',
      linkedin: 'from-blue-600 to-blue-800',
      google: 'from-green-500 to-green-700'
    };
    return colors[platform] || 'from-gray-500 to-gray-700';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }
}
