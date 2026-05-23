import { Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MediaUploadModalComponent } from '../media-upload-modal/media-upload-modal.component';
import { Media, MediaLibraryParams } from '../../../core/models/media.model';
import { MediaLibraryService } from '../../../core/services/media-library.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';

@Component({
  selector: 'app-media-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaUploadModalComponent],
  templateUrl: './media-selector-modal.component.html',
  styleUrls: ['./media-selector-modal.component.scss']
})
export class MediaSelectorModalComponent implements OnInit {
  @Input() allowMultiple = false; // Allow selecting multiple media for carousel
  @Input() mediaType: 'image' | 'video' | 'audio' | 'file' | 'all' = 'all'; // Filter by type
  /** Raise when embedding inside other overlays (e.g. campaign editor slide-over). */
  @Input() overlayZIndex = 50;
  @HostBinding('style.z-index')
  get hostZIndex(): number | string {
    return this.overlayZIndex;
  }
  @Output() close = new EventEmitter<void>();
  @Output() select = new EventEmitter<Media | Media[]>();

  mediaItems: Media[] = [];
  selectedMedia: Media[] = [];
  loading = false;
  currentPage = 1;
  totalPages = 1;
  filterType: 'all' | 'image' | 'video' | 'audio' | 'file' = 'all';
  sortBy = '-createdAt';
  showUploadModal = false;
  deletingId: string | null = null;
  deletingBulk = false;

  constructor(
    private mediaLibraryService: MediaLibraryService,
    private notify: NotificationService,
    private swal: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.filterType = this.mediaType;
    this.loadMedia();
  }

  loadMedia(): void {
    this.loading = true;
    
    const params: MediaLibraryParams = {
      page: this.currentPage,
      limit: 24,
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

  onFilterChange(type: 'all' | 'image' | 'video' | 'audio' | 'file'): void {
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

  isFile(media: Media): boolean {
    return media.mediaType === 'file';
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

  /** Per-item delete — stops card click from toggling selection */
  requestDeleteOne(media: Media, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    if (this.deletingId || this.deletingBulk) return;
    if (media.usageCount > 0) {
      void this.swal.warning(
        'In use',
        `This file is referenced in ${media.usageCount} post(s). Remove it from those posts before deleting.`
      );
      return;
    }
    const name = media.originalName || 'this file';
    void this.swal
      .confirmDelete(
        'Delete this media?',
        `Permanently remove “${name}” from your library? This cannot be undone.`
      )
      .then(result => {
        if (!result.isConfirmed) return;

        this.deletingId = media._id;
        this.mediaLibraryService.deleteMedia(media._id).subscribe({
          next: () => {
            this.deletingId = null;
            this.selectedMedia = this.selectedMedia.filter(m => m._id !== media._id);
            this.notify.success('Deleted', 'Media removed from your library.');
            this.loadMedia();
          },
          error: (err) => {
            this.deletingId = null;
            const msg = err?.error?.message || err?.message || 'Could not delete.';
            this.notify.error('Delete failed', msg);
          }
        });
      });
  }

  /** Delete all currently selected items (single or multi mode) */
  deleteSelected(): void {
    if (this.deletingBulk || this.deletingId || this.selectedMedia.length === 0) return;
    const inUse = this.selectedMedia.filter(m => m.usageCount > 0);
    if (inUse.length > 0) {
      void this.swal.warning(
        'Cannot delete',
        `${inUse.length} selected item(s) are in use. Deselect them or remove them from posts first.`
      );
      return;
    }
    const n = this.selectedMedia.length;
    const title = n === 1 ? 'Delete this file?' : `Delete ${n} files?`;
    const message =
      n === 1
        ? 'This file will be removed from your library permanently.'
        : 'All selected files will be removed from your library permanently.';

    void this.swal.confirmDelete(title, message).then(result => {
      if (!result.isConfirmed) return;

      this.deletingBulk = true;
      const items = [...this.selectedMedia];
      forkJoin(
        items.map(m =>
          this.mediaLibraryService.deleteMedia(m._id).pipe(
            map(() => ({ ok: true as const, id: m._id })),
            catchError(err => of({ ok: false as const, id: m._id, err }))
          )
        )
      ).subscribe({
        next: results => {
          this.deletingBulk = false;
          const deleted = results.filter((r): r is { ok: true; id: string } => r.ok);
          const failed = results.filter(r => !r.ok);
          this.selectedMedia = [];
          this.loadMedia();
          if (deleted.length > 0) {
            this.notify.success('Deleted', `${deleted.length} file(s) removed from your library.`);
          }
          if (failed.length > 0) {
            const first = failed[0] as { ok: false; id: string; err: unknown };
            const msg =
              (first.err as { error?: { message?: string } })?.error?.message ||
              'Some items could not be deleted.';
            this.notify.error('Partial failure', msg);
          }
        },
        error: () => {
          this.deletingBulk = false;
          this.notify.error('Delete failed', 'Could not delete selected media.');
        }
      });
    });
  }
}
