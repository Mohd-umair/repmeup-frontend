import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IReply } from '../../../core/models/interaction.model';
import {
  resolveWhatsAppDeliveryStatus,
  whatsAppDeliveryStatusLabel,
  WhatsAppDeliveryStatus
} from '../../../core/utils/whatsapp-delivery-status.util';

/**
 * WhatsApp-style message ticks: single (sent), double gray (delivered), double blue (read).
 * Driven by Meta Cloud API status webhooks persisted on reply.deliveryStatus.
 */
@Component({
  selector: 'app-whatsapp-delivery-ticks',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center shrink-0 leading-none"
      [attr.title]="label"
      role="img"
      [attr.aria-label]="label"
    >
      @if (status === 'pending') {
        <i class="fas fa-clock" [ngClass]="iconClass" aria-hidden="true"></i>
      } @else if (status === 'sent') {
        <i class="fas fa-check text-gray-500 dark:text-gray-400" [ngClass]="iconClass" aria-hidden="true"></i>
      } @else if (status === 'delivered') {
        <i
          class="fas fa-check-double text-gray-500 dark:text-gray-400"
          [ngClass]="iconClass"
          aria-hidden="true"
        ></i>
      } @else if (status === 'read') {
        <i
          class="fas fa-check-double text-sky-500 dark:text-sky-400"
          [ngClass]="iconClass"
          aria-hidden="true"
        ></i>
      } @else if (status === 'failed') {
        <i class="fas fa-exclamation-circle text-red-500 dark:text-red-400" [ngClass]="iconClass" aria-hidden="true"></i>
      }
    </span>
  `
})
export class WhatsAppDeliveryTicksComponent implements OnChanges {
  @Input({ required: true }) reply!: Pick<IReply, 'status' | 'deliveryStatus' | 'platformResponseId'>;
  /** xs = inbox list preview; sm = chat bubble footer */
  @Input() size: 'xs' | 'sm' = 'sm';

  status: WhatsAppDeliveryStatus = 'pending';
  label = '';
  iconClass = 'text-[11px]';

  ngOnChanges(): void {
    this.status = resolveWhatsAppDeliveryStatus(this.reply);
    this.label = whatsAppDeliveryStatusLabel(this.status);
    this.iconClass = this.size === 'xs' ? 'text-[10px]' : 'text-[11px]';
  }
}
