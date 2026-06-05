import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FlowBuilderService } from '../../../../core/services/flow-builder.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { IAutomationFlow } from '../../../../core/models/flow-builder.model';

@Component({
  selector: 'app-flow-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './flow-list.component.html',
  styleUrls: ['./flow-list.component.scss']
})
export class FlowListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'my-flows' | 'blueprints' = 'my-flows';
  flows: IAutomationFlow[] = [];
  blueprints: IAutomationFlow[] = [];
  loading = true;
  deleting = new Set<string>();
  toggling = new Set<string>();
  importing = false;

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  constructor(
    private flowService: FlowBuilderService,
    private notify: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFlows();
    this.loadBlueprints();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: 'my-flows' | 'blueprints'): void {
    this.activeTab = tab;
  }

  loadFlows(): void {
    this.loading = true;
    this.flowService.listFlows()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({
        next: (r) => { this.flows = r.data ?? []; },
        error: () => this.notify.error('Load failed', 'Could not load automation flows.')
      });
  }

  loadBlueprints(): void {
    this.flowService.listFlows({ blueprints: 'true' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r) => { this.blueprints = r.data ?? []; } });
  }

  importFromGrowth(): void {
    this.importing = true;
    this.flowService.importFromGrowth()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.importing = false; }))
      .subscribe({
        next: (r) => {
          const count = r.data?.length ?? 0;
          this.notify.success('Imported', `${count} draft flow(s) created from Growth settings.`);
          this.loadFlows();
          if (count === 1 && r.data?.[0]?._id) {
            this.router.navigate(['/app/automation/flows', r.data[0]._id, 'edit']);
          }
        },
        error: (err) => this.notify.error('Import failed', err.error?.error || 'Could not import Growth settings.')
      });
  }

  createBlank(): void {
    this.flowService.createFlow({
      name: 'Untitled flow',
      channels: ['whatsapp', 'instagram'],
      nodes: [],
      edges: []
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r) => {
        if (r.data?._id) this.router.navigate(['/app/automation/flows', r.data._id, 'edit']);
      },
      error: (err) => this.notify.error('Create failed', err.error?.error || 'Could not create flow.')
    });
  }

  useBlueprint(bp: IAutomationFlow): void {
    this.flowService.duplicateFlow(bp._id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          if (r.data?._id) this.router.navigate(['/app/automation/flows', r.data._id, 'edit']);
        },
        error: (err) => this.notify.error('Import failed', err.error?.error || 'Could not import blueprint.')
      });
  }

  editFlow(flow: IAutomationFlow): void {
    this.router.navigate(['/app/automation/flows', flow._id, 'edit']);
  }

  toggleStatus(flow: IAutomationFlow): void {
    if (!flow._id) return;
    this.toggling.add(flow._id);
    const req$ = flow.status === 'active'
      ? this.flowService.pauseFlow(flow._id)
      : this.flowService.publishFlow(flow._id);
    req$.pipe(takeUntil(this.destroy$), finalize(() => this.toggling.delete(flow._id!)))
      .subscribe({
        next: () => { this.notify.success('Updated', 'Flow status updated.'); this.loadFlows(); },
        error: (err) => this.notify.error('Update failed', err.error?.error || 'Could not update flow.')
      });
  }

  deleteFlow(flow: IAutomationFlow): void {
    if (!flow._id || !confirm(`Delete "${flow.name}"?`)) return;
    this.deleting.add(flow._id);
    this.flowService.deleteFlow(flow._id)
      .pipe(takeUntil(this.destroy$), finalize(() => this.deleting.delete(flow._id!)))
      .subscribe({
        next: () => { this.notify.success('Deleted', 'Flow removed.'); this.loadFlows(); },
        error: (err) => this.notify.error('Delete failed', err.error?.error || 'Could not delete flow.')
      });
  }

  channelClass(ch: string): string {
    switch (ch.toLowerCase()) {
      case 'whatsapp':  return 'flow-cat--whatsapp';
      case 'instagram': return 'flow-cat--instagram';
      case 'facebook':  return 'flow-cat--facebook';
      default:          return 'flow-cat--default';
    }
  }

  channelIcon(ch: string): string {
    switch (ch.toLowerCase()) {
      case 'whatsapp':  return 'fab fa-whatsapp';
      case 'instagram': return 'fab fa-instagram';
      case 'facebook':  return 'fab fa-facebook-f';
      default:          return 'fas fa-globe';
    }
  }

  statusClass(status: string | undefined): string {
    switch (status) {
      case 'active':   return 'status-badge--active';
      case 'paused':   return 'status-badge--paused';
      case 'archived': return 'status-badge--archived';
      default:         return 'status-badge--draft';
    }
  }

  statusIcon(status: string | undefined): string {
    switch (status) {
      case 'active':   return 'fa-check-circle';
      case 'paused':   return 'fa-pause-circle';
      case 'archived': return 'fa-archive';
      default:         return 'fa-pencil-alt';
    }
  }
}
