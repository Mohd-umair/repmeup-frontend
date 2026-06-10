import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ResellerService } from '../../../core/services/reseller.service';
import { IApiResponse } from '../../../core/models/api-response.model';

interface BillingData {
  totalEarned: number;
  pendingCommission: number;
  paidCommission: number;
  ledger: Array<{
    subOrg?: { name?: string };
    amountInr: number;
    status: string;
    createdAt?: string;
  }>;
}

@Component({
  selector: 'app-client-billing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-billing.component.html',
  styleUrls: ['./client-billing.component.scss']
})
export class ClientBillingComponent implements OnInit {
  loading = true;
  billing: BillingData | null = null;

  constructor(private resellerService: ResellerService) {}

  ngOnInit(): void {
    this.resellerService.getBilling().subscribe({
      next: (res: IApiResponse<BillingData>) => {
        if (res.success && res.data) this.billing = res.data;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  formatPaise(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
