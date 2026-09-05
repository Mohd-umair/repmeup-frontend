import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ContactService } from '../../../core/services/contact.service';
import { IActivationCampaign, ICampaignStats } from '../../../core/models/contact.model';

@Component({
  selector: 'app-campaign-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaign-status.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampaignStatusComponent implements OnInit, OnDestroy {
  campaign: IActivationCampaign | null = null;
  stats: ICampaignStats = {};
  analysis: any = null;
  loading = false;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contacts: ContactService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
    interval(8000).pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshStats());
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  id(): string { return this.route.snapshot.paramMap.get('id') || ''; }

  load(): void {
    this.loading = true;
    this.contacts.getCampaign(this.id()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.campaign = res.data ?? null; this.loading = false; this.refreshStats(); this.cdr.markForCheck(); },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  refreshStats(): void {
    if (!this.id()) return;
    this.contacts.campaignStats(this.id()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.stats = (res.data || {}) as ICampaignStats; this.cdr.markForCheck(); }
    });
  }

  pause(): void { this.contacts.pauseCampaign(this.id()).subscribe({ next: () => this.load() }); }
  resume(): void { this.contacts.resumeCampaign(this.id()).subscribe({ next: () => this.load() }); }
  sendNow(): void { this.contacts.launchCampaign(this.id(), true).subscribe({ next: () => this.load() }); }

  followUp(): void {
    this.contacts.followUp(this.id(), 'did_not_reply').subscribe({
      next: (res) => {
        if (res.data?._id) {
          const snap = res.data.audienceSnapshot;
          const audience = typeof snap === 'string' ? snap : snap?._id;
          this.router.navigate(['/app/contacts/campaigns/new'], { queryParams: { id: res.data._id, audience } });
        }
      }
    });
  }

  analyze(): void {
    this.contacts.analyzeCampaign(this.id()).subscribe({
      next: (res) => { this.analysis = res.data; this.cdr.markForCheck(); }
    });
  }

  createSegment(intent: string): void {
    if (!this.campaign) return;
    this.contacts.createPreset({
      kind: 'segment',
      name: `${this.campaign.name} · ${intent}`,
      filterQuery: {
        logic: 'AND',
        conditions: [
          { field: 'campaign', operator: 'eq', value: { campaignId: this.campaign._id, condition: 'replied' } },
          { field: 'intent', operator: 'contains', value: intent }
        ]
      }
    }).subscribe({ next: () => this.router.navigate(['/app/contacts/segments']) });
  }

  startAutomation(): void {
    this.router.navigate(['/app/automation/flows'], { queryParams: { fromCampaign: this.id() } });
  }

  isWhatsApp(): boolean { return this.campaign?.channel === 'whatsapp'; }
}
