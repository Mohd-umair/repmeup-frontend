import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CatalogService } from '../../../core/services/catalog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IApiResponse } from '../../../core/models/api-response.model';
import {
  ICommentToDmSettings,
  ISalesFlowSettings,
  ISalesFlowCtaButton,
  ICommentFollowInviteSettings,
  IStoryToDmSettings
} from '../../../core/models/product.model';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';
import { AutomationSwitchComponent } from '../shared/automation-switch.component';

type GoalId = 'comment-to-dm' | 'follow-invite' | 'sales-flow' | 'story-to-dm';

interface IGrowthGoal {
  id: GoalId;
  label: string;
  icon: string;
  iconClass: string;
  iconBg: string;
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

  activeGoal: GoalId | null = null;

  goals: IGrowthGoal[] = [
    { id: 'comment-to-dm',  label: 'Convert Comments to DM', icon: 'fas fa-comment-dollar', iconClass: 'text-blue-500',    iconBg: 'rgba(59,130,246,0.12)',  desc: 'Auto-reply to product comments and send a DM with buy link.' },
    { id: 'follow-invite',  label: 'Comment to Follow',       icon: 'fas fa-user-plus',      iconClass: 'text-purple-500',  iconBg: 'rgba(168,85,247,0.12)',  desc: 'Invite commenters to follow your page via a private DM.' },
    { id: 'sales-flow',     label: 'Comment to Purchase',     icon: 'fas fa-shopping-cart',  iconClass: 'text-emerald-500', iconBg: 'rgba(16,185,129,0.12)',  desc: 'Guide hesitant buyers through a multi-step sales DM flow.' },
    { id: 'story-to-dm',    label: 'Story to DM',             icon: 'fas fa-circle-play',    iconClass: 'text-orange-500',  iconBg: 'rgba(249,115,22,0.12)',  desc: 'Auto-send product DMs when someone replies to or mentions your story.' },
  ];

  /** Quick-save in progress for overview card toggle */
  togglingGoal: GoalId | null = null;

  // ── Comment-to-DM ──────────────────────────────────────────────────────────
  ctdSettings: ICommentToDmSettings | null = null;
  loadingCtd = false;
  savingCtd = false;
  savingCtdDedup = false;
  ctdError = '';
  keywordsInput = '';

  // ── Follow Invite ──────────────────────────────────────────────────────────
  fiSettings: ICommentFollowInviteSettings | null = null;
  /** Single textarea → split to API `title` / `subtitle` on save (was wrongly bound to non-existent `dmTemplate`). */
  fiDmDraft = '';
  loadingFi = false;
  savingFi = false;
  fiError = '';

  // ── Sales Flow ────────────────────────────────────────────────────────────
  sfSettings: ISalesFlowSettings | null = null;
  loadingSf = false;
  savingSf = false;
  sfError = '';
  hesitancyInput = '';

  // ── Story-to-DM ───────────────────────────────────────────────────────────
  stdSettings: IStoryToDmSettings | null = null;
  loadingStd = false;
  savingStd = false;
  stdError = '';
  stdKeywordsInput = '';

