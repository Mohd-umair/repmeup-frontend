import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WhatsAppTemplate } from '../../../../core/models/whatsapp-template.model';
import { ITemplateSlots } from '../../../../core/services/campaign.service';
import { WhatsAppTemplatePreviewDisplay } from '../../../../core/utils/whatsapp-template-preview.helpers';
import { TemplateParamFormState } from '../template-param-form/template-param-form.component';
import {
  buildCampaignMessagePreview,
  campaignPreviewUsesCsvVars
} from '../campaign-preview.helpers';

@Component({
  selector: 'app-whatsapp-message-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whatsapp-message-preview.component.html',
  styleUrls: ['./whatsapp-message-preview.component.scss']
})
export class WhatsappMessagePreviewComponent {
  @Input() template: WhatsAppTemplate | null = null;
  @Input() slots: ITemplateSlots | null = null;
  @Input() formState: TemplateParamFormState | null = null;
  /** Compact layout for inline use (e.g. Step 2). */
  @Input() compact = false;
  @Input() title = 'Message preview';
  @Input() subtitle = 'This is how recipients will see your template message.';

  get hasPreview(): boolean {
    return !!(this.template && this.slots && this.formState);
  }

  get preview(): WhatsAppTemplatePreviewDisplay | null {
    if (!this.hasPreview) return null;
    return buildCampaignMessagePreview(this.template!, this.slots!, this.formState!);
  }

  get headerFormat(): string | null {
    return this.slots?.header?.format || null;
  }

  get headerMediaUrl(): string | null {
    return this.formState?.headerMedia?.url?.trim() || null;
  }

  get headerMediaKind(): string | null {
    return this.formState?.headerMedia?.kind || this.headerFormat;
  }

  get headerMediaFilename(): string | null {
    return this.formState?.headerMedia?.filename?.trim() || null;
  }

  get locationPreview(): { name?: string; address?: string; latitude: number; longitude: number } | null {
    if (this.headerFormat !== 'LOCATION' || !this.formState?.headerLocation) return null;
    const loc = this.formState.headerLocation;
    if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return null;
    return loc;
  }

  get usesCsvVars(): boolean {
    return this.formState ? campaignPreviewUsesCsvVars(this.formState) : false;
  }

  buttonIcon(type: string): string {
    switch (type) {
      case 'URL': return 'fa-external-link-alt';
      case 'PHONE_NUMBER': return 'fa-phone';
      case 'QUICK_REPLY': return 'fa-reply';
      case 'COPY_CODE': return 'fa-copy';
      case 'OTP': return 'fa-key';
      default: return 'fa-circle';
    }
  }
}
