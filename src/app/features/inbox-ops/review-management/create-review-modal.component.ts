import {
  Component,
  EventEmitter,
  OnDestroy,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { InboxOpsService } from '../../../core/services/inbox-ops.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IOpsReviewDetail } from '../../../core/models/inbox-ops.model';

@Component({
  selector: 'app-create-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-review-modal.component.html',
  styleUrls: ['./create-review-modal.component.scss']
})
export class CreateReviewModalComponent implements OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<IOpsReviewDetail>();

  private destroy$ = new Subject<void>();

  // Form fields
  platform: 'google' | 'facebook' | 'instagram' | 'website' = 'google';
  customerName = '';
  customerHandle = '';
  rating: number | null = null;
  reviewBody = '';
  sentiment: 'positive' | 'negative' | 'neutral' | '' = '';

  submitting = false;

  readonly platforms = [
    { value: 'google' as const,    label: 'Google',    icon: 'fab fa-google' },
    { value: 'facebook' as const,  label: 'Facebook',  icon: 'fab fa-facebook-f' },
    { value: 'instagram' as const, label: 'Instagram', icon: 'fab fa-instagram' },
    { value: 'website' as const,   label: 'Website',   icon: 'fas fa-globe' }
  ];

  readonly sentimentOptions = [
    { value: 'positive' as const, label: 'Positive', icon: 'fas fa-smile',       cls: 'crm-sentiment--positive' },
    { value: 'neutral'  as const, label: 'Neutral',  icon: 'fas fa-meh',         cls: 'crm-sentiment--neutral' },
    { value: 'negative' as const, label: 'Negative', icon: 'fas fa-frown',       cls: 'crm-sentiment--negative' }
  ];

  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private ops: InboxOpsService,
    private notify: NotificationService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setRating(n: number): void {
    this.rating = this.rating === n ? null : n;
    // Auto-derive sentiment from rating if not manually set
    if (!this.sentiment) {
      if (n >= 4) this.sentiment = 'positive';
      else if (n <= 2) this.sentiment = 'negative';
      else this.sentiment = 'neutral';
    }
  }

  get isValid(): boolean {
    return this.reviewBody.trim().length >= 5;
  }

  get charCount(): number {
    return this.reviewBody.length;
  }

  submit(): void {
    if (!this.isValid || this.submitting) return;

    this.submitting = true;
    this.ops
      .createReview({
        platform: this.platform,
        customerName: this.customerName.trim() || undefined,
        customerHandle: this.customerHandle.trim() || undefined,
        rating: this.rating,
        reviewBody: this.reviewBody.trim(),
        sentiment: (this.sentiment || undefined) as 'positive' | 'negative' | 'neutral' | undefined
      })
      .pipe(finalize(() => (this.submitting = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (review) => {
          this.notify.success('Review added', `${review.displayRef} logged successfully.`);
          this.created.emit(review);
          this.close.emit();
        },
        error: (err) => {
          this.notify.error('Failed to create review', err.error?.error || 'Please try again.');
        }
      });
  }
}
