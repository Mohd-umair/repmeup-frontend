import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { Media } from '../../core/models/media.model';
import { MediaSelectorModalComponent } from '../../shared/components/media-selector-modal/media-selector-modal.component';
import { MediaUploadGuideComponent } from '../../shared/components/media-upload-guide/media-upload-guide.component';
import { SocialPreviewComponent } from '../publish/social-preview/social-preview.component';

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
  file?: File;
  preview: string;
  type: 'image' | 'video' | 'audio';
  order: number;
  libraryMediaId?: string; // ID from media library
  publicUrl?: string; // URL from media library
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
  postType?: 'post' | 'story' | 'reel' | 'short';
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
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MediaSelectorModalComponent, MediaUploadGuideComponent, SocialPreviewComponent],
  templateUrl: './publish.component.html',
  styleUrls: ['./publish.component.scss']
})
export class PublishComponent implements OnInit {
  // Expose Object for template
  Object = Object;
  
  // Platforms
  platforms: Platform[] = [];
  selectedPlatforms: Platform[] = [];
  
  // Post composition
  postContent: string = '';
  mediaFiles: MediaFile[] = [];
  firstComment: string = '';
  location: string = '';
  postType: 'post' | 'story' | 'reel' | 'short' = 'post';
  
  // AI post generation
  aiPrompt: string = '';
  aiMode: 'same' | 'custom' = 'same';
  generatingAI: boolean = false;
  platformPosts: { [key: string]: string } = {}; // For custom mode
  showAIWriter: boolean = false;
  aiCredits: any = null;
  
  // Post type options
  postTypes = [
    { value: 'post', label: 'Post', icon: 'fas fa-image', description: 'Regular feed post', platforms: ['instagram', 'facebook', 'linkedin'] },
    { value: 'story', label: 'Story', icon: 'fas fa-clock', description: '24-hour temporary content', platforms: ['instagram', 'facebook'] },
    { value: 'reel', label: 'Reel', icon: 'fas fa-video', description: 'Short-form video content', platforms: ['instagram', 'facebook'] },
    { value: 'short', label: 'Short', icon: 'fas fa-film', description: 'Vertical short video', platforms: ['facebook'] }
  ];
  
  // Scheduling
  scheduleEnabled: boolean = false;
  scheduledDate: string = '';
  scheduledTime: string = '';
  
  // Advanced features
  showEmojiPicker: boolean = false;
  showHashtagHelper: boolean = false;
  showFirstComment: boolean = false;
  showLocationPicker: boolean = false;
  showPreview: boolean = true; // Start with preview visible
  showAdvancedOptions: boolean = false; // Collapsible advanced options
  showPlatformSection: boolean = true; // Can collapse platform selection
  showMediaSelector: boolean = false; // Media library selector modal
  
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
  showMediaGuide: boolean = false;
  fileValidationErrors: string[] = [];
  
  // Data
  scheduledPosts: ScheduledPost[] = [];
  drafts: Draft[] = [];
  loadingPosts: boolean = false;
  
