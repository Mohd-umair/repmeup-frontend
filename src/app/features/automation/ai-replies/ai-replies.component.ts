import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { OrganizationService, AutoReplySettings } from '../../../core/services/organization.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';
import { AutomationChannelToggleComponent, ALL_CHANNELS } from '../shared/automation-channel-toggle.component';
import { AutomationSwitchComponent } from '../shared/automation-switch.component';
import { KnowledgeBaseComponent } from '../../knowledge-base/knowledge-base.component';
import { PermissionService } from '../../../core/services/permission.service';
import { EntitlementsStore, FEATURE_KEY } from '../../../core/services/entitlements.store';
import { UpgradePromptComponent } from '../../../shared/components/upgrade-prompt/upgrade-prompt.component';

type AiToneKey = NonNullable<AutoReplySettings['tone']>;
type AiSectionId = 'general' | 'channels' | 'tone' | 'advanced' | 'knowledgeBase';
type ReplyDelayMode = NonNullable<AutoReplySettings['replyDelayMode']>;

interface IAiSection {
  id: AiSectionId;
  label: string;
  desc: string;
  icon: string;
  iconClass: string;
  iconBg: string;
}

@Component({
  selector: 'app-ai-replies',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AutomationPageShellComponent,
    AutomationChannelToggleComponent,
    AutomationSwitchComponent,
    KnowledgeBaseComponent,
    UpgradePromptComponent
  ],
  templateUrl: './ai-replies.component.html',
  styleUrls: ['./ai-replies.component.scss']
})
export class AiRepliesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly ent = inject(EntitlementsStore);
  readonly FEATURE_KEY = FEATURE_KEY;
  readonly planAllowed = computed(() => this.ent.can(FEATURE_KEY.AUTO_REPLY_ENABLED));
  private orgId = '';

  loading = true;
  saving = false;
  error = '';

  allChannels = ALL_CHANNELS;
  enabledTypeOptions = [
    { key: 'comment', label: 'Comments', icon: 'fas fa-comment' },
    { key: 'dm', label: 'DMs / Messages', icon: 'fas fa-envelope' },
    { key: 'review', label: 'Reviews', icon: 'fas fa-star' },
    { key: 'story', label: 'Stories', icon: 'fas fa-circle-notch' },
  ];

  toneOptions: { key: AiToneKey; label: string; icon: string; desc: string }[] = [
    { key: 'growth', label: 'Growth', icon: 'fas fa-rocket', desc: 'Proactive, promotional, drives conversions' },
    { key: 'balanced', label: 'Balanced', icon: 'fas fa-balance-scale', desc: 'Friendly and helpful — recommended default' },
    { key: 'safe', label: 'Safe', icon: 'fas fa-shield-alt', desc: 'Conservative, avoids risk, always neutral' },
    { key: 'custom', label: 'Custom', icon: 'fas fa-pen-fancy', desc: 'Describe your own brand voice for AI replies' },
  ];

  readonly maxToneCustomLength = 800;

  readonly maxDelayMinutes = 120;

  replyDelayModeOptions: { key: ReplyDelayMode; label: string; icon: string; desc: string }[] = [
    { key: 'fixed', label: 'Fixed delay', icon: 'fas fa-clock', desc: 'Wait an exact number of minutes before each reply is sent' },
    { key: 'human', label: 'Human delay', icon: 'fas fa-user-clock', desc: 'Send as soon as AI finishes — with a brief natural pause so it does not feel instant' },
  ];

  sections: IAiSection[] = [
    { id: 'general', label: 'General', desc: 'Reply types, send delay, confidence threshold, auto-send limits', icon: 'fas fa-sliders-h', iconClass: 'text-blue-500', iconBg: 'rgba(59,130,246,0.12)' },
    { id: 'channels', label: 'Channels', desc: 'Platforms, sentiment filter, negative & complaint replies', icon: 'fas fa-network-wired', iconClass: 'text-emerald-500', iconBg: 'rgba(16,185,129,0.12)' },
    { id: 'tone', label: 'Tone', desc: 'How AI replies should sound to your customers', icon: 'fas fa-palette', iconClass: 'text-purple-500', iconBg: 'rgba(168,85,247,0.12)' },
    { id: 'advanced', label: 'Advanced', desc: 'Quiet hours and fallback when confidence is too low', icon: 'fas fa-cog', iconClass: 'text-orange-500', iconBg: 'rgba(249,115,22,0.12)' },
    { id: 'knowledgeBase', label: 'Knowledge Base', desc: 'Documents and FAQs the AI uses for context', icon: 'fas fa-database', iconClass: 'text-cyan-500', iconBg: 'rgba(6,182,212,0.12)' },
  ];

  settings: AutoReplySettings = {
    enabled: false,
    enabledPlatforms: ['instagram', 'facebook', 'whatsapp'],
    enabledTypes: ['comment', 'review', 'dm'],
    sentimentFilter: 'all',
    replyToNegative: false,
    replyToComplaints: false,
    minConfidence: 0.75,
    autoSend: true,
    requireApproval: false,
    maxRepliesPerDay: 50,
    triggerMode: 'hybrid',
    webhookImmediate: true,
    webhookDelay: 1,
    replyDelayMode: 'fixed',
    scheduleInterval: '24hours',
    scheduleEnabled: true,
    tone: 'balanced',
    toneCustomText: '',
    quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'Asia/Kolkata' },
    skipNegativeKeywords: [],
    fallbackSettings: {
      enabled: false,
      message: 'Our Agent will contact you within 24 hours.',
      assignToAgent: true,
      notifyByEmail: true
    }
  };

  /** null = overview list (Growth-style) */
  activeSection: AiSectionId | null = null;

  constructor(
    private authService: AuthService,
    private orgService: OrganizationService,
    private notify: NotificationService,
    private permissionService: PermissionService
  ) {}

  get canViewKnowledgeBase(): boolean {
    return this.permissionService.hasPermission('knowledge_base.read');
  }

  get visibleSections(): IAiSection[] {
    return this.sections.filter(s => s.id !== 'knowledgeBase' || this.canViewKnowledgeBase);
  }

  get activeSectionMeta(): IAiSection | undefined {
    return this.activeSection ? this.sections.find(s => s.id === this.activeSection) : undefined;
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user?.organization) {
        this.orgId = typeof user.organization === 'string' ? user.organization : (user.organization as any)._id;
        this.loadSettings();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openSection(id: AiSectionId): void {
    this.activeSection = id;
  }

  backToOverview(): void {
    this.activeSection = null;
  }

  loadSettings(): void {
    this.orgService.getOrganization(this.orgId)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({
        next: r => {
          if (r.data?.autoReplySettings) {
            this.settings = { ...this.settings, ...r.data.autoReplySettings };
            this.normalizeMinConfidence();
            this.normalizeReplyDelaySettings();
          }
        },
        error: () => { this.error = 'Failed to load settings.'; }
      });
  }

  save(): void {
    this.saving = true;
    this.normalizeMinConfidence();
    this.normalizeReplyDelaySettings();

    if ((this.settings.toneCustomText || '').length > this.maxToneCustomLength) {
      this.settings.toneCustomText = this.settings.toneCustomText!.slice(0, this.maxToneCustomLength);
    }
    this.orgService.updateAutoReplySettings(this.orgId, this.settings)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.saving = false; }))
      .subscribe({
        next: r => {
          if (r.data?.autoReplySettings) {
            this.settings = { ...this.settings, ...r.data.autoReplySettings };
            this.normalizeMinConfidence();
            this.normalizeReplyDelaySettings();
          }
          this.notify.success('Saved', 'AI Auto Reply settings saved.');
        },
        error: err => {
          this.notify.error('Error', err?.error?.error || 'Failed to save settings.');
        }
      });
  }

  isTypeEnabled(type: string): boolean {
    return (this.settings.enabledTypes || []).includes(type);
  }

  setTypeEnabled(type: string, enabled: boolean): void {
    const set = new Set(this.settings.enabledTypes || []);
    if (enabled) set.add(type);
    else set.delete(type);
    this.settings = { ...this.settings, enabledTypes: Array.from(set) };
  }

  /** Slider display value 0–100 */
  get confidencePct(): number {
    return Math.round(this.normalizeMinConfidence() * 100);
  }

  set confidencePct(pct: number) {
    const clamped = Math.min(100, Math.max(0, pct));
    this.settings = { ...this.settings, minConfidence: clamped / 100 };
  }

  onConfidenceInput(value: number | string): void {
    this.confidencePct = typeof value === 'string' ? parseInt(value, 10) : value;
  }

  setReplyDelayMode(mode: ReplyDelayMode): void {
    this.settings = { ...this.settings, replyDelayMode: mode };
  }

  get replyDelaySummary(): string {
    if (this.settings.replyDelayMode === 'human') {
      return 'As soon as possible';
    }
    return `${this.settings.webhookDelay ?? 1} min`;
  }

  /** Clamp and validate delay fields before save */
  private normalizeReplyDelaySettings(): void {
    const mode = this.settings.replyDelayMode === 'human' ? 'human' : 'fixed';
    let webhookDelay = Math.round(Number(this.settings.webhookDelay ?? 1));

    if (!Number.isFinite(webhookDelay)) webhookDelay = 1;
    webhookDelay = Math.min(this.maxDelayMinutes, Math.max(0, webhookDelay));

    this.settings = {
      ...this.settings,
      replyDelayMode: mode,
      webhookDelay
    };
  }

  /** Ensure minConfidence is stored as 0–1 (handles legacy 0–100 values) */
  private normalizeMinConfidence(): number {
    let v = this.settings.minConfidence ?? 0.75;
    if (v > 1) v = v / 100;
    v = Math.min(1, Math.max(0, v));
    this.settings.minConfidence = v;
    return v;
  }

  get toneCustomRemaining(): number {
    return this.maxToneCustomLength - (this.settings.toneCustomText?.length || 0);
  }

  trackBySectionId(_: number, s: IAiSection): AiSectionId {
    return s.id;
  }

  trackByTypeKey(_: number, t: { key: string }): string {
    return t.key;
  }

  trackByToneKey(_: number, t: { key: AiToneKey }): AiToneKey {
    return t.key;
  }

  trackByDelayModeKey(_: number, d: { key: ReplyDelayMode }): ReplyDelayMode {
    return d.key;
  }
}