  constructor(
    private catalogService: CatalogService,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCtd();
    this.loadFi();
    this.loadSf();
    this.loadStd();
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
      .subscribe({
        next: r => {
          this.fiSettings = r.data ?? null;
          this.fiDmDraft = this.followInviteDraftFromApi(this.fiSettings);
        }
      });
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

  loadStd(): void {
    this.loadingStd = true;
    this.catalogService.getStoryToDmSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingStd = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.stdSettings = r.data ?? null;
          if (this.stdSettings) {
            this.stdKeywordsInput = (this.stdSettings.triggerKeywords || []).join(', ');
          }
        }
      });
  }

  // ── Savers ────────────────────────────────────────────────────────────────
  saveCtd(): void {
    if (!this.ctdSettings) return;
    this.savingCtd = true; this.ctdError = '';
    const payload = { ...this.ctdSettings, triggerKeywords: this.keywordsInput.split(',').map(k => k.trim()).filter(Boolean) };
    this.catalogService.updateCommentToDmSettings(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingCtd = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: res => {
          this.ctdSettings = res.data ?? this.ctdSettings;
          if (this.ctdSettings) {
            this.keywordsInput = this.ctdSettings.triggerKeywords?.join(', ') || '';
          }
          this.notify.success('Saved', 'Comment-to-DM settings saved.');
        },
        error: err => { this.ctdError = err?.error?.error || 'Save failed'; }
      });
  }

  onCtdDedupChange(value: boolean): void {
    if (!this.ctdSettings) return;
    const previous = this.ctdSettings.deduplicateDms;
    this.ctdSettings.deduplicateDms = value;
    this.savingCtdDedup = true;
    this.ctdError = '';
    this.cdr.markForCheck();

    this.catalogService.updateCommentToDmSettings({ deduplicateDms: value })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.savingCtdDedup = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: res => {
          if (res.data) {
            this.ctdSettings = { ...this.ctdSettings!, deduplicateDms: res.data.deduplicateDms };
          }
        },
        error: err => {
          this.ctdSettings!.deduplicateDms = previous;
          this.ctdError = err?.error?.error || 'Could not save skip-duplicates setting';
        }
      });
  }

  saveFi(): void {
    if (!this.fiSettings) return;
    this.savingFi = true; this.fiError = '';
    const { title, subtitle } = this.parseFollowInviteDraft(this.fiDmDraft);
    const payload: ICommentFollowInviteSettings = {
      ...this.fiSettings,
      title,
      subtitle
    };
    this.catalogService.updateCommentFollowInviteSettings(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingFi = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: res => {
          this.fiSettings = res.data ?? this.fiSettings;
          this.fiDmDraft = this.followInviteDraftFromApi(this.fiSettings);
          this.notify.success('Saved', 'Follow-Invite settings saved.');
        },
        error: err => { this.fiError = err?.error?.error || 'Save failed'; }
      });
  }

  /** Build one textarea from stored title + subtitle (Instagram generic template). */
  private followInviteDraftFromApi(s: ICommentFollowInviteSettings | null): string {
    if (!s) return '';
    const t = (s.title || '').trim();
    const u = (s.subtitle || '').trim();
    if (!t && !u) return '';
    return u ? `${t}\n${u}` : t;
  }

  /**
   * First non-empty line → title (max 80). Remaining lines joined → subtitle (max 80).
   * Single long line → split at 80 / 80 for Meta limits.
   */
  private parseFollowInviteDraft(draft: string): { title: string; subtitle: string } {
    const MAX = 80;
    const fallbackTitle = 'Thanks for your comment!';
    const fallbackSubtitle = 'Tap below to follow us for more updates.';
    const text = (draft || '').trim();
    if (!text) {
      return { title: fallbackTitle, subtitle: fallbackSubtitle };
    }
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      return { title: fallbackTitle, subtitle: fallbackSubtitle };
    }
    if (lines.length === 1) {
      const one = lines[0];
      if (one.length <= MAX) {
        return { title: one.slice(0, MAX), subtitle: '' };
      }
      return {
        title: one.slice(0, MAX),
        subtitle: one.slice(MAX, MAX * 2).trim()
      };
    }
    return {
      title: lines[0].slice(0, MAX),
      subtitle: lines.slice(1).join(' ').slice(0, MAX)
    };
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

  saveStd(): void {
    if (!this.stdSettings) return;
    this.savingStd = true;
    this.stdError = '';
    const payload: Partial<IStoryToDmSettings> = {
      ...this.stdSettings,
      triggerKeywords: this.stdKeywordsInput.split(',').map(k => k.trim()).filter(Boolean)
    };
    this.catalogService.updateStoryToDmSettings(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingStd = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: r => {
          this.stdSettings = r.data ?? this.stdSettings;
          this.notify.success('Saved', 'Story-to-DM settings saved.');
        },
        error: err => { this.stdError = err?.error?.error || 'Save failed'; }
      });
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
    if (id === 'story-to-dm') return this.stdSettings?.enabled ? 'active' : 'inactive';
    return 'inactive';
  }

  get isOverviewLoading(): boolean {
    return this.loadingCtd || this.loadingFi || this.loadingSf || this.loadingStd;
  }

  isGoalSettingsReady(id: GoalId): boolean {
    switch (id) {
      case 'comment-to-dm': return !this.loadingCtd && !!this.ctdSettings;
      case 'follow-invite': return !this.loadingFi && !!this.fiSettings;
      case 'sales-flow': return !this.loadingSf && !!this.sfSettings;
      case 'story-to-dm': return !this.loadingStd && !!this.stdSettings;
    }
  }

  isGoalEnabled(id: GoalId): boolean {
    switch (id) {
      case 'comment-to-dm': return !!this.ctdSettings?.enabled;
      case 'follow-invite': return !!this.fiSettings?.enabled;
      case 'sales-flow': return !!this.sfSettings?.enabled;
      case 'story-to-dm': return !!this.stdSettings?.enabled;
    }
  }

  openGoal(id: GoalId): void {
    this.activeGoal = id;
    this.cdr.markForCheck();
  }

  backToOverview(): void {
    this.activeGoal = null;
    this.cdr.markForCheck();
  }

  activeGoalMeta(): IGrowthGoal | undefined {
    return this.activeGoal ? this.goals.find(g => g.id === this.activeGoal) : undefined;
  }

  onOverviewToggle(id: GoalId, enabled: boolean): void {
    const previous = this.isGoalEnabled(id);
    this.setGoalEnabled(id, enabled);
    this.togglingGoal = id;
    this.cdr.markForCheck();

    this.saveGoalEnabled(id, enabled)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.togglingGoal = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.notify.success(
            enabled ? 'Enabled' : 'Disabled',
            `${this.goals.find(g => g.id === id)?.label ?? 'Automation'} is now ${enabled ? 'on' : 'off'}.`
          );
        },
        error: (err: { error?: { error?: string } }) => {
          this.setGoalEnabled(id, previous);
          this.notify.error('Save failed', err?.error?.error || 'Could not update automation.');
        }
      });
  }

  private setGoalEnabled(id: GoalId, enabled: boolean): void {
    switch (id) {
      case 'comment-to-dm':
        if (this.ctdSettings) this.ctdSettings.enabled = enabled;
        break;
      case 'follow-invite':
        if (this.fiSettings) this.fiSettings.enabled = enabled;
        break;
      case 'sales-flow':
        if (this.sfSettings) this.sfSettings.enabled = enabled;
        break;
      case 'story-to-dm':
        if (this.stdSettings) this.stdSettings.enabled = enabled;
        break;
    }
  }

  private saveGoalEnabled(id: GoalId, enabled: boolean): Observable<IApiResponse<unknown>> {
    switch (id) {
      case 'comment-to-dm':
        return this.catalogService.updateCommentToDmSettings({ enabled });
      case 'follow-invite':
        return this.catalogService.updateCommentFollowInviteSettings({ enabled });
      case 'sales-flow':
        return this.catalogService.updateSalesFlowSettings({ enabled });
      case 'story-to-dm':
        return this.catalogService.updateStoryToDmSettings({ enabled });
      default: {
        const _exhaustive: never = id;
        throw new Error(`Unknown growth goal: ${_exhaustive}`);
      }
    }
  }

  trackByGoalId(_: number, g: IGrowthGoal): GoalId {
    return g.id;
  }

  trackByIndex(i: number): number { return i; }
}
