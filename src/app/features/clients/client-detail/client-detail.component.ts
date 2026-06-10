import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ResellerService } from '../../../core/services/reseller.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IApiResponse } from '../../../core/models/api-response.model';

interface SubOrgDetail {
  organization: Record<string, unknown>;
  stats: {
    plan?: { planId?: string; planName?: string; status?: string };
    userCount?: number;
    platformCount?: number;
    isActive?: boolean;
  };
}

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss']
})
export class ClientDetailComponent implements OnInit {
  loading = true;
  clientId = '';
  organization: Record<string, unknown> | null = null;
  stats: SubOrgDetail['stats'] | null = null;
  planId = '';
  savingPlan = false;

  constructor(
    private route: ActivatedRoute,
    private resellerService: ResellerService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.clientId) return;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.resellerService.getSubOrg(this.clientId).subscribe({
      next: (res: IApiResponse<SubOrgDetail>) => {
        if (res.success && res.data) {
          this.organization = res.data.organization as Record<string, unknown>;
          this.stats = res.data.stats;
          this.planId = this.stats?.plan?.planId || '';
        }
        this.loading = false;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => {
        this.loading = false;
        this.notify.error('Error', err?.error?.error || 'Failed to load client');
      }
    });
  }

  assignPlan(): void {
    if (!this.planId.trim()) return;
    this.savingPlan = true;
    this.resellerService.assignPlan(this.clientId, this.planId.trim()).subscribe({
      next: () => {
        this.savingPlan = false;
        this.notify.success('Plan updated', 'Client plan assigned');
        this.load();
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => {
        this.savingPlan = false;
        this.notify.error('Error', err?.error?.error || 'Plan assignment failed');
      }
    });
  }

  suspend(): void {
    this.resellerService.suspendSubOrg(this.clientId).subscribe({
      next: () => {
        this.notify.success('Suspended', 'Client organization suspended');
        this.load();
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => this.notify.error('Error', err?.error?.error || 'Suspend failed')
    });
  }

  activate(): void {
    this.resellerService.activateSubOrg(this.clientId).subscribe({
      next: () => {
        this.notify.success('Activated', 'Client organization activated');
        this.load();
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => this.notify.error('Error', err?.error?.error || 'Activate failed')
    });
  }
}
