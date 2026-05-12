import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MediaLibraryService } from '../../../core/services/media-library.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Media } from '../../../core/models/media.model';

@Component({
  selector: 'app-media-upload-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './media-upload-modal.component.html'
})
export class MediaUploadModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() uploadSuccess = new EventEmitter<Media>();

  // File data
  selectedFile: File | null = null;
  filePreview: string | null = null;
  fileType: 'image' | 'video' | 'audio' | 'file' | null = null;

  // Form data
  tags: string = '';
  description: string = '';

  // State
  uploading = false;
  dragOver = false;
  uploadProgress = 0;
  errorMessage: string | null = null;

  constructor(
    private mediaLibraryService: MediaLibraryService,
    private notificationService: NotificationService
  ) {}

  /**
   * Handle file selection
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  /**
   * Handle drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  /**
   * Handle drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  /**
   * Handle file drop
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Process selected file
   */
  private processFile(file: File): void {
    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/aac'];
    const validPdfTypes = ['application/pdf'];
    const looksPdf =
      validPdfTypes.includes(file.type) ||
      /\.pdf$/i.test(file.name || '') ||
      (file.type === '' && /\.pdf$/i.test(file.name || ''));

    if (
      !validImageTypes.includes(file.type) &&
      !validVideoTypes.includes(file.type) &&
      !validAudioTypes.includes(file.type) &&
      !looksPdf
    ) {
      this.notificationService.error(
        'Invalid file type',
        'Please upload an image (JPG, PNG, GIF, WEBP), video (MP4, MOV, AVI), audio (MP3, OGG, WAV, M4A), or a PDF document.'
      );
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      this.notificationService.error('File too large', 'File size must be less than 100MB');
      return;
    }

    this.selectedFile = file;
    if (validImageTypes.includes(file.type)) {
      this.fileType = 'image';
    } else if (validVideoTypes.includes(file.type)) {
      this.fileType = 'video';
    } else if (validAudioTypes.includes(file.type)) {
      this.fileType = 'audio';
    } else {
      this.fileType = 'file';
    }

    // Create preview (image/video only; audio/PDF have no inline image preview)
    if (this.fileType === 'audio' || this.fileType === 'file') {
      this.filePreview = null;
    } else {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.filePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Remove selected file
   */
  removeFile(): void {
    this.selectedFile = null;
    this.filePreview = null;
    this.fileType = null;
  }

  /**
   * Upload to library
   */
  upload(): void {
    if (!this.selectedFile) {
      this.notificationService.error('No file selected', 'Please select a file');
      return;
    }

    this.uploading = true;

    const tagsArray = this.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    this.mediaLibraryService.uploadMedia(
      this.selectedFile,
      tagsArray,
      this.description
    ).subscribe({
      next: (response) => {
        this.notificationService.success('Media uploaded successfully!');
        this.uploadSuccess.emit(response.data);
        this.uploading = false;
        this.resetForm();
      },
      error: (error) => {
        console.error('Upload error:', error);
        const message = error.error?.message || 'Failed to upload media';
        this.notificationService.error('Upload Failed', message);
        this.uploading = false;
        this.errorMessage = message;
      }
    });
  }

  /**
   * Reset form
   */
  private resetForm(): void {
    this.selectedFile = null;
    this.filePreview = null;
    this.fileType = null;
    this.tags = '';
    this.description = '';
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.close.emit();
  }

  /**
   * Format file size
   */
  formatSize(bytes: number): string {
    return this.mediaLibraryService.formatBytes(bytes);
  }
}
