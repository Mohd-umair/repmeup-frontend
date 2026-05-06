import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntentBucketService, IIntentBucket } from '../../../../core/services/intent-bucket.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SweetAlertService } from '../../../../core/services/sweet-alert.service';
import { PaginationComponent, PaginationMeta } from '../../../../shared/components/pagination/pagination.component';
import { AiChatBubbleIconComponent } from '../../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

@Component({
  selector: 'app-bucket-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, AiChatBubbleIconComponent],
  templateUrl: './bucket-settings.component.html',
  styleUrls: ['./bucket-settings.component.scss']
})
export class BucketSettingsComponent implements OnInit {
  buckets: IIntentBucket[] = [];
  loading = true;
  saving = false;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalItems = 0;

  showModal = false;
  editingBucket: Partial<IIntentBucket> | null = null;
  isEditing = false;

  form: Partial<IIntentBucket> = this.emptyForm();

  keywordInput = '';

  colorPresets = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];
  iconPresets = [
    'fas fa-fire', 'fas fa-exclamation-triangle', 'fas fa-dollar-sign', 'fas fa-comments',
    'fas fa-star', 'fas fa-heart', 'fas fa-bolt', 'fas fa-tag',
    'fas fa-handshake', 'fas fa-headset', 'fas fa-question-circle', 'fas fa-bullhorn'
  ];

  toneOptions = [
    { value: '', label: 'Org Default' },
    { value: 'professional', label: 'Professional' },
    { value: 'casual', label: 'Casual' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'authoritative', label: 'Authoritative' },
    { value: 'playful', label: 'Playful' },
    { value: 'inspirational', label: 'Inspirational' },
    { value: 'neutral', label: 'Neutral' }
  ];

  languageOptions = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'hinglish', label: 'Hinglish' }
  ];

  dragIndex: number | null = null;

  constructor(
    private bucketService: IntentBucketService,
    private notify: NotificationService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.loadBuckets();
  }

  loadBuckets(): void {
    this.loading = true;
    this.bucketService.getBuckets({ page: this.currentPage, limit: this.pageSize }).subscribe({
      next: (res: any) => {
        this.buckets = res.data || [];
        if (res.pagination) {
          this.totalItems = res.pagination.total;
          this.totalPages = res.pagination.pages;
          this.currentPage = res.pagination.page;
        }
        this.loading = false;
      },
      error: () => {
        this.notify.error('Error', 'Failed to load buckets');
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadBuckets();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadBuckets();
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.isEditing = false;
    this.editingBucket = null;
    this.keywordInput = '';
    this.showModal = true;
  }

  openEdit(bucket: IIntentBucket): void {
    this.form = { ...bucket, keywords: [...(bucket.keywords || [])] };
    this.isEditing = true;
    this.editingBucket = bucket;
    this.keywordInput = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingBucket = null;
  }

  addKeyword(): void {
    const kw = this.keywordInput.trim().toLowerCase();
    if (kw && !(this.form.keywords || []).includes(kw)) {
      this.form.keywords = [...(this.form.keywords || []), kw];
    }
    this.keywordInput = '';
  }

  removeKeyword(kw: string): void {
    this.form.keywords = (this.form.keywords || []).filter(k => k !== kw);
  }

  saveBucket(): void {
    if (!this.form.name?.trim()) {
      this.notify.warning('Validation', 'Bucket name is required');
      return;
    }

    this.saving = true;
    const payload = {
      name: this.form.name!.trim(),
      color: this.form.color || '#3B82F6',
      icon: this.form.icon || 'fas fa-tag',
      keywords: this.form.keywords || [],
      aiPromptHint: this.form.aiPromptHint || '',
      isDefault: this.form.isDefault || false,
      replyEnabled: this.form.replyEnabled !== false,
      replyTone: this.form.replyTone || '',
      replyLanguage: this.form.replyLanguage || 'auto',
      replyPrompt: this.form.replyPrompt || ''
    };

    const obs = this.isEditing && this.editingBucket?._id
      ? this.bucketService.updateBucket(this.editingBucket._id, payload)
      : this.bucketService.createBucket(payload);

    obs.subscribe({
      next: () => {
        this.notify.success('Success', this.isEditing ? 'Bucket updated' : 'Bucket created');
        this.closeModal();
        this.loadBuckets();
        this.saving = false;
      },
      error: (err: any) => {
        this.notify.error('Error', err?.error?.error || 'Failed to save bucket');
        this.saving = false;
      }
    });
  }

  async deleteBucket(bucket: IIntentBucket): Promise<void> {
    const confirmed = await this.sweetAlert.confirm(
      'Delete Bucket',
      `Delete "${bucket.name}"? Conversations in this bucket will move to the default bucket.`,
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;

    this.bucketService.deleteBucket(bucket._id).subscribe({
      next: () => {
        this.notify.success('Deleted', 'Bucket deleted');
        this.loadBuckets();
      },
      error: () => this.notify.error('Error', 'Failed to delete bucket')
    });
  }

  toggleDefault(bucket: IIntentBucket): void {
    this.bucketService.updateBucket(bucket._id, { isDefault: true } as any).subscribe({
      next: () => {
        this.notify.success('Updated', `"${bucket.name}" is now the default bucket`);
        this.loadBuckets();
      },
      error: () => this.notify.error('Error', 'Failed to update default')
    });
  }

  onDragStart(index: number): void {
    this.dragIndex = index;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(targetIndex: number): void {
    if (this.dragIndex === null || this.dragIndex === targetIndex) {
      this.dragIndex = null;
      return;
    }

    const moved = this.buckets.splice(this.dragIndex, 1)[0];
    this.buckets.splice(targetIndex, 0, moved);
    this.dragIndex = null;

    const orderPayload = this.buckets.map((b, i) => ({ id: b._id, order: i }));
    this.bucketService.reorderBuckets(orderPayload).subscribe({
      next: () => this.notify.success('Reordered', 'Bucket order updated'),
      error: () => {
        this.notify.error('Error', 'Failed to reorder');
        this.loadBuckets();
      }
    });
  }

  selectColor(color: string): void {
    this.form.color = color;
  }

  selectIcon(icon: string): void {
    this.form.icon = icon;
  }

  private emptyForm(): Partial<IIntentBucket> {
    return {
      name: '',
      color: '#3B82F6',
      icon: 'fas fa-tag',
      keywords: [],
      aiPromptHint: '',
      isDefault: false,
      replyEnabled: true,
      replyTone: '',
      replyLanguage: 'auto',
      replyPrompt: ''
    };
  }
}
