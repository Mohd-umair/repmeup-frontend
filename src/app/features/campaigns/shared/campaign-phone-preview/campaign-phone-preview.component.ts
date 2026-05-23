import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IPhonePreviewRow, IPhonePreviewStats } from '../../../../core/services/campaign.service';
import { formatE164Display } from '../campaign-country.constants';

@Component({
  selector: 'app-campaign-phone-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-phone-preview.component.html'
})
export class CampaignPhonePreviewComponent {
  @Input() phonePreview: IPhonePreviewRow[] = [];
  @Input() phoneStats: IPhonePreviewStats | null = null;
  @Input() rowCount = 0;

  formatPhone = formatE164Display;

  statusLabel(status: string): string {
    switch (status) {
      case 'valid': return 'OK';
      case 'prefixed': return 'Prefixed';
      case 'invalid': return 'Invalid';
      default: return status;
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'valid': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
      case 'prefixed': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'invalid': return 'bg-red-500/15 text-red-600 dark:text-red-400';
      default: return 'bg-gray-500/15 text-gray-600';
    }
  }

  get hasStats(): boolean {
    return !!this.phoneStats && (this.phoneStats.valid + this.phoneStats.prefixed + this.phoneStats.invalid) > 0;
  }

  get importableCount(): number {
    if (!this.phoneStats) return 0;
    return (this.phoneStats.valid || 0) + (this.phoneStats.prefixed || 0);
  }
}
