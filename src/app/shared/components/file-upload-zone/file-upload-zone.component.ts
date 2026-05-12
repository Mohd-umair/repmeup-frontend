import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { Media } from '../../../core/models/media.model';
import { MediaSelectorModalComponent } from '../media-selector-modal/media-selector-modal.component';
import { environment } from '../../../../environments/environment';

let fileUploadIdSeq = 0;

/**
 * Reusable drag–drop + browse file picker with optional file list.
 * Controlled via [files] + (filesChange); parent owns the File[] state.
 */
@Component({
  selector: 'app-file-upload-zone',
  standalone: true,
  imports: [CommonModule, MediaSelectorModalComponent],
  templateUrl: './file-upload-zone.component.html',
  styleUrls: ['./file-upload-zone.component.scss']
})
export class FileUploadZoneComponent {
  readonly inputId = `app-file-upload-${++fileUploadIdSeq}`;

  /** Current files (controlled). */
  @Input() files: File[] = [];
  @Output() filesChange = new EventEmitter<File[]>();

  @Input() maxFiles = 5;
  @Input() maxFileSizeBytes = 20 * 1024 * 1024;
  @Input() accept = '*/*';
  @Input() disabled = false;
  /** When false, only one file is kept; file input has no `multiple` attribute. */
  @Input() multiple = true;
  @Input() showFileList = true;
  /** Main line inside the drop zone (empty = sensible default). */
  @Input() dropzoneTitle = '';
  @Input() dropzoneHint = '';
  /** Stronger drag-over style (e.g. organisation logo). */
  @Input() useRepDragAccent = false;
  /** Show the dark pill CTA (organisation logo pattern). */
  @Input() showChoosePill = false;
  /** Taller padding for organisation block. */
  @Input() comfortable = false;

  /**
   * When true, a click opens the media library modal first (drag–drop and “from device” still work).
   */
  @Input() openMediaGalleryOnClick = false;
  /** Passed to {@link MediaSelectorModalComponent#mediaType}. */
  @Input() galleryMediaType: 'image' | 'video' | 'audio' | 'file' | 'all' = 'all';
  /** Strip audio when confirming gallery selection (e.g. ticket attachments). */
  @Input() excludeGalleryAudio = false;

  /**
   * z-index for the media-library fullscreen overlay — raise when embedding
   * inside another modal (template wizard uses ~1040+).
   */
  @Input() galleryOverlayZIndex: number | string = 200;

  /** Drag depth avoids flicker when crossing children. */
  private dragDepth = 0;
  isDragOver = false;
  showGallery = false;
  galleryBusy = false;

  constructor(
    private readonly notify: NotificationService,
    private readonly http: HttpClient
  ) {}

  get resolvedTitle(): string {
    if (this.dropzoneTitle) return this.dropzoneTitle;
    if (this.openMediaGalleryOnClick) {
      return this.multiple
        ? 'Open media library or drag files here'
        : 'Open media library or drag a file here';
    }
    return this.multiple ? 'Drag & drop here, or browse' : 'Click or drag & drop';
  }

  /**
   * Tailwind classes with `/` or `:` cannot use `[class.xxx]` — Angular parses `/` as HTML.
   */
  get dropZoneClassList(): string[] {
    const c = [
      'relative',
      'block',
      'cursor-pointer',
      'select-none',
      'transition-all',
      'duration-150',
      'border-2',
      'border-dashed',
      'rounded-xl',
      'text-center',
      'bg-gray-50/50',
      'dark:bg-gray-800/30'
    ];
    if (this.comfortable) {
      c.push('rounded-2xl', 'px-6', 'py-8');
    } else {
      c.push('p-6');
    }
    if (this.disabled) {
      c.push('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
    }

    if (this.isDragOver && this.useRepDragAccent) {
      c.push('border-rep-black', 'bg-rep-black/5', 'fu-drag-scale');
    } else if (this.isDragOver && !this.useRepDragAccent) {
      c.push('border-rep-lime/60', 'dark:border-rep-lime/50');
    } else if (this.useRepDragAccent) {
      c.push('border-gray-300', 'hover:border-gray-400', 'hover:bg-gray-100');
    } else {
      c.push(
        'border-gray-200',
        'dark:border-gray-600',
        'hover:border-rep-lime/60',
        'dark:hover:border-rep-lime/50'
      );
    }
    return c;
  }

  onDropZoneClick(event: MouseEvent | KeyboardEvent): void {
    if (this.disabled) return;
    if ((event.target as HTMLElement).closest('button')) return;

    if (this.openMediaGalleryOnClick) {
      event.preventDefault();
      this.showGallery = true;
      return;
    }

    event.preventDefault();
    document.getElementById(this.inputId)?.click();
  }

  openDeviceFilePicker(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;
    document.getElementById(this.inputId)?.click();
  }

  closeGallery(): void {
    this.showGallery = false;
  }

  async onGallerySelect(selected: Media | Media[]): Promise<void> {
    const raw = Array.isArray(selected) ? selected : [selected];
    let items = this.excludeGalleryAudio ? raw.filter(m => m.mediaType !== 'audio') : [...raw];

    if (this.excludeGalleryAudio && items.length < raw.length) {
      this.notify.warning('Not supported', 'Audio files cannot be attached here.');
    }
    if (!items.length) {
      this.closeGallery();
      return;
    }

    const max = this.multiple ? this.maxFiles : 1;
    const room = Math.max(0, max - this.files.length);
    if (room <= 0) {
      this.notify.warning('Limit reached', `You can add up to ${max} file(s).`);
      this.closeGallery();
      return;
    }
    if (items.length > room) {
      items = items.slice(0, room);
      this.notify.warning('Limit reached', `Only ${room} more file(s) were added.`);
    }

    this.galleryBusy = true;
    this.closeGallery();

    const files: File[] = [];
    for (const m of items) {
      const f = await this.fetchMediaAsFile(m);
      if (f) files.push(f);
    }
    this.galleryBusy = false;

    if (files.length) {
      this.addFiles(files);
    }
  }

  private resolveMediaUrl(publicUrl: string): string {
    if (!publicUrl) return publicUrl;
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      return publicUrl;
    }
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return publicUrl.startsWith('/') ? `${base}${publicUrl}` : `${base}/${publicUrl}`;
  }

