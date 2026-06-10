import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ResellerService, IResellerClient, ICreatedResellerClient } from '../../core/services/reseller.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { AccountSwitcherService } from '../../core/services/account-switcher.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Reseller → Clients: list, create, assign plan/credits, and "open" (switch into)
 * a client workspace. A scoped version of the super-admin org console, gated by
 * ResellerGuard and pointed at /api/reseller/* (only the reseller's children).
 */
@Component({
  selector: 'app-reseller-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reseller-clients.component.html',
  styleUrls: ['./reseller-clients.component.scss']
})
export class ResellerClientsComponent implements OnInit {
  clients: IResellerClient[] = [];
  loading = false;
  error: string | null = null;

  page = 1;
  pageSize = 20;
  total = 0;

  plans: Array<{ planId: string; name: string }> = [];

  // Create modal
  createOpen = false;
  createSubmitting = false;
  createName = '';
  createEmail = '';
  createCompany = '';
  createPhone = '';
  createTrialDays: number | null = 30;
  createAiCreditsCap: number | null = null;
  createFormError = '';

  // Result modal (credentials + magic link)
  created: ICreatedResellerClient | null = null;

  // Assign-plan modal
  assignRow: IResellerClient | null = null;
  assignSubmitting = false;
  assignPlanId = '';
  assignAiCreditsCap: number | null = null;
  assignFormError = '';

  busyOrgId: string | null = null;

  /** Exposed for pagination math in the template. */
  readonly Math = Math;

  constructor(
    private reseller: ResellerService,
    private subscription: SubscriptionService,
    private accountSwitcher: AccountSwitcherService,
    private toast: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadPlans();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.reseller.listClients({ page: this.page, limit: this.pageSize }).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res.success || !res.data) { this.error = res.error || 'Failed to load clients'; return; }
        this.clients = res.data.items;
        this.total = res.data.pagination.total;
        this.page = res.data.pagination.page;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'Failed to load clients';
      }
    });
  }

  private loadPlans(): void {
    this.subscription.getPlans().subscribe({
      next: (res: any) => {
        const raw = res?.data || res?.plans || res || {};
        // getPlans returns a planId-keyed object or array; normalize to a list.
        const list = Array.isArray(raw)
          ? raw
          : Object.keys(raw).map((k) => ({ planId: raw[k].planId || k, name: raw[k].name || k }));
        this.plans = list
          .filter((p: any) => p.planId && p.planId !== 'demo' && p.planId !== 'free')
          .map((p: any) => ({ planId: p.planId, name: p.name || p.planId }));
      },
      error: () => { /* non-fatal: assign still works by selecting a plan id manually */ }
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────
  openCreate(): void {
    this.createName = '';
    this.createEmail = '';
    this.createCompany = '';
    this.createPhone = '';
    this.createTrialDays = 30;
    this.createAiCreditsCap = null;
    this.createFormError = '';
    this.createOpen = true;
  }
  closeCreate(): void { if (!this.createSubmitting) this.createOpen = false; }

  submitCreate(): void {
    this.createFormError = '';
    const email = this.createEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.createFormError = 'A valid prospect email is required.';
      return;
    }
    this.createSubmitting = true;
    this.reseller.createClient({
      prospect: {
        name: this.createName.trim() || undefined,
        email,
        company: this.createCompany.trim() || undefined,
        phone: this.createPhone.trim() || undefined
      },
      trialDays: this.createTrialDays ?? undefined,
      aiCreditsCap: this.createAiCreditsCap != null && `${this.createAiCreditsCap}`.trim() !== '' ? Number(this.createAiCreditsCap) : null
    }).subscribe({
      next: (res) => {
        this.createSubmitting = false;
        if (!res.success || !res.data) { this.createFormError = res.error || 'Failed to create client'; return; }
        this.toast.success('Client workspace created');
        this.createOpen = false;
        this.created = res.data;
        this.load();
      },
      error: (err) => {
        this.createSubmitting = false;
        this.createFormError = err?.error?.error || 'Request failed';
      }
    });
  }

  closeResult(): void { this.created = null; }

  copy(text: string | null | undefined, label: string): void {
    if (!text) return;
    void navigator.clipboard?.writeText(text).then(() => this.toast.success(`${label} copied`));
  }

  // ── Assign plan / credits ───────────────────────────────────────────────────
  openAssign(row: IResellerClient): void {
    this.assignRow = row;
    this.assignPlanId = row.planId && row.planId !== 'demo' ? row.planId : '';
    this.assignAiCreditsCap = row.aiCreditsCap;
    this.assignFormError = '';
  }
  closeAssign(): void { if (!this.assignSubmitting) this.assignRow = null; }

  submitAssign(): void {
    const row = this.assignRow;
    if (!row) return;
    this.assignFormError = '';
    const body: { planId?: string; aiCreditsCap?: number | '' } = {};
    if (this.assignPlanId) body.planId = this.assignPlanId;
    body.aiCreditsCap = this.assignAiCreditsCap == null || `${this.assignAiCreditsCap}`.trim() === '' ? '' : Number(this.assignAiCreditsCap);
    if (body.planId === undefined && body.aiCreditsCap === '') {
      // still valid: clearing the cap to unlimited
    }
    this.assignSubmitting = true;
    this.reseller.updateClient(row.organizationId, body).subscribe({
      next: (res) => {
        this.assignSubmitting = false;
        if (!res.success) { this.assignFormError = res.error || 'Failed to update'; return; }
        this.toast.success('Client updated');
        this.assignRow = null;
        this.load();
      },
      error: (err) => {
        this.assignSubmitting = false;
        this.assignFormError = err?.error?.error || 'Request failed';
      }
    });
  }

  // ── Open (switch into) a client ──────────────────────────────────────────────
  openClient(row: IResellerClient): void {
    this.busyOrgId = row.organizationId;
    this.accountSwitcher.switchAndGo(row.organizationId);
  }

  onPageChange(delta: number): void {
    const next = this.page + delta;
    if (next < 1 || (this.total && next > Math.ceil(this.total / this.pageSize))) return;
    this.page = next;
    this.load();
  }

  fmtDate(d: string | null): string {
    return d ? new Date(d).toLocaleDateString() : '—';
  }
}
