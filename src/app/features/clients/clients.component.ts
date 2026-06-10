import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CreateSubOrgPayload,
  ResellerDashboard,
  ResellerService,
  ResellerSubOrg
} from '../../core/services/reseller.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export class ClientsComponent implements OnInit, OnDestroy {
  loading = true;
  dashboard: ResellerDashboard | null = null;
  clients: ResellerSubOrg[] = [];
  depth: 'direct' | 'all' = 'all';
  statusFilter = '';

  showCreateModal = false;
  creating = false;
  createForm: CreateSubOrgPayload = {
    name: '',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
    planId: '',
    isSubReseller: false
  };
  lastProvisionalPassword: string | null = null;

  private sub?: Subscription;

  constructor(
    private resellerService: ResellerService,
    private notify: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  reload(): void {
    this.loading = true;
    this.resellerService.getDashboard().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.dashboard = res.data;
          if (!this.createForm.planId) {
            this.createForm.planId = res.data.capabilities.defaultSubOrgPlanId || 'free';
          }
        }
      },
      error: () => this.notify.error('Error', 'Failed to load reseller dashboard')
    });

    this.resellerService.listSubOrgs({
      depth: this.depth,
      status: this.statusFilter || undefined,
      page: 1,
      limit: 50
    }).subscribe({
      next: (res) => {
        this.clients = res.data?.items ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notify.error('Error', 'Failed to load clients');
      }
    });
  }

  openCreate(): void {
    this.lastProvisionalPassword = null;
    this.showCreateModal = true;
  }

  closeCreate(): void {
    if (this.creating) return;
    this.showCreateModal = false;
  }

  submitCreate(): void {
    if (!this.createForm.name?.trim() || !this.createForm.adminEmail?.trim()) {
      this.notify.error('Validation', 'Organization name and admin email are required');
      return;
    }
    this.creating = true;
    this.resellerService.createSubOrg({
      ...this.createForm,
      name: this.createForm.name.trim(),
      adminEmail: this.createForm.adminEmail.trim().toLowerCase()
    }).subscribe({
      next: (res) => {
        this.creating = false;
        if (!res.success) {
          this.notify.error('Error', res.error || 'Failed to create client');
          return;
        }
        this.lastProvisionalPassword = res.data?.provisionalPassword ?? null;
        this.notify.success('Client created', 'Sub-organization provisioned successfully');
        this.showCreateModal = false;
        this.createForm = {
          name: '',
          adminEmail: '',
          adminFirstName: '',
          adminLastName: '',
          planId: this.dashboard?.capabilities.defaultSubOrgPlanId || 'free',
          isSubReseller: false
        };
        this.reload();
      },
      error: (err) => {
        this.creating = false;
        this.notify.error('Error', err?.error?.error || 'Failed to create client');
      }
    });
  }

  viewClient(client: ResellerSubOrg): void {
    this.router.navigate(['/app/clients', client._id]);
  }

  suspendClient(client: ResellerSubOrg, event: Event): void {
    event.stopPropagation();
    this.resellerService.suspendSubOrg(client._id).subscribe({
      next: () => {
        this.notify.success('Suspended', `${client.name} has been suspended`);
        this.reload();
      },
      error: (err) => this.notify.error('Error', err?.error?.error || 'Suspend failed')
    });
  }

  activateClient(client: ResellerSubOrg, event: Event): void {
    event.stopPropagation();
    this.resellerService.activateSubOrg(client._id).subscribe({
      next: () => {
        this.notify.success('Activated', `${client.name} is active again`);
        this.reload();
      },
      error: (err) => this.notify.error('Error', err?.error?.error || 'Activate failed')
    });
  }

  formatPaise(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
