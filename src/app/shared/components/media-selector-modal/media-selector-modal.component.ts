import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaUploadModalComponent } from '../media-upload-modal/media-upload-modal.component';
import { Media, MediaLibraryParams } from '../../../core/models/media.model';
import { MediaLibraryService } from '../../../core/services/media-library.service';

@Component({
  selector: 'app-media-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaUploadModalComponent],
  templateUrl: './media-selector-modal.component.html'
})
export class MediaSelectorModalComponent implements OnInit {
  @Input() allowMultiple = false; // Allow selecting multiple media for carousel
  @Input() mediaType: 'image' | 'video' | 'audio' | 'all' = 'all'; // Filter by type
  @Output() close = new EventEmitter<void>();
  @Output() select = new EventEmitter<Media | Media[]>();

  mediaItems: Media[] = [];
  selectedMedia: Media[] = [];
  loading = false;
  currentPage = 1;
  totalPages = 1;
  filterType: 'all' | 'image' | 'video' | 'audio' = 'all';
  sortBy = '-createdAt';
  showUploadModal = false;

  constructor(private mediaLibraryService: MediaLibraryService) {}

  ngOnInit(): void {
    this.filterType = this.mediaType;
    this.loadMedia();
  }

  loadMedia(): void {
    this.loading = true;
    
    const params: MediaLibraryParams = {
      page: this.currentPage,
      limit: 12,
      sortBy: this.sortBy
    };

    if (this.filterType !== 'all') {
      params.mediaType = this.filterType;
    }

    this.mediaLibraryService.getMediaLibrary(params).subscribe({
      next: (response) => {
        this.mediaItems = response.data;
        this.totalPages = response.pagination.pages;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading media library:', error);
        this.loading = false;
      }
    });
  }

  toggleMedia(media: Media): void {
    const index = this.selectedMedia.findIndex(m => m._id === media._id);
    
    if (index >= 0) {
      // Deselect
      this.selectedMedia.splice(index, 1);
    } else {
      // Select
      if (this.allowMultiple) {
        this.selectedMedia.push(media);
      } else {
        this.selectedMedia = [media];
      }
    }
  }

  isSelected(media: Media): boolean {
    return this.selectedMedia.some(m => m._id === media._id);
  }

  onFilterChange(type: 'all' | 'image' | 'video' | 'audio'): void {
    this.filterType = type;
    this.currentPage = 1;
    this.loadMedia();
  }

  onSortChange(sortBy: string): void {
    this.sortBy = sortBy;
    this.currentPage = 1;
    this.loadMedia();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadMedia();
    }
  }

  confirmSelection(): void {
    if (this.selectedMedia.length > 0) {
      if (this.allowMultiple) {
        this.select.emit(this.selectedMedia);
      } else {
        this.select.emit(this.selectedMedia[0]);
      }
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  isImage(media: Media): boolean {
    return media.mediaType === 'image';
  }

  isVideo(media: Media): boolean {
    return media.mediaType === 'video';
  }

  isAudio(media: Media): boolean {
    return media.mediaType === 'audio';
  }

  formatSize(bytes: number): string {
    return this.mediaLibraryService.formatBytes(bytes);
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }

  openUploadModal(): void {
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
  }

  onUploadSuccess(media: Media): void {
    this.closeUploadModal();
    // Reload the media list to show the newly uploaded item
    this.loadMedia();
  }
}
