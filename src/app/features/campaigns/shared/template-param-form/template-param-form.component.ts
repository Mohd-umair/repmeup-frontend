import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { FileUploadZoneComponent } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { MediaSelectorModalComponent } from '../../../../shared/components/media-selector-modal/media-selector-modal.component';

import { MediaLibraryService } from '../../../../core/services/media-library.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Media } from '../../../../core/models/media.model';
import {
  ICampaignHeaderLocation,
  ICampaignHeaderMedia,
  ICampaignUrlButtonParam,
  ITemplateSlot,
  ITemplateSlots
} from '../../../../core/services/campaign.service';

/**
 * Emitted on every change so the parent (campaign editor) can persist incrementally.
 *
 *  - defaultParams: slotKey → string value to use when CSV mapping is absent
 *  - headerMedia / headerLocation / urlButtonParams: campaign-level fields
 *  - varsFromCsv: slot keys the user has marked as "fill from CSV" (so the
 *    mapping UI knows which slots need a CSV column).
 */
export interface TemplateParamFormState {
  defaultParams: Record<string, string>;
  headerMedia?: ICampaignHeaderMedia;
  headerLocation?: ICampaignHeaderLocation;
  urlButtonParams?: ICampaignUrlButtonParam[];
  varsFromCsv: string[];
}

@Component({
  selector: 'app-template-param-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadZoneComponent, MediaSelectorModalComponent],
  templateUrl: './template-param-form.component.html'
})
export class TemplateParamFormComponent implements OnChanges {
  /** Slot descriptor from the backend — drives the whole form. */
  @Input() slots: ITemplateSlots | null = null;

  /** Pre-filled values when editing an existing draft. */
  @Input() initialDefaultParams: Record<string, string> = {};
  @Input() initialHeaderMedia: ICampaignHeaderMedia | undefined = undefined;
  @Input() initialHeaderLocation: ICampaignHeaderLocation | undefined = undefined;
  @Input() initialUrlButtonParams: ICampaignUrlButtonParam[] = [];
  @Input() initialVarsFromCsv: string[] = [];

  /** Hide the "from CSV" toggle (when no CSV upload is available). */
  @Input() allowCsvToggle = true;

  @Output() stateChange = new EventEmitter<TemplateParamFormState>();

  // ── Local state ──────────────────────────────────────────────────────────
  defaultParams: Record<string, string> = {};
  varsFromCsv = new Set<string>();
  headerMedia: ICampaignHeaderMedia | undefined;
  headerLocation: ICampaignHeaderLocation = { latitude: 0, longitude: 0 };
  urlButtonParams: ICampaignUrlButtonParam[] = [];

  // Media library picker
  showMediaLibrary = false;
  uploadingMedia = false;
  selectedMediaFiles: File[] = [];

