import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ResellerService, IBillingDashboard, IPriceBookRow } from '../../core/services/reseller.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Reseller → Billing (reporting-only). Shows revenue, platform cost, and margin
 * aggregated across the reseller's client workspaces, plus an editable price book
 * (the reseller's customer-facing price per plan = their markup). No live charges.
 */
@Component({
  selector: 'app-reseller-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reseller-billing.component.html',
  styleUrls: ['./reseller-clients.component.scss']
})
export class ResellerBillingComponent implements OnInit {
  loading = false;
  error: string | null = null;

  dashboard: IBillingDashboard | null = null;

  // Price book editor — clientPriceRupees is the editable rupee value per row.
  priceBook: Array<IPriceBookRow & { clientPriceRupees: number | null }> = [];
  savingPriceBook = false;

  constructor(private reseller: ResellerService, private toast: NotificationService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.reseller.getBillingDashboard().subscribe({
      next: (res) => {
        if (res.success && res.data) this.dashboard = res.data;
        else this.error = res.error || 'Failed to load billing';
        this.loading = false;
      },
      error: (err) => { this.loading = false; this.error = err?.error?.error || 'Failed to load billing'; }
    });

    this.reseller.getPriceBook().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.priceBook = res.data.map((r) => ({
            ...r,
            clientPriceRupees: r.clientPriceInr != null ? r.clientPriceInr / 100 : null
          }));
        }
      },
      error: () => { /* price book optional; dashboard still shows */ }
    });
  }

  savePriceBook(): void {
    this.savingPriceBook = true;
    const entries = this.priceBook
      .filter((r) => r.clientPriceRupees != null && `${r.clientPriceRupees}`.trim() !== '')
      .map((r) => ({ planId: r.planId, clientPriceInr: Math.max(0, Math.round(Number(r.clientPriceRupees) * 100)) }));
    this.reseller.setPriceBook(entries).subscribe({
      next: (res) => {
        this.savingPriceBook = false;
        if (!res.success) { this.toast.error('Failed to save price book'); return; }
        this.toast.success('Price book saved', 'New client prices apply on the next plan assignment.');
      },
      error: () => { this.savingPriceBook = false; this.toast.error('Failed to save price book'); }
    });
  }

  /** paise → "₹1,234" */
  rupees(paise: number | null | undefined): string {
    const v = (paise || 0) / 100;
    return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  marginRupees(row: { clientPriceRupees: number | null; platformCostInr: number }): string {
    const price = (row.clientPriceRupees || 0) * 100;
    return this.rupees(price - row.platformCostInr);
  }
}