  // Preview
  previewPlatformIndex: number = 0;

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadConnectedPlatforms();
    this.loadScheduledPosts();
    this.loadDrafts();
    this.setDefaultScheduleTime();
    this.loadAICredits();
  }
  
  /**
   * Load AI credits info
   */
  loadAICredits(): void {
    this.http.get<any>(`${environment.apiUrl}/users/ai-credits`).subscribe({
      next: (response) => {
        this.aiCredits = response.credits || response;
      },
      error: (error) => {
        console.error('Error loading AI credits:', error);
      }
    });
  }
  
  /**
   * Generate post with AI
   */
  generatePostWithAI(): void {
    if (!this.aiPrompt.trim()) {
      this.notificationService.error('Prompt Required', 'Please enter a prompt to generate post');
      return;
    }
    
    if (this.selectedPlatforms.length === 0) {
      this.notificationService.error('No Platforms', 'Please select at least one platform');
      return;
    }
    
    const platformIds = this.selectedPlatforms.map(p => p.id);
    const creditsNeeded = this.aiMode === 'same' ? 1 : platformIds.length;
    
    // Confirm credits
    if (this.aiCredits && !this.aiCredits.isUnlimited && this.aiCredits.remaining < creditsNeeded) {
      this.notificationService.error(
        'Insufficient Credits',
        `You need ${creditsNeeded} credits but have ${this.aiCredits.remaining} remaining`
      );
      return;
    }
    
    this.generatingAI = true;
    this.error = null;
    
    this.http.post<any>(`${environment.apiUrl}/posts/generate`, {
      prompt: this.aiPrompt,
      platforms: platformIds,
      mode: this.aiMode,
      postType: this.postType
    }).subscribe({
      next: (response) => {
        this.generatingAI = false;
        
        if (response.success) {
          const result = response.data;
          
          if (result.mode === 'same') {
            // Same post for all platforms
            this.postContent = result.posts.all;
            this.notificationService.success(
              'Post Generated!',
              `Used ${result.creditsUsed} credit. ${response.credits.remaining} remaining`
            );
          } else {
            // Custom posts per platform
            this.platformPosts = result.posts;
            // Set first platform's content as default
            if (platformIds[0]) {
              this.postContent = result.posts[platformIds[0]];
            }
            this.notificationService.success(
              'Posts Generated!',
              `Used ${result.creditsUsed} credits. ${response.credits.remaining} remaining`
            );
          }
          
          // Update credits
          this.aiCredits = response.credits;
          
          // Clear prompt
          this.aiPrompt = '';
        }
      },
      error: (error) => {
        this.generatingAI = false;
        console.error('AI generation error:', error);
        const errorMsg = error.error?.message || 'Failed to generate post';
        this.notificationService.error('Generation Failed', errorMsg);
      }
    });
  }
  
  /**
   * Load content for a specific platform (custom mode)
   */
  loadPlatformContent(platformId: string): void {
    if (this.platformPosts[platformId]) {
      this.postContent = this.platformPosts[platformId];
    }
  }
  
  /**
   * Get credits needed based on current mode
   */
  getCreditsNeeded(): number {
    return this.aiMode === 'same' ? 1 : this.selectedPlatforms.length;
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
          // Exclude YouTube from publishing platforms
          if (platform === 'youtube') {
            return;
          }
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
    this.onPlatformSelectionChange();
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
      // Validate file against platform requirements
      const validation = this.validateMediaFile(file);
      
      if (!validation.valid) {
        this.fileValidationErrors.push(...validation.errors);
        this.notificationService.error(
          'Invalid File',
          validation.errors[0] || 'File does not meet platform requirements'
        );
        return;
      }

      // Show warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach((warning: string) => {
          this.notificationService.warning('Media Warning', warning);
        });
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
   * Open media library selector modal
   */
  openMediaSelector(): void {
    this.showMediaSelector = true;
  }

  /**
   * Close media library selector modal
   */
  closeMediaSelector(): void {
    this.showMediaSelector = false;
  }

  /**
   * Handle media selection from library
   */
  onMediaLibrarySelect(selected: Media | Media[]): void {
    const mediaArray = Array.isArray(selected) ? selected : [selected];
    
    if (this.mediaFiles.length + mediaArray.length > 10) {
      this.notificationService.error('Maximum Reached', 'Maximum 10 media files allowed');
      return;
    }

    mediaArray.forEach((media: Media) => {
      const mediaFile: MediaFile = {
        preview: media.publicUrl,
        publicUrl: media.publicUrl,
        type: media.mediaType,
        order: this.mediaFiles.length,
        libraryMediaId: media._id
      };
      
      this.mediaFiles.push(mediaFile);
    });

    this.closeMediaSelector();
    this.notificationService.success('Media Added', `${mediaArray.length} media item(s) added from library`);
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
        formData.append('postType', this.postType);
        
        if (this.firstComment) {
          formData.append('firstComment', this.firstComment);
        }
        
        if (this.location) {
          formData.append('location', this.location);
        }
        
        // Add media files or library IDs
        const libraryMediaIds = this.mediaFiles
          .filter(m => m.libraryMediaId)
          .map(m => m.libraryMediaId);
        
        const newMediaFiles = this.mediaFiles.filter(m => m.file);

        if (libraryMediaIds.length > 0) {
          // Using media from library
          if (libraryMediaIds.length === 1 && libraryMediaIds[0]) {
            formData.append('mediaLibraryId', libraryMediaIds[0]);
          } else {
            formData.append('mediaLibraryIds', JSON.stringify(libraryMediaIds));
          }
        }

        // Add any new uploaded files
        if (newMediaFiles.length > 0) {
          newMediaFiles.forEach((media) => {
            formData.append('media', media.file!);
          });
        }
        
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
    this.postType = 'post';
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
      linkedin: 'LinkedIn',
      google: 'Google My Business',
      whatsapp: 'WhatsApp'
    };
    return names[platform] || platform;
  }

  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook',
      linkedin: 'fab fa-linkedin',
      google: 'fab fa-google',
      whatsapp: 'fab fa-whatsapp'
    };
    return icons[platform] || 'fas fa-share-alt';
  }

  getPlatformColor(platform: string): string {
    const colors: { [key: string]: string } = {
      instagram: 'from-pink-400 to-purple-400',
      facebook: 'from-blue-400 to-blue-500',
      linkedin: 'from-blue-400 to-blue-500',
      google: 'from-green-500 to-green-700',
      whatsapp: 'from-green-400 to-green-500'
    };
    return colors[platform] || 'from-gray-500 to-gray-700';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }

  /**
   * Get scheduled date for preview
   */
  getScheduledDate(): Date | undefined {
    if (this.scheduleEnabled && this.scheduledDate && this.scheduledTime) {
      return new Date(`${this.scheduledDate}T${this.scheduledTime}`);
    }
    return undefined;
  }

  /**
   * Get available post types for currently selected platforms
   */
  getAvailablePostTypes() {
    if (this.selectedPlatforms.length === 0) {
      return this.postTypes;
    }
    
    const selectedPlatformIds = this.selectedPlatforms.map(p => p.id);
    
    return this.postTypes.filter(type => 
      type.platforms.some(platform => selectedPlatformIds.includes(platform))
    );
  }

  /**
   * Check if current post type is valid for selected platforms
   */
  isPostTypeValid(): boolean {
    if (this.selectedPlatforms.length === 0) {
      return true;
    }
    
    const currentPostType = this.postTypes.find(t => t.value === this.postType);
    if (!currentPostType) {
      return false;
    }
    
    return this.selectedPlatforms.every(platform => 
      currentPostType.platforms.includes(platform.id)
    );
  }

  /**
   * Auto-select valid post type when platforms change
   */
  onPlatformSelectionChange(): void {
    if (!this.isPostTypeValid()) {
      const availableTypes = this.getAvailablePostTypes();
      if (availableTypes.length > 0) {
        this.postType = availableTypes[0].value as 'post' | 'story' | 'reel' | 'short';
      }
    }
  }

  /**
   * Set post type with proper type casting
   */
  setPostType(value: string): void {
    this.postType = value as 'post' | 'story' | 'reel' | 'short';
  }

  /**
   * Validate media file against platform requirements
   */
  validateMediaFile(file: File): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const mediaType = file.type.startsWith('image') ? 'image' : 'video';
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    // Platform-specific limits
    const platformLimits: any = {
      facebook: {
        image: { maxSize: 8, formats: ['jpg', 'jpeg', 'png'] },
        video: { maxSize: 1024, formats: ['mp4', 'mov'] }
      },
      instagram: {
        image: { maxSize: 8, formats: ['jpg', 'jpeg', 'png'] },
        video: { maxSize: 100, formats: ['mp4', 'mov'] }
      },
      linkedin: {
        image: { maxSize: 5, formats: ['jpg', 'jpeg', 'png', 'gif'] },
        video: { maxSize: 200, formats: ['mp4', 'mov'] }
      }
    };

    // Check against each selected platform
    for (const platform of this.selectedPlatforms) {
      const limits = platformLimits[platform.id]?.[mediaType];
      
      if (!limits) {
        continue;
      }

      // Check file size
      if (file.size > limits.maxSize * 1024 * 1024) {
        errors.push(`${platform.name}: File size ${fileSizeMB}MB exceeds ${limits.maxSize}MB limit`);
      }

      // Check format
      if (!limits.formats.includes(fileExtension)) {
        errors.push(`${platform.name}: Format .${fileExtension} not supported. Use: ${limits.formats.join(', ')}`);
      }
    }

    // Get strictest limit
    const strictestLimit = Math.min(
      ...this.selectedPlatforms
        .map(p => platformLimits[p.id]?.[mediaType]?.maxSize || 999)
        .filter(l => l !== undefined)
    );

    if (strictestLimit && file.size > strictestLimit * 1024 * 1024) {
      warnings.push(`File may be too large for some platforms. Consider compressing to under ${strictestLimit}MB`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Toggle media guide modal
   */
  toggleMediaGuide(): void {
    this.showMediaGuide = !this.showMediaGuide;
  }

  /**
   * Get selected platform IDs for media guide
   */
  getSelectedPlatformIds(): string[] {
    return this.selectedPlatforms.map(p => p.id);
  }
}
