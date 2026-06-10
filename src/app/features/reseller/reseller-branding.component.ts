import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ResellerService, IResellerBranding } from '../../core/services/reseller.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Reseller → Branding: the brand template applied to client workspaces.
 * Saved on the reseller org; copied into each new client's whiteLabel, and
 * optionally pushed to all existing clients ("apply to all").
 */
@Component({
  selector: 'app-reseller-branding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reseller-branding.component.html',
  styleUrls: ['./reseller-clients.component.scss']
})
export class ResellerBrandingComponent implements OnInit {
  loading = false;
  saving = false;
  error: string | null = null;

  logo = '';
  primaryColor = '#3B82F6';
  secondaryColor = '#10B981';
  customDomain = '';
  applyToChildren = true;
  applyToExisting = false;

  constructor(private reseller: ResellerService, private toast: NotificationService) {}

  ngOnInit(): void {
    this.loading = true;
    this.reseller.getBranding().subscribe({
      next: (res) => {
        this.loading = false;
        const b: IResellerBranding = res.data || {};
        this.logo = b.logo || '';
        this.primaryColor = b.primaryColor || '#3B82F6';
        this.secondaryColor = b.secondaryColor || '#10B981';
        this.customDomain = b.customDomain || '';
        this.applyToChildren = b.applyToChildren !== false;
      },
      error: () => { this.loading = false; this.error = 'Failed to load branding'; }
    });
  }

  save(): void {
    this.saving = true;
    this.error = null;
    this.reseller.updateBranding({
      logo: this.logo.trim(),
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      customDomain: this.customDomain.trim(),
      applyToChildren: this.applyToChildren,
      applyToExisting: this.applyToExisting
    }).subscribe({
      next: (res) => {
        this.saving = false;
        if (!res.success) { this.error = res.error || 'Failed to save'; return; }
        this.toast.success('Branding saved', this.applyToExisting ? 'Applied to all client workspaces.' : undefined);
      },
      error: (err) => { this.saving = false; this.error = err?.error?.error || 'Request failed'; }
    });
  }
}
