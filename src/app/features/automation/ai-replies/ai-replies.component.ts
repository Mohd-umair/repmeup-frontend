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

  /** Matches backend maxlength on Organization.autoReplySettings.toneCustomText */
  readonly maxToneCustomLength = 800;

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
    webhookDelay: 5,
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

  activeSection: 'general' | 'channels' | 'tone' | 'advanced' | 'knowledgeBase' = 'general';

  constructor(
    private authService: AuthService,
    private orgService: OrganizationService,
    private notify: NotificationService,
    private permissionService: PermissionService
  ) {}

  /** Matches standalone Knowledge Base route guard (`knowledge_base.read`). */
  get canViewKnowledgeBase(): boolean {
    return this.permissionService.hasPermission('knowledge_base.read');
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

  loadSettings(): void {
    this.orgService.getOrganization(this.orgId)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({
        next: r => {
          if (r.data?.autoReplySettings) {
            this.settings = { ...this.settings, ...r.data.autoReplySettings };
          }
        },
        error: () => { this.error = 'Failed to load settings.'; }
      });
  }

  save(): void {
    this.saving = true;

    if ((this.settings.toneCustomText || '').length > this.maxToneCustomLength) {
      this.settings.toneCustomText = this.settings.toneCustomText!.slice(0, this.maxToneCustomLength);
    }
    this.orgService.updateAutoReplySettings(this.orgId, this.settings)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.saving = false; }))
      .subscribe({
        next: r => {
          if (r.data?.autoReplySettings) {
            this.settings = { ...this.settings, ...r.data.autoReplySettings };
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

  get confidencePct(): number {
    return Math.round((this.settings.minConfidence || 0.75) * 100);
  }
  get toneCustomRemaining(): number {
    return this.maxToneCustomLength - (this.settings.toneCustomText?.length || 0);
  }
}