  constructor(
    private mediaLibrary: MediaLibraryService,
    private notify: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialDefaultParams']) {
      this.defaultParams = { ...(this.initialDefaultParams || {}) };
    }
    if (changes['initialVarsFromCsv']) {
      this.varsFromCsv = new Set(this.initialVarsFromCsv || []);
    }
    if (changes['initialHeaderMedia']) {
      this.headerMedia = this.initialHeaderMedia ? { ...this.initialHeaderMedia } : undefined;
    }
    if (changes['initialHeaderLocation']) {
      this.headerLocation = this.initialHeaderLocation
        ? { ...this.initialHeaderLocation }
        : { latitude: 0, longitude: 0 };
    }
    if (changes['initialUrlButtonParams']) {
      this.urlButtonParams = (this.initialUrlButtonParams || []).map(p => ({ ...p }));
      this.hydrateUrlButtonDefaults();
    }
    if (changes['slots']) {
      this.syncStateToSlots();
    }
  }

  /** Drop default params + url button params that no longer match any slot. */
  private syncStateToSlots(): void {
    if (!this.slots) {
      this.defaultParams = {};
      this.urlButtonParams = [];
      this.varsFromCsv.clear();
      this.emit();
      return;
    }
    const validKeys = new Set<string>();
    for (const s of this.slots.header.textSlots) validKeys.add(s.key);
    for (const s of this.slots.body.slots) validKeys.add(s.key);
    for (const b of this.slots.buttons) {
      for (const v of b.urlVars) validKeys.add(v.key);
    }

    const nextDefaults: Record<string, string> = {};
    for (const k of Object.keys(this.defaultParams)) {
      if (validKeys.has(k)) nextDefaults[k] = this.defaultParams[k];
    }
    this.defaultParams = nextDefaults;

    const validIdx = new Set(this.slots.buttons.map(b => b.index));
    this.urlButtonParams = this.urlButtonParams.filter(p => validIdx.has(p.index));

    const nextCsv = new Set<string>();
    for (const k of this.varsFromCsv) {
      if (validKeys.has(k)) nextCsv.add(k);
    }
    this.varsFromCsv = nextCsv;
    this.hydrateUrlButtonDefaults();
    this.emit();
  }

  /** Mirror legacy urlButtonParams (by button index) into slot-keyed defaultParams. */
  private hydrateUrlButtonDefaults(): void {
    if (!this.slots) return;
    for (const button of this.slots.buttons || []) {
      const override = this.urlButtonParams.find(p => p.index === button.index);
      if (!override?.value) continue;
      for (const slot of button.urlVars || []) {
        if (!this.defaultParams[slot.key]) {
          this.defaultParams[slot.key] = override.value;
        }
      }
    }
  }

  // ─── Field accessors ────────────────────────────────────────────────────

  setDefault(slot: ITemplateSlot, value: string): void {
    this.defaultParams[slot.key] = value;
    this.emit();
  }

  toggleFromCsv(slot: ITemplateSlot): void {
    if (this.varsFromCsv.has(slot.key)) {
      this.varsFromCsv.delete(slot.key);
    } else {
      this.varsFromCsv.add(slot.key);
    }
    this.emit();
  }

  isFromCsv(slot: ITemplateSlot): boolean {
    return this.varsFromCsv.has(slot.key);
  }

  setUrlButtonValue(slot: ITemplateSlot, buttonIndex: number, value: string): void {
    this.defaultParams[slot.key] = value;

    const existing = this.urlButtonParams.find(p => p.index === buttonIndex);
    if (existing) {
      existing.value = value;
    } else {
      this.urlButtonParams.push({ index: buttonIndex, value });
    }
    this.emit();
  }

  getUrlButtonValue(slot: ITemplateSlot, buttonIndex: number): string {
    return (
      this.defaultParams[slot.key] ||
      this.urlButtonParams.find(p => p.index === buttonIndex)?.value ||
      ''
    );
  }

  // ─── Header media ───────────────────────────────────────────────────────

  get headerMediaAcceptAttr(): string {
    switch (this.slots?.header.format) {
      case 'IMAGE':    return 'image/*';
      case 'VIDEO':    return 'video/*';
      case 'DOCUMENT': return '.pdf,application/pdf';
      default: return '*/*';
    }
  }

  get headerMediaGalleryType(): 'image' | 'video' | 'file' | 'all' {
    switch (this.slots?.header.format) {
      case 'IMAGE':    return 'image';
      case 'VIDEO':    return 'video';
      case 'DOCUMENT': return 'file';
      default: return 'all';
    }
  }

  onMediaFilesChange(files: File[]): void {
    this.selectedMediaFiles = files;
    if (!files.length) {
      this.headerMedia = undefined;
      this.emit();
      return;
    }
    this.uploadSelectedMedia(files[0]);
  }

  private async uploadSelectedMedia(file: File): Promise<void> {
    if (!this.slots?.header.format) return;
    const kind = this.slots.header.format as 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    this.uploadingMedia = true;
    try {
      const resp = await firstValueFrom(this.mediaLibrary.uploadMedia(file));
      const m: Media = resp.data;
      this.headerMedia = {
        kind,
        url: m.publicUrl,
        filename: m.originalName || m.filename,
        mediaLibraryId: m._id
      };
      this.emit();
      this.notify.success('Media uploaded', 'Header media set for this campaign.');
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Failed to upload media';
      this.notify.error('Upload failed', msg);
      this.selectedMediaFiles = [];
    } finally {
      this.uploadingMedia = false;
    }
  }

  onMediaLibrarySelect(selected: Media | Media[]): void {
    const media = Array.isArray(selected) ? selected[0] : selected;
    if (!media || !this.slots?.header.format) return;
    const kind = this.slots.header.format as 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    this.headerMedia = {
      kind,
      url: media.publicUrl,
      filename: media.originalName || media.filename,
      mediaLibraryId: media._id
    };
    this.selectedMediaFiles = [];
    this.showMediaLibrary = false;
    this.emit();
    this.notify.success('Media selected', 'Header media set from your library.');
  }

  closeMediaLibrary(): void {
    this.showMediaLibrary = false;
  }

  clearHeaderMedia(): void {
    this.headerMedia = undefined;
    this.selectedMediaFiles = [];
    this.emit();
  }

  // ─── Location ───────────────────────────────────────────────────────────

  onLocationChange(): void {
    this.emit();
  }

  // ─── Emit aggregate state ───────────────────────────────────────────────

  private emit(): void {
    const state: TemplateParamFormState = {
      defaultParams: { ...this.defaultParams },
      varsFromCsv: Array.from(this.varsFromCsv),
      headerMedia: this.headerMedia ? { ...this.headerMedia } : undefined,
      headerLocation:
        this.slots?.header.format === 'LOCATION'
          ? {
              latitude: Number(this.headerLocation.latitude) || 0,
              longitude: Number(this.headerLocation.longitude) || 0,
              name: this.headerLocation.name || undefined,
              address: this.headerLocation.address || undefined
            }
          : undefined,
      urlButtonParams: this.urlButtonParams.map(p => ({ ...p }))
    };
    this.stateChange.emit(state);
  }

  // ─── Convenience for the template ──────────────────────────────────────

  hasAnyTextSlots(): boolean {
    if (!this.slots) return false;
    return (
      (this.slots.header.textSlots?.length || 0) > 0 ||
      (this.slots.body.slots?.length || 0) > 0 ||
      (this.slots.buttons || []).some(b => b.urlVars.length > 0)
    );
  }

  headerMediaLabel(): string {
    if (!this.slots) return 'media';
    switch (this.slots.header.format) {
      case 'IMAGE':    return 'image';
      case 'VIDEO':    return 'video';
      case 'DOCUMENT': return 'document';
      default: return 'media';
    }
  }
}
