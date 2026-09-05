import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ContactService } from '../../../core/services/contact.service';
import { PlatformConnectionService, PlatformConnection } from '../../../core/services/platform-connection.service';
import { WhatsAppTemplateService } from '../../../core/services/whatsapp-template.service';
import { WhatsAppTemplate } from '../../../core/models/whatsapp-template.model';
import { IActivationCampaign, IAudienceSnapshot } from '../../../core/models/contact.model';

@Component({
  selector: 'app-campaign-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './campaign-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampaignWizardComponent implements OnInit {
  step = 1;
  audience: IAudienceSnapshot | null = null;
  campaign: IActivationCampaign | null = null;
  name = 'New campaign';
  channel: 'whatsapp' | 'instagram' | 'facebook' = 'whatsapp';
  channels: Array<'whatsapp' | 'instagram' | 'facebook'> = ['whatsapp', 'instagram', 'facebook'];
  body = 'Hi {{first_name}}, we have an update for you.';
  goal = 'Promotion';
  tone = 'Friendly';
  language = 'English';
  offer = '';
  preview: any = null;
  previewOffset = 0;
  validation: any = null;
  sendAt = '';
  confirmOpen = false;
  loading = false;
  connectionId = '';
  templateId = '';
  connections: PlatformConnection[] = [];
  templates: WhatsAppTemplate[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contacts: ContactService,
    private platforms: PlatformConnectionService,
    private templatesApi: WhatsAppTemplateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const audienceId = this.route.snapshot.queryParamMap.get('audience');
    const campaignId = this.route.snapshot.queryParamMap.get('id');
    if (audienceId) {
      this.contacts.getAudience(audienceId).subscribe({
        next: (res) => { this.audience = res.data ?? null; this.cdr.markForCheck(); }
      });
    }
    if (campaignId) {
      this.contacts.getCampaign(campaignId).subscribe({
        next: (res) => { this.campaign = res.data ?? null; this.hydrate(); this.cdr.markForCheck(); }
      });
    }
    this.platforms.getConnections().subscribe({
      next: (res) => { this.connections = res.data || []; this.cdr.markForCheck(); }
    });
    this.templatesApi.listTemplates().subscribe({
      next: (res) => { this.templates = (res.templates || []).filter((t) => String(t.status).toUpperCase() === 'APPROVED'); this.cdr.markForCheck(); }
    });
  }

  hydrate(): void {
    if (!this.campaign) return;
    this.name = this.campaign.name;
    this.channel = this.campaign.channel;
    this.body = String(this.campaign.content?.['body'] || this.body);
    this.connectionId = (this.campaign.connection as string) || '';
    this.templateId = String(this.campaign.content?.['templateId'] || '');
    const snap = this.campaign.audienceSnapshot;
    const snapId = typeof snap === 'string' ? snap : snap?._id;
    if (snapId) {
      this.contacts.getAudience(snapId).subscribe({
        next: (res) => { this.audience = res.data ?? this.audience; this.cdr.markForCheck(); }
      });
    }
  }

  eligibleFor(ch: string): number {
    return this.audience?.channelEligibility?.[ch]?.eligible || 0;
  }
  excludedFor(ch: string): number {
    return this.audience?.channelEligibility?.[ch]?.ineligible || 0;
  }
  channelConnections(): PlatformConnection[] {
    return this.connections.filter((c) => c.platform === this.channel && c.isActive);
  }

  next(): void {
    if (this.step === 1 && !this.campaign && this.audience) {
      this.loading = true;
      this.contacts.createCampaign({
        name: this.name,
        channel: this.channel,
        audienceSnapshotId: this.audience._id,
        connectionId: this.connectionId || undefined
      }).subscribe({
        next: (res) => { this.campaign = res.data ?? null; this.step = 2; this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.cdr.markForCheck(); }
      });
      return;
    }
    if (this.campaign && this.step >= 2) {
      this.persistDraft(() => {
        this.step += 1;
        if (this.step === 4) this.loadValidation();
        this.cdr.markForCheck();
      });
      return;
    }
    this.step += 1;
    this.cdr.markForCheck();
  }

  persistDraft(done?: () => void): void {
    if (!this.campaign) { done?.(); return; }
    this.contacts.updateCampaign(this.campaign._id, {
      content: { body: this.body, templateId: this.templateId },
      channel: this.channel,
      name: this.name,
      connection: this.connectionId || null,
      schedule: this.sendAt ? { sendAt: new Date(this.sendAt).toISOString() } : undefined
    }).subscribe({ next: () => done?.(), error: () => done?.() });
  }

  back(): void { this.step = Math.max(1, this.step - 1); }

  generate(): void {
    this.contacts.generateCampaignContent({ goal: this.goal, tone: this.tone, language: this.language, offer: this.offer }).subscribe({
      next: (res) => { this.body = res.data?.text || this.body; this.cdr.markForCheck(); }
    });
  }

  loadPreview(offset = 0): void {
    if (!this.campaign) return;
    this.previewOffset = offset;
    this.contacts.previewCampaign(this.campaign._id, offset).subscribe({
      next: (res) => { this.preview = res.data; this.cdr.markForCheck(); }
    });
  }

  loadValidation(): void {
    if (!this.campaign) return;
    this.contacts.validateCampaign(this.campaign._id).subscribe({
      next: (res) => { this.validation = res.data; this.cdr.markForCheck(); }
    });
    this.loadPreview(0);
  }

  launch(sendNow: boolean): void {
    if (!this.campaign) return;
    this.confirmOpen = false;
    this.contacts.updateCampaign(this.campaign._id, {
      content: { body: this.body, templateId: this.templateId },
      channel: this.channel,
      name: this.name,
      connection: this.connectionId || null,
      schedule: this.sendAt ? { sendAt: new Date(this.sendAt).toISOString() } : undefined
    }).subscribe({
      next: () => {
        this.contacts.launchCampaign(this.campaign!._id, sendNow).subscribe({
          next: () => this.router.navigate(['/app/contacts/campaigns', this.campaign!._id])
        });
      }
    });
  }
}
