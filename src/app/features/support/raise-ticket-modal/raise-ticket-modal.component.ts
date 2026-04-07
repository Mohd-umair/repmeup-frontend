import {
  Component, EventEmitter, OnDestroy, OnInit, Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TicketService } from '../../../core/services/ticket.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TicketCategory,
  TicketPriority
} from '../../../core/models/ticket.model';
import { FileUploadZoneComponent } from '../../../shared/components/file-upload-zone/file-upload-zone.component';

@Component({
  selector: 'app-raise-ticket-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FileUploadZoneComponent],
  templateUrl: './raise-ticket-modal.component.html',
  styleUrls: ['./raise-ticket-modal.component.scss']
})
export class RaiseTicketModalComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  form!: FormGroup;
  submitting = false;
  pendingFiles: File[] = [];
  uploadingFiles = false;
  /** Same limit as backend ticket attachments. */
  readonly ticketMaxBytes = 20 * 1024 * 1024;
  private subs: Subscription[] = [];

  readonly categories: { value: TicketCategory; label: string }[] = Object.entries(TICKET_CATEGORY_LABELS)
    .map(([value, label]) => ({ value: value as TicketCategory, label }));

  readonly priorities: { value: TicketPriority; label: string }[] = Object.entries(TICKET_PRIORITY_LABELS)
    .map(([value, label]) => ({ value: value as TicketPriority, label }));

  constructor(
    private fb: FormBuilder,
    private ticketService: TicketService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      subject: ['', [Validators.required, Validators.maxLength(200)]],
      category: ['general', Validators.required],
      priority: ['medium', Validators.required],
      description: ['', [Validators.required, Validators.maxLength(10000)]]
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  close(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;

    const payload = this.form.value;
    const sub = this.ticketService.raiseTicket(payload).subscribe({
      next: (res) => {
        if (!res.success) {
          this.notify.error('Failed', res.error || 'Could not raise ticket.');
          this.submitting = false;
          return;
        }

        // Upload attachments sequentially if any
        const ticketId = res.data._id;
        if (this.pendingFiles.length > 0) {
          this.uploadingFiles = true;
          this.uploadFilesSequentially(ticketId, [...this.pendingFiles], 0);
        } else {
          this.notify.success('Ticket raised', 'Your ticket has been submitted successfully.');
          this.submitting = false;
          this.submitted.emit();
        }
      },
      error: () => {
        this.notify.error('Error', 'Failed to raise ticket. Please try again.');
        this.submitting = false;
      }
    });
    this.subs.push(sub);
  }

  private uploadFilesSequentially(ticketId: string, files: File[], index: number): void {
    if (index >= files.length) {
      this.uploadingFiles = false;
      this.submitting = false;
      this.notify.success('Ticket raised', 'Your ticket has been submitted successfully.');
      this.submitted.emit();
      return;
    }

    const sub = this.ticketService.uploadAttachment(ticketId, files[index]).subscribe({
      next: () => this.uploadFilesSequentially(ticketId, files, index + 1),
      error: () => {
        this.notify.warning('Upload issue', `Could not upload "${files[index].name}" — ticket was still created.`);
        this.uploadFilesSequentially(ticketId, files, index + 1);
      }
    });
    this.subs.push(sub);
  }
}
