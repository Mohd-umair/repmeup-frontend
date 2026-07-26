import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { InboxOpsService } from '../../../core/services/inbox-ops.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IOpsComplaintDetail } from '../../../core/models/inbox-ops.model';

@Component({
  selector: 'app-raise-complaint-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './raise-complaint-modal.component.html',
  styleUrls: ['./raise-complaint-modal.component.scss']
})
export class RaiseComplaintModalComponent implements OnChanges, OnDestroy {
  /** The inbox interaction (chat) to raise this complaint against. Required. */
  @Input() interactionId!: string;
  /** Prefill the issue summary with the last customer message (editable). */
  @Input() prefillSummary?: string;

  @Output() close = new EventEmitter<void>();
  @Output() raised = new EventEmitter<IOpsComplaintDetail>();

  private destroy$ = new Subject<void>();

  issueSummary = '';
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  submitting = false;

  readonly priorities: Array<{ value: 'low' | 'medium' | 'high' | 'urgent'; label: string; icon: string }> = [
    { value: 'low',    label: 'Low',    icon: 'fa-circle-dot' },
    { value: 'medium', label: 'Medium', icon: 'fa-circle-half-stroke' },
    { value: 'high',   label: 'High',   icon: 'fa-circle-exclamation' },
    { value: 'urgent', label: 'Urgent', icon: 'fa-triangle-exclamation' }
  ];

  constructor(
    private ops: InboxOpsService,
    private notify: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prefillSummary']?.currentValue) {
      this.issueSummary = (this.prefillSummary ?? '').substring(0, 280);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isValid(): boolean {
    return this.issueSummary.trim().length >= 5 && !!this.interactionId;
  }

  get charCount(): number {
    return this.issueSummary.length;
  }

  submit(): void {
    if (!this.isValid || this.submitting) return;

    this.submitting = true;
    this.ops
      .raiseComplaint(this.interactionId, {
        issueSummary: this.issueSummary.trim(),
        priority: this.priority
      })
      .pipe(finalize(() => (this.submitting = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.notify.success('Complaint raised', `${detail.displayRef} opened successfully.`);
          this.raised.emit(detail);
          this.close.emit();
        },
        error: (err) => {
          const msg = err.error?.error || 'Please try again.';
          if (err.status === 409) {
            this.notify.warning('Already open', msg);
          } else {
            this.notify.error('Failed to raise complaint', msg);
          }
        }
      });
  }
}