  private async fetchMediaAsFile(m: Media): Promise<File | null> {
    const url = this.resolveMediaUrl(m.publicUrl);
    const name = m.originalName || m.filename || 'attachment';
    try {
      const blob = await firstValueFrom(
        this.http.get(url, { responseType: 'blob' })
      );
      const type = m.mimeType || blob.type || 'application/octet-stream';
      return new File([blob], name, { type });
    } catch {
      this.notify.error('Could not load file', `Failed to download “${name}” from your library.`);
      return null;
    }
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth++;
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth--;
    if (this.dragDepth <= 0) {
      this.dragDepth = 0;
      this.isDragOver = false;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    this.isDragOver = false;
    if (this.disabled) return;
    const list = Array.from(event.dataTransfer?.files || []);
    this.addFiles(list);
  }

  onFileSelect(event: Event): void {
    if (this.disabled) return;
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  addFiles(incoming: File[]): void {
    if (!incoming.length || this.disabled) return;

    const max = this.multiple ? this.maxFiles : 1;
    const next = this.multiple ? [...this.files] : [];
    let tooLarge = 0;
    let wrongType = 0;
    let skippedFull = 0;

    for (const file of incoming) {
      if (next.length >= max) {
        skippedFull++;
        continue;
      }
      if (file.size > this.maxFileSizeBytes) {
        tooLarge++;
        continue;
      }
      if (!this.isAllowedMime(file)) {
        wrongType++;
        continue;
      }
      next.push(file);
      if (!this.multiple) break;
    }

    if (tooLarge) {
      this.notify.warning(
        'File too large',
        tooLarge === 1
          ? 'That file exceeds the maximum size.'
          : `${tooLarge} files exceed the maximum size.`
      );
    }
    if (wrongType) {
      this.notify.error('Invalid file type', this.acceptHintText);
    }
    if (skippedFull && this.multiple) {
      this.notify.warning('Limit reached', `You can add up to ${max} file(s).`);
    }

    const trimmed = next.slice(0, max);
    if (
      trimmed.length !== this.files.length ||
      trimmed.some((f, i) => f !== this.files[i])
    ) {
      this.filesChange.emit(trimmed);
    }
  }

  removeAt(index: number): void {
    if (this.disabled) return;
    const next = this.files.filter((_, i) => i !== index);
    this.filesChange.emit(next);
  }

  getFileIcon(type: string): string {
    if (type.startsWith('image/')) return 'fas fa-image';
    if (type === 'application/pdf') return 'fas fa-file-pdf';
    if (type.startsWith('video/')) return 'fas fa-file-video';
    return 'fas fa-file';
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private get acceptHintText(): string {
    if (this.accept.includes('image/*')) {
      return 'Please use an image file (e.g. PNG, JPG, WebP).';
    }
    return 'One or more files are not an allowed type.';
  }

  private isAllowedMime(file: File): boolean {
    const a = (this.accept || '*/*').trim();
    if (!a || a === '*/*') return true;

    const parts = a.split(',').map(s => s.trim()).filter(Boolean);
    const name = file.name.toLowerCase();
    const t = file.type;

    for (const p of parts) {
      if (p.endsWith('/*')) {
        const prefix = p.slice(0, -2);
        if (t.startsWith(prefix + '/')) return true;
        continue;
      }
      if (p.startsWith('.')) {
        if (name.endsWith(p.toLowerCase())) return true;
        continue;
      }
      if (t && t === p) return true;
    }
    return false;
  }
}
