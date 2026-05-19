import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CatalogService } from '../../../core/services/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ICommentToDmSettings,
  ISalesFlowSettings,
  ISalesFlowCtaButton,
  ICommentFollowInviteSettings
} from '../../../core/models/product.model';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';
import { AutomationSwitchComponent } from '../shared/automation-switch.component';

type GoalId = 'comment-to-dm' | 'follow-invite' | 'sales-flow' | 'story-to-dm';

interface IGrowthGoal {
  id: GoalId;
  label: string;
  icon: string;
  iconClass: string;
  desc: string;
}

@Component({
  selector: 'app-growth',
  standalone: true,
  imports: [CommonModule, FormsModule, AutomationPageShellComponent, AutomationSwitchComponent],
  templateUrl: './growth.component.html',
  styleUrls: ['./growth.component.scss']
})
export class GrowthComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeGoal: GoalId = 'comment-to-dm';

  goals: IGrowthGoal[] = [
    { id: 'comment-to-dm',  label: 'Convert Comments to DM',   icon: 'fas fa-comment-dollar', iconClass: 'text-blue-500',    desc: 'Auto-reply to product comments and send a DM with buy link.' },
    { id: 'follow-invite',  label: 'Comment to Follow',         icon: 'fas fa-user-plus',      iconClass: 'text-purple-500',  desc: 'Invite commenters to follow your page via a private DM.' },
    { id: 'sales-flow',     label: 'Comment to Purchase',       icon: 'fas fa-shopping-cart',  iconClass: 'text-emerald-500', desc: 'Guide hesitant buyers through a multi-step sales DM flow.' },
    { id: 'story-to-dm',    label: 'Story to DM',               icon: 'fas fa-circle-play',    iconClass: 'text-orange-500',  desc: 'Capture story viewers and convert them to DM leads.' },
  ];

  // ── Comment-to-DM ──────────────────────────────────────────────────────────
  ctdSettings: ICommentToDmSettings | null = null;
  loadingCtd = false;
  savingCtd = false;
  ctdError = '';
  keywordsInput = '';

  // ── Follow Invite ──────────────────────────────────────────────────────────
  fiSettings: ICommentFollowInviteSettings | null = null;
  loadingFi = false;
  savingFi = false;
  fiError = '';

  // ── Sales Flow ────────────────────────────────────────────────────────────
  sfSettings: ISalesFlowSettings | null = null;
  loadingSf = false;
  savingSf = false;
  sfError = '';
  hesitancyInput = '';

  constructor(
    private catalogService: CatalogService,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCtd();
    this.loadFi();
    this.loadSf();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Loaders ────────────────────────────────────────────────────────────────
  loadCtd(): void {
    this.loadingCtd = true;
    this.catalogService.getCommentToDmSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingCtd = false; this.cdr.markForCheck(); }))
      .subscribe({ next: r => { this.ctdSettings = r.data ?? null; if (this.ctdSettings) this.keywordsInput = this.ctdSettings.triggerKeywords?.join(', ') || ''; } });
  }

  loadFi(): void {
    this.loadingFi = true;
    this.catalogService.getCommentFollowInviteSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingFi = false; this.cdr.markForCheck(); }))
      .subscribe({ next: r => { this.fiSettings = r.data ?? null; } });
  }

  loadSf(): void {
    this.loadingSf = true;
    this.catalogService.getSalesFlowSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingSf = false; this.cdr.markForCheck(); }))
      .subscribe({ next: r => {
        this.sfSettings = r.data ?? null;
        if (this.sfSettings) this.hesitancyInput = (this.sfSettings.hesitancyKeywords || []).join(', ');
        if (this.sfSettings && !Array.isArray(this.sfSettings.ctaButtons)) this.sfSettings.ctaButtons = [];
      }});
  }

  // ── Savers ────────────────────────────────────────────────────────────────
  saveCtd(): void {
    if (!this.ctdSettings) return;
    this.savingCtd = true; this.ctdError = '';
    const payload = { ...this.ctdSettings, triggerKeywords: this.keywordsInput.split(',').map(k => k.trim()).filter(Boolean) };
    this.catalogService.updateCommentToDmSettings(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingCtd = false; this.cdr.markForCheck(); }))
      .subscribe({ next: () => this.notify.success('Saved', 'Comment-to-DM settings saved.'), error: err => { this.ctdError = err?.error?.error || 'Save failed'; } });
  }

  saveFi(): void {
    if (!this.fiSettings) return;
    this.savingFi = true; this.fiError = '';
    this.catalogService.updateCommentFollowInviteSettings(this.fiSettings)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingFi = false; this.cdr.markForCheck(); }))
      .subscribe({ next: () => this.notify.success('Saved', 'Follow-Invite settings saved.'), error: err => { this.fiError = err?.error?.error || 'Save failed'; } });
  }

  saveSf(): void {
    if (!this.sfSettings) return;
    this.savingSf = true; this.sfError = '';
    const s = this.sfSettings;
    const payload: Partial<ISalesFlowSettings> = {
      enabled: s.enabled, ctaTitle: s.ctaTitle, ctaSubtitle: s.ctaSubtitle, ctaImageUrl: s.ctaImageUrl,
      ctaButtons: (s.ctaButtons || []).map((b: ISalesFlowCtaButton) => b.type === 'web_url'
        ? { label: b.label, type: 'web_url', url: b.url || '' }
        : { label: b.label, type: 'postback', payload: b.payload || '' }),
      hesitancyKeywords: this.hesitancyInput.split(',').map(k => k.trim()).filter(Boolean),
      whatsappCaptureMessage: s.whatsappCaptureMessage,
      whatsappCaptureConfirmation: s.whatsappCaptureConfirmation
    };
    this.catalogService.updateSalesFlowSettings(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingSf = false; this.cdr.markForCheck(); }))
      .subscribe({ next: () => this.notify.success('Saved', 'Sales Flow settings saved.'), error: err => { this.sfError = err?.error?.error || 'Save failed'; } });
  }

  addCtaButton(): void {
    if (!this.sfSettings) return;
    if (!Array.isArray(this.sfSettings.ctaButtons)) this.sfSettings.ctaButtons = [];
    if (this.sfSettings.ctaButtons.length >= 3) return;
    this.sfSettings.ctaButtons = [...this.sfSettings.ctaButtons, { label: '', type: 'postback', payload: '' }];
    this.cdr.markForCheck();
  }

  removeCtaButton(i: number): void {
    if (!this.sfSettings?.ctaButtons) return;
    this.sfSettings.ctaButtons = this.sfSettings.ctaButtons.filter((_, idx) => idx !== i);
    this.cdr.markForCheck();
  }

  goalStatus(id: GoalId): 'active' | 'inactive' {
    if (id === 'comment-to-dm') return this.ctdSettings?.enabled ? 'active' : 'inactive';
    if (id === 'follow-invite') return this.fiSettings?.enabled ? 'active' : 'inactive';
    if (id === 'sales-flow') return this.sfSettings?.enabled ? 'active' : 'inactive';
    return 'inactive';
  }

  trackByIndex(i: number): number { return i; }
}
