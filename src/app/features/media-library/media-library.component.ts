import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaLibraryService } from '../../core/services/media-library.service';
import { NotificationService } from '../../core/services/notification.service';
import { Media, MediaLibraryParams } from '../../core/models/media.model';
import { MediaUploadModalComponent } from '../../shared/components/media-upload-modal/media-upload-modal.component';

@Component({
  selector: 'app-media-library',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaUploadModalComponent],
  templateUrl: './media-library.component.html'
})
export class MediaLibraryComponent implements OnInit {
  // Media items
  mediaItems: Media[] = [];
  selectedMedia: Media | null = null;
  
  // Loading states
  loading = false;
  uploading = false;
  
  // Filters
  filterType: 'all' | 'image' | 'video' | 'file' = 'all';
  sortBy: string = '-createdAt';
  searchTags: string[] = [];
  
  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalItems = 0;
  totalPages = 0;
  
  // Statistics
  stats: any = null;
  
  // Modals
  showUploadModal = false;
  showDetailModal = false;
  showDeleteConfirm = false;
  mediaToDelete: Media | null = null;

  constructor(
    private mediaLibraryService: MediaLibraryService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadMediaLibrary();
    this.loadStats();
  }

  /**
   * Load media library with current filters
   */
  loadMediaLibrary(): void {
    this.loading = true;
    
    const params: MediaLibraryParams = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortBy
    };

    if (this.filterType !== 'all') {
      params.mediaType = this.filterType;
    }

    if (this.searchTags.length > 0) {
      params.tags = this.searchTags;
    }

    this.mediaLibraryService.getMediaLibrary(params).subscribe({
      next: (response) => {
        this.mediaItems = response.data;
        this.totalItems = response.pagination.total;
        this.totalPages = response.pagination.pages;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading media library:', error);
        this.notificationService.error('Failed to load media library');
        this.loading = false;
      }
    });
  }

  /**
   * Load statistics
   */
  loadStats(): void {
    this.mediaLibraryService.getStats().subscribe({
      next: (response) => {
        this.stats = response.data;
      },
      error: (error) => {
        console.error('Error loading stats:', error);
      }
    });
  }

  /**
   * Open upload modal
   */
  openUploadModal(): void {
    this.showUploadModal = true;
  }

  /**
   * Close upload modal
   */
  closeUploadModal(): void {
    this.showUploadModal = false;
  }

  /**
   * Handle upload success
   */
  onUploadSuccess(media: Media): void {
    this.notificationService.success('Media uploaded successfully!');
    this.closeUploadModal();
    this.loadMediaLibrary();
    this.loadStats();
  }

  /**
   * Change filter type
   */
  onFilterChange(type: 'all' | 'image' | 'video' | 'file'): void {
    this.filterType = type;
    this.currentPage = 1;
    this.loadMediaLibrary();
  }

  /**
   * Change sort order
   */
  onSortChange(sortBy: string): void {
    this.sortBy = sortBy;
    this.currentPage = 1;
    this.loadMediaLibrary();
  }

  /**
   * Go to specific page
   */
  goToPage(page: number): void {
    this.currentPage = page;
    this.loadMediaLibrary();
  }

  /**
   * View media details
   */
  viewDetails(media: Media): void {
    this.selectedMedia = media;
    this.showDetailModal = true;
  }

  /**
   * Close detail modal
   */
  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedMedia = null;
  }

  /**
   * Confirm delete media
   */
  confirmDelete(media: Media): void {
    this.mediaToDelete = media;
    this.showDeleteConfirm = true;
  }

  /**
   * Delete media
   */
  deleteMedia(): void {
    if (!this.mediaToDelete) return;

    const mediaId = this.mediaToDelete._id;

    this.mediaLibraryService.deleteMedia(mediaId).subscribe({
      next: () => {
        this.notificationService.success('Media deleted successfully');
        this.showDeleteConfirm = false;
        this.mediaToDelete = null;
        this.loadMediaLibrary();
        this.loadStats();
      },
      error: (error) => {
        console.error('Error deleting media:', error);
        const message = error.error?.message || 'Failed to delete media';
        this.notificationService.error('Delete Failed', message);
        this.showDeleteConfirm = false;
      }
    });
  }

  /**
   * Cancel delete
   */
  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.mediaToDelete = null;
  }

  /**
   * Copy media URL to clipboard
   */
  copyUrl(media: Media): void {
    navigator.clipboard.writeText(media.publicUrl).then(() => {
      this.notificationService.success('URL copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy URL:', err);
      this.notificationService.error('Failed to copy URL');
    });
  }

  /**
   * Format file size
   */
  formatSize(bytes: number): string {
    return this.mediaLibraryService.formatBytes(bytes);
  }

  /**
   * Get media thumbnail URL
   */
  getMediaThumbnail(media: Media): string {
    if (media.mediaType === 'image') {
      return media.publicUrl;
    }
    if (media.mediaType === 'video') {
      return '/assets/video-placeholder.png';
    }
    if (media.mediaType === 'file') {
      return '';
    }
    return '';
  }

  /**
   * Check if media is an image
   */
  isImage(media: Media): boolean {
    return media.mediaType === 'image';
  }

  /**
   * Check if media is a video
   */
  isVideo(media: Media): boolean {
    return media.mediaType === 'video';
  }

  /**
   * Check if media is audio
   */
  isAudio(media: Media): boolean {
    return media.mediaType === 'audio';
  }

  isFile(media: Media): boolean {
    return media.mediaType === 'file';
  }

  /**
   * Format date
   */
  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
