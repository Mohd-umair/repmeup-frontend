import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WhatsAppFormFlowService } from '../../../core/services/whatsapp-form-flow.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { IListFlowsResponse, IWhatsAppFormFlow } from '../../../core/models/whatsapp-form-flow.model';

/** Human labels for the built-in flow templates, keyed by the backend template key. */
const TEMPLATE_LABELS: Record<string, string> = {
  star_rating_comment: 'Rating + Comment'
};

@Component({
  selector: 'app-flow-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flow-list.component.html',
  styleUrls: ['./flow-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlowListComponent implements OnInit, OnDestroy {
  private readonly flowService = inject(WhatsAppFormFlowService);
  private readonly notificationService = inject(NotificationService);
  private readonly swal = inject(SweetAlertService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  flows: IWhatsAppFormFlow[] = [];
  loading = true;
  error: string | null = null;
  /** Id of the flow currently running a publish/deprecate call — drives the row spinner. */
  busyId: string | null = null;

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadFlows();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByFlow(_index: number, flow: IWhatsAppFormFlow): string {
    return flow._id ?? flow.name;
  }

  templateLabel(key: string): string {
    return TEMPLATE_LABELS[key] || 'Form';
  }

  /** Maps flow lifecycle onto the shared badge modifiers used across WhatsApp pages. */
  statusClass(status: IWhatsAppFormFlow['status']): string {
    switch (status) {
      case 'published': return 'status-badge--approved';
      case 'deprecated': return 'status-badge--paused';
      default: return 'status-badge--default';
    }
  }

  statusIcon(status: IWhatsAppFormFlow['status']): string {
    switch (status) {
      case 'published': return 'fa-check-circle';
      case 'deprecated': return 'fa-ban';
      default: return 'fa-pen-to-square';
    }
  }

  createNew(): void {
    void this.router.navigate(['/app/whatsapp-form-flows/create']);
  }

  editFlow(flowId: string | undefined): void {
    if (!flowId) return;
    void this.router.navigate(['/app/whatsapp-form-flows', flowId, 'edit']);
  }

  publishFlow(flowId: string | undefined): void {
    if (!flowId) return;

    void this.swal
      .confirm(
        'Publish this form?',
        'It goes live on Meta and can no longer be edited. To change the wording later you deprecate it and publish a new version.',
        'Publish'
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        this.busyId = flowId;
        this.cdr.markForCheck();

        this.flowService
          .publishFlow(flowId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.busyId = null;
              this.notificationService.success('Published', 'Your form is live on Meta.');
              this.loadFlows();
            },
            error: (err) => {
              this.busyId = null;
              this.cdr.markForCheck();
              this.notificationService.error(
                'Publish Failed',
                err?.error?.error || 'Could not publish this form.'
              );
            }
          });
      });
  }

  deprecateFlow(flowId: string | undefined): void {
    if (!flowId) return;

    void this.swal
      .confirm(
        'Deprecate this form?',
        'It stops being used for new sends. Responses already in flight still come back.',
        'Deprecate'
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        this.busyId = flowId;
        this.cdr.markForCheck();

        this.flowService
          .deprecateFlow(flowId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.busyId = null;
              this.notificationService.success('Deprecated', 'This form will no longer be sent.');
              this.loadFlows();
            },
            error: (err) => {
              this.busyId = null;
              this.cdr.markForCheck();
              this.notificationService.error(
                'Deprecate Failed',
                err?.error?.error || 'Could not deprecate this form.'
              );
            }
          });
      });
  }

  deleteFlow(flowId: string | undefined): void {
    if (!flowId) return;

    void this.swal
      .confirmDelete('Delete this form?', 'This removes the form permanently. This action cannot be undone.')
      .then((result) => {
        if (!result.isConfirmed) return;

        this.flowService
          .deleteFlow(flowId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notificationService.success('Deleted', 'Form deleted.');
              this.loadFlows();
            },
            error: (err) => {
              this.notificationService.error(
                'Delete Failed',
                err?.error?.error || 'Could not delete this form.'
              );
            }
          });
      });
  }

  private loadFlows(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.flowService
      .listFlows()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: IListFlowsResponse) => {
          this.flows = response.data || [];
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.error || 'Could not load your forms.';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }
}
