import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { InboxService } from '../../../core/services/inbox.service';
import { PlatformService } from '../../../core/services/platform.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserService, IAvailableAgent } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { SocketService } from '../../../core/services/socket.service';
import { IInteraction, IInboxFilters, InboxViewMode, ILabel } from '../../../core/models/interaction.model';
import { inboxFilterToArray, inboxFilterMatches, inboxIntentBucketMatches } from '../../../core/utils/inbox-filter-values';
import { IntentBucketService, IIntentBucket } from '../../../core/services/intent-bucket.service';
import { InboxDetailComponent } from '../inbox-detail/inbox-detail.component';
import { InboxListComponent } from '../inbox-list/inbox-list.component';
import { InboxTopFiltersComponent } from '../inbox-top-filters/inbox-top-filters.component';
import { InboxActionsComponent } from '../inbox-actions/inbox-actions.component';
import { InboxAiAssistantComponent } from '../inbox-ai-assistant/inbox-ai-assistant.component';
import { InboxBucketViewComponent } from '../inbox-bucket-view/inbox-bucket-view.component';
import { InboxSummaryComponent } from '../inbox-summary/inbox-summary.component';
import { InboxContactPanelComponent } from '../inbox-contact-panel/inbox-contact-panel.component';
import { InboxSetupGuideComponent } from '../inbox-setup-guide/inbox-setup-guide.component';
import { OrganizationService, AutoReplySettings } from '../../../core/services/organization.service';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { PlatformConnectionService } from '../../../core/services/platform-connection.service';
import { forkJoin, timer, Subscription, of, from, interval } from 'rxjs';
import { exhaustMap, catchError, take, map, filter } from 'rxjs/operators';
import { Router, NavigationEnd } from '@angular/router';

/**
 * Inbox Container Component - Single Responsibility Principle
 * Manages the unified inbox with three-column layout
 */
@Component({
  selector: 'app-inbox-container',
  standalone: true,
  imports: [CommonModule, FormsModule, InboxDetailComponent, InboxListComponent, InboxTopFiltersComponent, InboxActionsComponent, InboxAiAssistantComponent, InboxBucketViewComponent, InboxSummaryComponent, InboxContactPanelComponent, InboxSetupGuideComponent],
  templateUrl: './inbox-container.component.html',
  styleUrls: ['./inbox-container.component.scss']
})
export class InboxContainerComponent implements OnInit, OnDestroy {
  currentPage = 1;
  hasMoreConversations = false;
  loadingMoreConversations = false;
  totalConversations = 0;
  showConversationSearch = false;
  /** No longer drives active states — kept only so old template bindings compile. Use isXxxActive() helpers instead. */
  conversationQuickFilter: 'all' | 'unread' | 'platforms' | 'intent' = 'all';
  showConversationPlatformDropdown = false;
  showConversationIntentDropdown = false;
  showBucketSentimentDropdown = false;
  conversationPlatformOptions: string[] = [];
  conversationIntentBuckets: IIntentBucket[] = [];
  rightPanelTab: 'actions' | 'suggestions' | 'summary' | 'contact' = 'suggestions';

  // Setup guide
  orgAutoReplySettings: AutoReplySettings | null = null;
  orgHasKnowledgeBase = false;
  orgHasConnectedPlatform = false;
  orgIdForGuide: string | null = null;
  setupGuideDismissed = false;

  interactions: IInteraction[] = [];
  selectedInteraction: IInteraction | null = null;
  filters: IInboxFilters = {};
  platformFilters: IInboxFilters = {};
  topFilters: IInboxFilters = {};
  viewMode: InboxViewMode = 'all';
  /** Restored when switching from intent buckets back to list view */
  lastListViewMode: InboxViewMode = 'all';
  loading = false;
  syncing = false;
  analyzingSentiment = false;
  lastSyncTime: Date | null = null;
  autoSyncEnabled = true;
  showStats = false; // Stats are hidden by default for cleaner UI
  showFilters = true; // Filters are shown by default, but can be collapsed
  inboxStats: { 
    responseRate?: number;
    priorityCount?: number;
    overdueCount?: number;
  } | null = null;
  showShortcutsOverlay = false;
  showMoreOptions = false;      // Header more options dropdown
  showBulkMoreActions = false;  // Bulk assign dropdown
  showBulkLabelActions = false; // Bulk label dropdown
  assignDropdownPos: { top: number; left: number } | null = null;
  labelDropdownPos: { top: number; left: number } | null = null;
  selectedIds = new Set<string>();
  bulkProcessing = false;
  availableAgents: IAvailableAgent[] = [];
  bulkAssignAgentId = '';
  orgLabels: ILabel[] = [];
  bulkLabelId = '';
  @ViewChild(InboxDetailComponent) inboxDetail?: InboxDetailComponent;
  private autoSyncSubscription?: Subscription;
  private inboxPollSubscription?: Subscription;
  private subscriptions: Subscription[] = [];
  /** Deferred bulk-dropdown attach (replaces setTimeout 0) */
  private bulkDropdownDeferSub?: Subscription;

  constructor(
    private inboxService: InboxService,
    private platformService: PlatformService,
    private notificationService: NotificationService,
    private sweetAlertService: SweetAlertService,
    private themeService: ThemeService,
    private userService: UserService,
    private authService: AuthService,
    private organizationService: OrganizationService,
    private knowledgeBaseService: KnowledgeBaseService,
    private platformConnectionService: PlatformConnectionService,
    private intentBucketService: IntentBucketService,
    private socketService: SocketService,
    private route: ActivatedRoute,
    private router: Router,
    private elRef: ElementRef<HTMLElement>
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.showMoreOptions) return;
    if (this.elRef.nativeElement.contains(ev.target as Node)) return;
    this.showMoreOptions = false;
  }

  ngOnInit(): void {
    // Don't select any conversation by default
    this.selectedInteraction = null;
    
    // Reset theme to default (light black/gray) when entering inbox
    this.themeService.resetTheme();
    
    this.applyThemeForPlatformFilters();
    
    // Apply initial filters from route query params (e.g. ?sentiment=negative, ?status=unread, ?postId=... from Content)
    const params = this.route.snapshot.queryParams;
    if (params['sentiment']) {
      this.topFilters = { ...this.topFilters, sentiment: params['sentiment'] as any };
    }
    if (params['status']) {
      this.topFilters = { ...this.topFilters, status: params['status'] as any };
    }
    if (params['overdue'] === 'true' || params['overdue'] === '1') {
      this.viewMode = 'overdue';
    }
    if (params['postId']) {
      this.platformFilters = { ...this.platformFilters, postId: params['postId'] };
    }
    if (params['platform']) {
      this.platformFilters = { ...this.platformFilters, platform: params['platform'] as any };
    }
    if (params['type']) {
      this.topFilters = { ...this.topFilters, type: params['type'] as any };
    }
    if (this.viewMode !== 'buckets') {
      this.lastListViewMode = this.viewMode;
    }

    // Load saved auto-sync preference from the organisation
    this.loadAutoSyncSetting();
    // Refresh setup-guide KB/platform status whenever the user navigates back to inbox
    this.watchSetupGuideRefresh();
    this.loadConversationPlatformOptions();
    this.intentBucketService.getBuckets().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.conversationIntentBuckets = [...res.data].sort(
            (a: IIntentBucket, b: IIntentBucket) => (a.order ?? 0) - (b.order ?? 0)
          );
        }
      },
      error: () => {
        this.conversationIntentBuckets = [];
      }
    });

    this.updateMergedBucketFilters();
    this.loadInteractions(true);
    this.loadInboxStats();

    // Connect socket and join organisation room for real-time DM/comment updates
    this.socketService.connect();
    const orgId = this.getOrgId();
    const joinOrgRoom = () => { if (orgId) this.socketService.joinOrganization(orgId); };
    joinOrgRoom();

    // Re-join the org room after reconnects (e.g. network hiccup)
    this.subscriptions.push(
      this.socketService.connectionStatus$.subscribe(connected => {
        if (connected) joinOrgRoom();
      })
    );

    // Real-time: new message arrives → update service so list stays at top and isn't overwritten by next API response
    this.subscriptions.push(
      this.socketService.onNewInteraction().subscribe((data: any) => {
        const incoming: IInteraction = data?.interaction;
        if (!incoming) return;

        if (!inboxFilterMatches(this.platformFilters.platform as any, incoming.platform)) return;
        if (!inboxFilterMatches(this.topFilters.type as any, incoming.type)) return;
        if (!inboxIntentBucketMatches(this.topFilters.intentBucket, incoming)) return;
        const chatSession = (this.topFilters as IInboxFilters & { chatSession?: 'open' | 'closed' }).chatSession;
        if (chatSession === 'open' && incoming.chatOpen === false) return;
        if (chatSession === 'closed' && incoming.chatOpen !== false) return;
        // New messages are always unread — so if the unread filter is active they qualify.
        // If a non-unread status filter is active (e.g. resolved), skip new incoming messages.
        const statusFilter = (this.topFilters.status as string) || '';
        if (statusFilter && statusFilter !== 'unread') return;

        // Update service so merged list keeps this at top when poll/API returns
        this.inboxService.prependOrUpdateInteraction(incoming);

        // If the currently open detail is this thread, refresh it too
        if (this.selectedInteraction?._id === incoming._id) {
          this.inboxService.setSelectedInteraction(incoming);
        }
      })
    );

    // Real-time: an existing interaction was updated (e.g. AI auto-reply set status to 'replied')
    this.subscriptions.push(
      this.socketService.onInteractionUpdate().subscribe((data: any) => {
        const updated: IInteraction = data?.interaction;
        if (!updated) return;

        // Always update the service so the list row reflects new status immediately
        this.inboxService.prependOrUpdateInteraction(updated);

        // If this is the open conversation, refresh the detail panel too
        if (this.selectedInteraction?._id === updated._id) {
          this.inboxService.setSelectedInteraction(updated);
        }
      })
    );

    // Fallback poll every 30s in case socket misses an event (tab was backgrounded, etc.)
    this.inboxPollSubscription = interval(30000).subscribe(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        this.refreshInboxListSilent();
      }
    });

    // Subscribe to interactions (must unsubscribe on destroy to avoid memory leak)
    this.subscriptions.push(
      this.inboxService.interactions$.subscribe(interactions => {
        this.interactions = this.applyViewModeSort(interactions);
      })
    );

    // Subscribe to selected interaction
    this.subscriptions.push(
      this.inboxService.selectedInteraction$.subscribe(interaction => {
        this.selectedInteraction = interaction;
      })
    );

    // Load agents for bulk assign (admin/manager only)
    if (this.canAssign()) {
      this.userService.getAvailableAgents().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.availableAgents = res.data;
            console.log('Available agents loaded:', this.availableAgents.length);
          }
        },
        error: (err) => {
          console.error('Failed to load agents:', err);
          this.notificationService.error('Failed to load agents', 'Could not load available agents for assignment');
        }
      });
    }

    // Load labels for bulk add
    this.inboxService.getLabels().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.orgLabels = res.data;
          console.log('Labels loaded:', this.orgLabels.length);
        }
      },
      error: (err) => {
        console.error('Failed to load labels:', err);
      }
    });
  }

  onSelectionChange(next: Set<string>): void {
    this.selectedIds = next;
  }

  clearBulkSelection(): void {
    this.selectedIds = new Set();
    this.showBulkMoreActions = false;
    this.showBulkLabelActions = false;
    this.assignDropdownPos = null;
    this.labelDropdownPos = null;
  }

  /** Open assign dropdown with fixed positioning (escapes overflow clipping) */
  toggleAssignDropdown(ev?: Event): void {
    this.showBulkLabelActions = false;
    this.labelDropdownPos = null;
    if (this.showBulkMoreActions) {
      this.showBulkMoreActions = false;
      this.assignDropdownPos = null;
      return;
    }
    this.showBulkMoreActions = true;
    const btn = (ev?.currentTarget ?? ev?.target) as HTMLElement;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      this.assignDropdownPos = { top: rect.bottom + 6, left: rect.left };
    } else {
      this.assignDropdownPos = { top: 120, left: 24 };
    }
    this.scheduleBulkDropdownAttach();
  }

  /** Open label dropdown with fixed positioning (escapes overflow clipping) */
  toggleLabelDropdown(ev?: Event): void {
    this.showBulkMoreActions = false;
    this.assignDropdownPos = null;
    if (this.showBulkLabelActions) {
      this.showBulkLabelActions = false;
      this.labelDropdownPos = null;
      return;
    }
    this.showBulkLabelActions = true;
    const btn = (ev?.currentTarget ?? ev?.target) as HTMLElement;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      this.labelDropdownPos = { top: rect.bottom + 6, left: rect.left };
    } else {
      this.labelDropdownPos = { top: 120, left: 24 };
    }
    this.scheduleBulkDropdownAttach();
  }

  private scheduleBulkDropdownAttach(): void {
    this.bulkDropdownDeferSub?.unsubscribe();
    this.bulkDropdownDeferSub = timer(0)
      .pipe(take(1))
      .subscribe(() => {
        this.bulkDropdownDeferSub = undefined;
        this.attachDropdownCloseListener();
      });
  }

  private dropdownCloseHandler = (): void => {
    this.showBulkMoreActions = false;
    this.showBulkLabelActions = false;
    this.assignDropdownPos = null;
    this.labelDropdownPos = null;
    document.removeEventListener('click', this.dropdownCloseHandler);
  };

  private attachDropdownCloseListener(): void {
    document.removeEventListener('click', this.dropdownCloseHandler);
    this.bulkDropdownDeferSub?.unsubscribe();
    this.bulkDropdownDeferSub = timer(0)
      .pipe(take(1))
      .subscribe(() => {
        this.bulkDropdownDeferSub = undefined;
        document.addEventListener('click', this.dropdownCloseHandler);
      });
  }

  selectAllOnPage(): void {
    this.selectedIds = new Set(this.interactions.map(i => i._id));
  }

  bulkMarkAsRead(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.updateStatusBulk(ids, 'read').subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Bulk update', `Marked ${(res as any).data?.updated || ids.length} as read`);
          this.clearBulkSelection();
          this.loadInteractions(true);
          this.refreshSelectedIfAffected(ids);
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  bulkResolve(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.sweetAlertService.warning('No Selection', 'Please select conversations to resolve');
      return;
    }

    this.sweetAlertService.confirm(
      'Mark as Resolved?',
      `Are you sure you want to mark ${ids.length} conversation(s) as resolved?`,
      'Yes, Resolve',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        this.bulkProcessing = true;
        this.sweetAlertService.showLoading('Resolving...', 'Please wait while we resolve the conversations');
        
        this.inboxService.updateStatusBulk(ids, 'resolved').subscribe({
          next: (res) => {
            this.sweetAlertService.close();
            if (res.success) {
              const updatedCount = (res as any).data?.updated || ids.length;
              this.sweetAlertService.success(
                'Success!',
                `Resolved ${updatedCount} conversation(s)`
              );
              this.clearBulkSelection();
              this.loadInteractions(true);
              this.refreshSelectedIfAffected(ids);
            }
            this.bulkProcessing = false;
          },
          error: (err) => {
            this.sweetAlertService.close();
            this.sweetAlertService.error(
              'Error',
              err?.error?.message || 'Failed to resolve conversations'
            );
            this.bulkProcessing = false;
          }
        });
      }
    });
  }

  bulkAssign(): void {
    if (!this.bulkAssignAgentId) return;
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.assignBulk(ids, this.bulkAssignAgentId).subscribe({
      next: (res) => {
        if (res.success) {
          const count = (res as any).data?.updated || ids.length;
          const agent = this.availableAgents.find(a => a._id === this.bulkAssignAgentId);
          const agentName = agent ? `${agent.firstName} ${agent.lastName}` : 'agent';
          this.notificationService.success('Assigned', `${count} conversation(s) assigned to ${agentName}`);
          this.clearBulkSelection();
          this.bulkAssignAgentId = '';
          this.loadInteractions(true);
          // Refresh agent workload counts
          this.refreshAgentWorkloads();
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  /** Assign directly from dropdown — avoids two-step property set + call */
  assignToAgent(agentId: string): void {
    this.bulkAssignAgentId = agentId;
    this.showBulkMoreActions = false;
    this.assignDropdownPos = null;
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.assignBulk(ids, agentId).subscribe({
      next: (res) => {
        if (res.success) {
          const count = (res as any).data?.updated || ids.length;
          const agent = this.availableAgents.find(a => a._id === agentId);
          const agentName = agent ? `${agent.firstName} ${agent.lastName}` : 'agent';
          this.notificationService.success('Assigned', `${count} conversation(s) assigned to ${agentName}`);
          this.clearBulkSelection();
          this.bulkAssignAgentId = '';
          this.loadInteractions(true);
          this.refreshAgentWorkloads();
          // Re-fetch the open detail panel so the "Assigned to…" banner appears immediately
          this.refreshSelectedIfAffected(ids);
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  refreshAgentWorkloads(): void {
    if (!this.canAssign()) return;
    this.userService.getAvailableAgents().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.availableAgents = res.data;
        }
      }
    });
  }

  canAssign(): boolean {
    const user = this.authService.currentUserValue;
    return !!(user && (user.role === 'admin' || user.role === 'manager'));
  }

  bulkAddLabel(): void {
    if (!this.bulkLabelId) return;
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.addLabelBulk(ids, this.bulkLabelId).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Bulk label', `Added label to ${(res as any).data?.updated || ids.length} conversation(s)`);
          this.clearBulkSelection();
          this.bulkLabelId = '';
          this.loadInteractions(true);
          this.refreshSelectedIfAffected(ids);
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  bulkArchive(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.sweetAlertService.warning('No Selection', 'Please select conversations to archive');
      return;
    }

    this.sweetAlertService.confirm(
      'Archive Conversations?',
      `Are you sure you want to archive ${ids.length} conversation(s)?`,
      'Yes, Archive',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        this.bulkProcessing = true;
        this.sweetAlertService.showLoading('Archiving...', 'Please wait while we archive the conversations');
        
        this.inboxService.updateStatusBulk(ids, 'archived').subscribe({
          next: (res) => {
            this.sweetAlertService.close();
            if (res.success) {
              const updatedCount = (res as any).data?.updated || ids.length;
              this.sweetAlertService.success(
                'Success!',
                `Archived ${updatedCount} conversation(s)`
              );
              this.clearBulkSelection();
              this.loadInteractions(true);
              this.refreshSelectedIfAffected(ids);
            }
            this.bulkProcessing = false;
          },
          error: (err) => {
            this.sweetAlertService.close();
            this.sweetAlertService.error(
              'Error',
              err?.error?.message || 'Failed to archive conversations'
            );
            this.bulkProcessing = false;
          }
        });
      }
    });
  }

  bulkUnarchive(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.sweetAlertService.warning('No Selection', 'Please select conversations to unarchive');
      return;
    }

    this.sweetAlertService.confirm(
      'Unarchive Conversations?',
      `Are you sure you want to unarchive ${ids.length} conversation(s)?`,
      'Yes, Unarchive',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        this.bulkProcessing = true;
        this.sweetAlertService.showLoading('Unarchiving...', 'Please wait while we unarchive the conversations');
        
        this.inboxService.updateStatusBulk(ids, 'unread').subscribe({
          next: (res) => {
            this.sweetAlertService.close();
            if (res.success) {
              const updatedCount = (res as any).data?.updated || ids.length;
              this.sweetAlertService.success(
                'Success!',
                `Unarchived ${updatedCount} conversation(s)`
              );
              this.clearBulkSelection();
              this.loadInteractions(true);
              this.refreshSelectedIfAffected(ids);
            }
            this.bulkProcessing = false;
          },
          error: (err) => {
            this.sweetAlertService.close();
            this.sweetAlertService.error(
              'Error',
              err?.error?.message || 'Failed to unarchive conversations'
            );
            this.bulkProcessing = false;
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.dropdownCloseHandler);
    this.bulkDropdownDeferSub?.unsubscribe();
    if (this.autoSyncSubscription) {
      this.autoSyncSubscription.unsubscribe();
    }
    if (this.inboxPollSubscription) {
      this.inboxPollSubscription.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.socketService.disconnect();
    this.themeService.resetTheme();
    // Clear selected chat and cached list so they never bleed into the next visit
    this.inboxService.clearState();
  }

  /**
   * Get platform-specific icon for the header
   */
  getHeaderIcon(): string {
    // If in archived view, show archive icon
    if (this.viewMode === 'archived') {
      return 'fas fa-archive';
    }

    const plats = inboxFilterToArray(this.platformFilters.platform as any);
    if (plats.length === 0) {
      return 'fas fa-inbox';
    }
    if (plats.length > 1) {
      return 'fas fa-layer-group';
    }

    const platformIcons: { [key: string]: string } = {
      'instagram': 'fab fa-instagram',
      'facebook': 'fab fa-facebook-f',
      'youtube': 'fab fa-youtube',
      'google': 'fab fa-google',
      'linkedin': 'fab fa-linkedin-in',
      'whatsapp': 'fab fa-whatsapp',
      'website': 'fas fa-globe'
    };

    return platformIcons[plats[0].toLowerCase()] || 'fas fa-inbox';
  }

  /**
   * Get platform-specific title for the header
   */
  getHeaderTitle(): string {
    // If in archived view, show archived title
    if (this.viewMode === 'archived') {
      return 'Archived Conversations';
    }
    
    const plats = inboxFilterToArray(this.platformFilters.platform as any);
    if (plats.length === 0) {
      return 'Unified Inbox';
    }
    if (plats.length > 1) {
      return 'Filtered Inbox';
    }
    const platformName = plats[0].charAt(0).toUpperCase() + plats[0].slice(1);
    return `${platformName} Inbox`;
  }

  /**
   * Get platform-specific subtitle for the header
   */
  getHeaderSubtitle(): string {
    const plats = inboxFilterToArray(this.platformFilters.platform as any);
    if (plats.length === 0) {
      return 'Manage all your interactions in one place';
    }
    if (plats.length > 1) {
      return `Showing ${plats.length} selected platforms`;
    }

    const platformSubtitles: { [key: string]: string } = {
      'instagram': 'Manage your Instagram comments and messages',
      'facebook': 'Manage your Facebook posts and comments',
      'youtube': 'Manage your YouTube comments',
      'google': 'Manage your Google Business reviews',
      'linkedin': 'Manage your LinkedIn posts and comments',
      'whatsapp': 'Manage your WhatsApp conversations',
      'website': 'Manage your website interactions'
    };

    const p = plats[0].toLowerCase();
    return platformSubtitles[p] || `Manage your ${plats[0]} interactions`;
  }

  /**
   * Start auto-sync for platforms (every 5 minutes)
   * Uses timer(0, 300000) to run immediately on start, then every 5 min
   */
  startAutoSync(): void {
    if (!this.autoSyncEnabled) {
      return;
    }

    // Unsubscribe any existing auto-sync before starting new one
    if (this.autoSyncSubscription) {
      this.autoSyncSubscription.unsubscribe();
      this.autoSyncSubscription = undefined;
    }

    // Sync immediately, then every 5 minutes (300000 ms).
    // exhaustMap: if a sync is still running when the timer fires, skip that tick.
    // catchError inside exhaustMap: errors are scoped to one iteration so they
    // never complete the outer timer Observable.
    this.autoSyncSubscription = timer(0, 300000)
      .pipe(
        exhaustMap(() =>
          from(this.syncAllPlatforms(true)).pipe(
            catchError((err) => {
              console.error('Auto-sync error:', err);
              return of(null);
            })
          )
        )
      )
      .subscribe({
        next: () => {
          if (this.autoSyncEnabled) {
            this.lastSyncTime = new Date();
          }
        }
      });
  }

  /** Get the current organisation ID from the authenticated user */
  private getOrgId(): string | null {
    const user = this.authService.currentUserValue;
    if (!user) return null;
    return typeof user.organization === 'string'
      ? user.organization
      : (user.organization as any)?._id ?? null;
  }

  /** Load the saved auto-sync preference from the backend */
  private loadAutoSyncSetting(): void {
    const orgId = this.getOrgId();
    if (!orgId) return;
    this.orgIdForGuide = orgId;
    this.organizationService.getOrganization(orgId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const saved = res.data.inboxSettings?.autoSyncEnabled;
          this.autoSyncEnabled = saved !== false;
          if (this.autoSyncEnabled) {
            this.startAutoSync();
          }
          // Capture org auto-reply settings for the setup guide
          this.orgAutoReplySettings = res.data.autoReplySettings ?? null;
          this.checkKnowledgeBaseExists();
          this.checkPlatformConnected();
        }
      },
      error: () => {
        this.startAutoSync();
      }
    });
  }

  /** Check if org has at least one KB entry (used by setup guide) */
  private checkKnowledgeBaseExists(): void {
    this.knowledgeBaseService.checkExists().subscribe({
      next: (exists) => { this.orgHasKnowledgeBase = exists; },
      error: () => { this.orgHasKnowledgeBase = false; }
    });
  }

  /** Check if org has at least one active platform connection (used by setup guide) */
  private checkPlatformConnected(): void {
    this.platformConnectionService.getConnections().pipe(
      map(res => res.success && Array.isArray(res.data) &&
        res.data.some(c => c.isActive && c.status === 'connected'))
    ).subscribe({
      next: (hasConnection) => { this.orgHasConnectedPlatform = hasConnection; },
      error: () => { this.orgHasConnectedPlatform = false; }
    });
  }

  /** Re-check setup guide status every time the user navigates back to the inbox */
  private watchSetupGuideRefresh(): void {
    this.subscriptions.push(
      this.router.events.pipe(
        filter(e => e instanceof NavigationEnd),
        filter((e) => (e as NavigationEnd).urlAfterRedirects.includes('/inbox'))
      ).subscribe(() => {
        this.checkKnowledgeBaseExists();
        this.checkPlatformConnected();
      })
    );
  }

  onSetupGuideDismissed(): void {
    this.setupGuideDismissed = true;
  }

  /** Persist the auto-sync preference to the backend */
  private saveAutoSyncSetting(enabled: boolean): void {
    const orgId = this.getOrgId();
    if (!orgId) return;
    this.organizationService.updateInboxSettings(orgId, { autoSyncEnabled: enabled }).subscribe({
      error: (err) => console.error('Failed to save auto-sync preference:', err)
    });
  }

  /**
   * Toggle auto-sync on/off.
   * Turning OFF shows a confirmation dialog and persists the choice to the backend.
   * Turning ON starts the sync immediately and persists.
   */
  toggleAutoSync(): void {
    if (this.autoSyncEnabled) {
      // Currently ON → ask the user to confirm turning it OFF
      this.sweetAlertService.confirm(
        'Turn Off Auto-Sync?',
        'Automatic syncing will stop. Your inbox won\'t receive new messages until you turn it back on or refresh manually.',
        'Yes, Turn Off',
        'Cancel'
      ).then((result) => {
        if (result.isConfirmed) {
          this.autoSyncEnabled = false;
          if (this.autoSyncSubscription) {
            this.autoSyncSubscription.unsubscribe();
            this.autoSyncSubscription = undefined;
          }
          this.saveAutoSyncSetting(false);
          this.notificationService.info('Auto-Sync Disabled', 'Your inbox will no longer sync automatically.');
        }
      });
    } else {
      // Currently OFF → turn it back on immediately
      this.autoSyncEnabled = true;
      this.startAutoSync();
      this.saveAutoSyncSetting(true);
      this.notificationService.success('Auto-Sync Enabled', 'Your inbox will sync automatically every 5 minutes.');
    }
  }

  /**
   * Manually sync platforms.
   * When a platform filter is active, only that platform is synced.
   * When no filter is active (Unified Inbox), all connected platforms are synced.
   */
  syncAllPlatforms(silent = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!silent) {
        this.syncing = true;
      }

      // First, get all connected platforms
      this.platformService.getPlatformConnections().subscribe({
        next: (response) => {
          let connectedPlatforms = response.data.filter(
            (p: any) => p.status === 'connected' && p.isActive
          );

          const selectedPlats = inboxFilterToArray(this.platformFilters.platform as any).map((s) =>
            String(s).toLowerCase()
          );
          if (selectedPlats.length > 0) {
            connectedPlatforms = connectedPlatforms.filter((p: any) =>
              selectedPlats.includes(String(p.platform || '').toLowerCase())
            );
          }

          if (connectedPlatforms.length === 0) {
            if (!silent) {
              this.syncing = false;
              const msg =
                selectedPlats.length > 0
                  ? `No active connection found for the selected platform(s). Connect them in Settings → Platforms.`
                  : 'Please connect at least one platform to sync interactions.';
              this.notificationService.warning('No Platforms Connected', msg);
            }
            resolve();
            return;
          }

          // Sync in parallel; use silent variant for background auto-sync to avoid loader flicker
          const syncObservables = connectedPlatforms.map((platform: any) =>
            (silent ? this.platformService.syncPlatformSilent(platform._id) : this.platformService.syncPlatform(platform._id)).pipe(
              catchError((error) => {
                console.error(`Error syncing ${platform.platform}:`, error);
                return of({
                  success: false,
                  platform: platform.platform,
                  error: error.error?.error || error.message || 'Unknown error',
                  data: { interactionsAdded: 0 }
                });
              })
            )
          );

          forkJoin(syncObservables).subscribe({
            next: (results) => {
              console.log('All platforms synced:', results);
              this.lastSyncTime = new Date();
              
              // Reload interactions after sync
              this.loadInteractions();
              
              if (!silent) {
                this.syncing = false;
                const successCount = results.filter((r: any) => r.success).length;
                const failedCount = results.filter((r: any) => !r.success).length;
                const totalInteractions = results.reduce((sum: number, r: any) => sum + (r.data?.interactionsAdded || 0), 0);
                
                if (failedCount === 0) {
                  this.notificationService.success(
                    'Sync Completed Successfully',
                    `Synced ${successCount} platform(s) and found ${totalInteractions} new interactions.`
                  );
                } else {
                  const failedPlatforms = results
                    .filter((r: any) => !r.success)
                    .map((r: any) => `${r.platform || 'Unknown'}: ${r.error || 'Failed'}`);
                  
                  this.notificationService.showWithDetails(
                    'warning',
                    'Partial Sync Success',
                    `Synced ${successCount} of ${connectedPlatforms.length} platforms. Found ${totalInteractions} new interactions.`,
                    failedPlatforms,
                    10000
                  );
                }
              }
              resolve();
            },
            error: (error) => {
              console.error('Error syncing platforms:', error);
              if (!silent) {
                this.syncing = false;
                const errorMessage = error.error?.error || error.message || 'Unknown error';
                this.notificationService.error(
                  'Sync Failed',
                  `${errorMessage}. Check browser console for details.`,
                  8000
                );
              }
              reject(error);
            }
          });
        },
        error: (error) => {
          console.error('Error fetching platforms:', error);
          if (!silent) {
            this.syncing = false;
            this.notificationService.error(
              'Failed to Fetch Platforms',
              'Could not retrieve platform connections. Please try again.'
            );
          }
          reject(error);
        }
      });
    });
  }

  /**
   * Manual sync trigger
   */
  onSyncClick(): void {
    this.syncAllPlatforms(false);
  }

  /**
   * Refresh inbox list without showing loading spinner (for polling so new DMs appear like chat).
   */
  private refreshInboxListSilent(): void {
    this.filters = this.buildInteractionRequestFilters(1);
    this.inboxService.getInteractions(this.filters).subscribe({
      next: (response) => {
        this.totalConversations = response?.data?.pagination?.total ?? this.totalConversations;
      }
    });
    this.loadInboxStats();
  }

  loadInteractions(reset = true): void {
    if (reset) {
      this.currentPage = 1;
      this.hasMoreConversations = false;
      this.inboxService.clearState();
      this.loading = true;
      this.loadingMoreConversations = false;
    } else {
      if (this.loading || this.loadingMoreConversations || !this.hasMoreConversations) return;
      this.loadingMoreConversations = true;
    }

    this.filters = this.buildInteractionRequestFilters(this.currentPage);

    this.inboxService.getInteractions(this.filters).subscribe({
      next: (response) => {
        // Backend sends hasMore — no need to know page size on the frontend
        this.hasMoreConversations = response?.data?.pagination?.hasMore === true;
        this.totalConversations = response?.data?.pagination?.total ?? this.totalConversations;

        // Advance to the next page after any successful fetch.
        // On reset, page 1 was just loaded, so next request must be page 2.
        this.currentPage += 1;

        this.loading = false;
        this.loadingMoreConversations = false;
      },
      error: () => {
        this.loading = false;
        this.loadingMoreConversations = false;
      }
    });
    this.loadInboxStats();
  }

  setViewMode(mode: InboxViewMode): void {
    if (mode !== 'buckets') {
      this.lastListViewMode = mode;
    }
    this.viewMode = mode;
    if (mode !== 'buckets') {
      this.loadInteractions(true);
    }
  }

  /** Segmented control: list inbox vs intent bucket board */
  setInboxLayout(layout: 'list' | 'buckets'): void {
    if (layout === 'buckets') {
      if (this.viewMode !== 'buckets') {
        this.viewMode = 'buckets';
      }
    } else if (this.viewMode === 'buckets') {
      this.bucketSearchTerm = '';
      this.bucketSortBy = 'newest';
      this.viewMode = this.lastListViewMode;
      this.loadInteractions(true);
    }
    this.updateMergedBucketFilters();
  }

  /**
   * Apply priority sort on frontend (unread first, negative sentiment, then by date)
   */
  private applyViewModeSort(interactions: IInteraction[]): IInteraction[] {
    if (this.viewMode !== 'priority' || interactions.length === 0) {
      return interactions;
    }
    return [...interactions].sort((a, b) => {
      const score = (i: IInteraction) => {
        let s = 0;
        if (i.status === 'unread' && i.sentiment === 'negative') return 300;
        if (i.status === 'unread') return 200;
        if (i.sentiment === 'negative') return 100;
        return 0;
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      const dateA = new Date(a.platformCreatedAt).getTime();
      const dateB = new Date(b.platformCreatedAt).getTime();
      return dateB - dateA;
    });
  }

  loadInboxStats(): void {
    const plats = inboxFilterToArray(this.platformFilters.platform as any);
    const filters = plats.length > 0 ? { platform: plats.length === 1 ? plats[0] : plats } : undefined;
    this.inboxService.getStats(filters).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.inboxStats = response.data;
        }
      }
    });
  }

  onPlatformFilterChange(filters: IInboxFilters): void {
    this.platformFilters = filters;

    this.selectedInteraction = null;

    this.applyThemeForPlatformFilters();

    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  onTopFilterChange(filters: IInboxFilters): void {
    const clone = { ...filters } as IInboxFilters & { platform?: unknown };
    if (Object.prototype.hasOwnProperty.call(clone, 'platform')) {
      const p = clone.platform as IInboxFilters['platform'];
      delete (clone as any).platform;
      if (p === undefined || p === null || (Array.isArray(p) && p.length === 0)) {
        this.platformFilters = {};
      } else {
        this.platformFilters = { platform: p };
      }
      this.applyThemeForPlatformFilters();
    }
    this.topFilters = this.stripEmptyDateRange(clone);
    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  /**
   * Extra filter dropdown (Quick filters): same presets as the old toolbar chips.
   * Leaving bucket board switches back to list with the chosen preset.
   */
  onQuickExtraViewFilter(mode: InboxViewMode): void {
    if (mode === 'buckets') return;
    if (this.viewMode === 'buckets') {
      this.bucketSearchTerm = '';
      this.bucketSortBy = 'newest';
      this.lastListViewMode = mode;
      this.viewMode = mode;
      this.updateMergedBucketFilters();
      this.loadInteractions(true);
      return;
    }
    this.setViewMode(mode);
  }

  /** Drop date range keys when empty so cleared dates never stay in API requests */
  private stripEmptyDateRange(f: IInboxFilters): IInboxFilters {
    const next = { ...f };
    if (!next.dateFrom?.toString().trim()) delete next.dateFrom;
    if (!next.dateTo?.toString().trim()) delete next.dateTo;
    return next;
  }

  /**
   * Maps UI filters (e.g. chatSession) to API query params (chatOpen) and strips empties.
   */
  private buildInteractionRequestFilters(pageNum: number): IInboxFilters {
    const merged = this.stripEmptyDateRange({
      ...this.platformFilters,
      ...this.topFilters,
      page: pageNum,
      viewMode: this.viewMode === 'all' ? undefined : this.viewMode,
      status: this.topFilters.status || undefined
    });
    const raw = merged as IInboxFilters & { chatSession?: 'open' | 'closed' };
    const { chatSession, ...rest } = raw;
    const entries = Object.entries(rest).filter(
      ([_, v]) => v !== undefined && v !== null && v !== ''
    ) as [string, unknown][];
    const out = Object.fromEntries(entries) as Record<string, unknown>;
    if (chatSession === 'open') {
      out['chatOpen'] = 'true';
    } else if (chatSession === 'closed') {
      out['chatOpen'] = 'false';
    }
    return out as IInboxFilters;
  }

  // ── Quick-filter active-state helpers (each filter is independent) ──────────

  /** "All" chip is active only when no quick filters are set. */
  isAllConversationFilterActive(): boolean {
    const noStatus = !this.topFilters.status;
    const noIntent = !this.topFilters.intentBucket;
    const noPlatform = inboxFilterToArray(this.platformFilters.platform as any).length === 0;
    return noStatus && noIntent && noPlatform;
  }

  isUnreadFilterActive(): boolean {
    return (this.topFilters.status as string) === 'unread';
  }

  conversationIntentFilterActive(): boolean {
    const ib = this.topFilters.intentBucket;
    return ib != null && String(ib).trim() !== '';
  }

  isConversationIntentBucketActive(bucketKey: string): boolean {
    return this.topFilters.intentBucket === bucketKey;
  }

  // ── Quick-filter actions ─────────────────────────────────────────────────────

  /** "All" resets every quick filter at once. */
  clearAllConversationFilters(): void {
    this.topFilters = { ...this.topFilters };
    delete (this.topFilters as any).status;
    delete (this.topFilters as any).intentBucket;
    this.platformFilters = { ...this.platformFilters };
    delete (this.platformFilters as any).platform;

    this.showConversationPlatformDropdown = false;
    this.showConversationIntentDropdown = false;
    this.showBucketSentimentDropdown = false;
    this.themeService.resetTheme();
    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  /** Unread toggles status independently — platform/intent are preserved. */
  toggleUnreadFilter(): void {
    const nextTopFilters: IInboxFilters = { ...this.topFilters };
    if ((nextTopFilters.status as string) === 'unread') {
      delete nextTopFilters.status;
    } else {
      nextTopFilters.status = 'unread' as any;
    }
    this.topFilters = nextTopFilters;
    this.showConversationPlatformDropdown = false;
    this.showConversationIntentDropdown = false;
    this.showBucketSentimentDropdown = false;
    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  toggleConversationPlatformDropdown(): void {
    this.showConversationPlatformDropdown = !this.showConversationPlatformDropdown;
    if (this.showConversationPlatformDropdown) {
      this.showConversationIntentDropdown = false;
      this.showBucketSentimentDropdown = false;
    }
  }

  toggleConversationIntentDropdown(): void {
    this.showConversationIntentDropdown = !this.showConversationIntentDropdown;
    if (this.showConversationIntentDropdown) {
      this.showConversationPlatformDropdown = false;
      this.showBucketSentimentDropdown = false;
    }
  }

  toggleBucketSentimentDropdown(): void {
    this.showBucketSentimentDropdown = !this.showBucketSentimentDropdown;
    if (this.showBucketSentimentDropdown) {
      this.showConversationPlatformDropdown = false;
      this.showConversationIntentDropdown = false;
    }
  }

  bucketSentimentFilterActive(): boolean {
    return inboxFilterToArray(this.topFilters.sentiment as any).length > 0;
  }

  isBucketSentimentValue(value: 'positive' | 'negative' | 'neutral'): boolean {
    const arr = inboxFilterToArray(this.topFilters.sentiment as any);
    return arr.length === 1 && arr[0] === value;
  }

  setBucketSentimentFilter(value?: 'positive' | 'negative' | 'neutral'): void {
    const nextTopFilters: IInboxFilters = { ...this.topFilters };
    if (value) {
      nextTopFilters.sentiment = value as any;
    } else {
      delete nextTopFilters.sentiment;
    }
    this.topFilters = this.stripEmptyDateRange(nextTopFilters);
    this.showBucketSentimentDropdown = false;
    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  /** Single-select intent — platform/status are preserved. Clicking the active bucket clears it. */
  toggleConversationIntentFilter(bucketKey?: string): void {
    const nextTopFilters: IInboxFilters = { ...this.topFilters };

    if (!bucketKey) {
      delete nextTopFilters.intentBucket;
      this.showConversationIntentDropdown = false;
    } else if (nextTopFilters.intentBucket === bucketKey) {
      delete nextTopFilters.intentBucket;
    } else {
      nextTopFilters.intentBucket = bucketKey;
      this.showConversationIntentDropdown = false;
    }

    this.topFilters = nextTopFilters;
    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  /** Multiselect platform — intent/status are preserved. */
  toggleConversationPlatformFilter(platform?: string): void {
    const nextPlatformFilters: IInboxFilters = { ...this.platformFilters };

    let nextPlatforms = inboxFilterToArray(this.platformFilters.platform as any);

    if (!platform) {
      nextPlatforms = [];
      this.showConversationPlatformDropdown = false;
      this.themeService.resetTheme();
    } else {
      const p = platform.toLowerCase();
      const has = nextPlatforms.some((x) => x.toLowerCase() === p);
      nextPlatforms = has
        ? nextPlatforms.filter((x) => x.toLowerCase() !== p)
        : [...nextPlatforms, platform];
      this.applyThemeForPlatformFiltersWithList(nextPlatforms);
    }

    delete nextPlatformFilters.platform;
    if (nextPlatforms.length === 1) nextPlatformFilters.platform = nextPlatforms[0] as any;
    else if (nextPlatforms.length > 1) nextPlatformFilters.platform = nextPlatforms as any;

    this.platformFilters = nextPlatformFilters;
    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  /** @deprecated kept so existing calls compile — use clearAllConversationFilters/toggleUnreadFilter. */
  applyConversationQuickFilter(filter: 'all' | 'unread'): void {
    if (filter === 'all') this.clearAllConversationFilters();
    else this.toggleUnreadFilter();
  }

  conversationPlatformFilterCount(): number {
    return inboxFilterToArray(this.platformFilters.platform as any).length;
  }

  isConversationPlatformActive(platform: string): boolean {
    return inboxFilterToArray(this.platformFilters.platform as any).some(
      (x) => x.toLowerCase() === platform.toLowerCase()
    );
  }

  getSyncButtonTitle(): string {
    const n = this.conversationPlatformFilterCount();
    if (n === 0) return 'Sync all platforms';
    if (n === 1) return `Sync ${inboxFilterToArray(this.platformFilters.platform as any)[0]}`;
    return `Sync ${n} platforms`;
  }

  getSyncButtonLabel(): string {
    const n = this.conversationPlatformFilterCount();
    if (n === 0) return 'Sync All';
    if (n === 1) {
      const p = inboxFilterToArray(this.platformFilters.platform as any)[0];
      return 'Sync ' + p.charAt(0).toUpperCase() + p.slice(1);
    }
    return `Sync (${n})`;
  }

  hasTopSentimentFilter(): boolean {
    return inboxFilterToArray(this.topFilters.sentiment as any).length > 0;
  }

  topSentimentFilterSummary(): string {
    return inboxFilterToArray(this.topFilters.sentiment as any).join(', ');
  }

  private applyThemeForPlatformFilters(): void {
    this.applyThemeForPlatformFiltersWithList(
      inboxFilterToArray(this.platformFilters.platform as any)
    );
  }

  private applyThemeForPlatformFiltersWithList(platforms: string[]): void {
    if (platforms.length === 1) {
      this.themeService.setPlatformTheme(platforms[0] as any);
    } else {
      this.themeService.resetTheme();
    }
  }

  private loadConversationPlatformOptions(): void {
    this.platformService.getPlatformConnections().subscribe({
      next: (response) => {
        const list = (response?.data || [])
          .filter((p: any) => p?.isActive && p?.status === 'connected' && !!p?.platform)
          .map((p: any) => String(p.platform).toLowerCase().trim());
        this.conversationPlatformOptions = [...new Set(list)];
      },
      error: () => {
        this.conversationPlatformOptions = [];
      }
    });
  }

  getPlatformIconClass(platform: string): string {
    const p = (platform || '').toLowerCase().trim();
    const icons: Record<string, string> = {
      instagram: 'fab fa-instagram',
      facebook: 'fab fa-facebook-f',
      youtube: 'fab fa-youtube',
      google: 'fab fa-google',
      google_my_business: 'fab fa-google',
      linkedin: 'fab fa-linkedin-in',
      whatsapp: 'fab fa-whatsapp',
      website: 'fas fa-globe'
    };
    return icons[p] || 'fas fa-share-alt';
  }

  formatPlatformLabel(platform: string): string {
    const p = (platform || '').toLowerCase().trim();
    if (p === 'google_my_business') return 'Google My Business';
    return p.charAt(0).toUpperCase() + p.slice(1);
  }

  getActiveIntentBucketLabel(): string {
    const key = this.topFilters.intentBucket;
    if (!key) return '';
    if (key === 'none') return 'Unassigned';
    const found = this.conversationIntentBuckets.find(b => b._id === key);
    return found ? found.name : key;
  }

  onFilterChange(filters: IInboxFilters): void {
    // Legacy support - merge with existing filters
    this.filters = { ...this.filters, ...filters };
    this.loadInteractions(true);
  }

  onSearchChange(searchTerm: string): void {
    // Update search filter
    if (searchTerm && searchTerm.trim()) {
      this.topFilters = { ...this.topFilters, search: searchTerm.trim() };
    } else {
      // Remove search filter if empty
      const { search, ...rest } = this.topFilters;
      this.topFilters = rest;
    }
    this.updateMergedBucketFilters();
    this.loadInteractions(true);
  }

  onLoadMoreConversations(): void {
    if (!this.hasMoreConversations) return;
    this.loadInteractions(false);
  }

  mergedBucketFilters: IInboxFilters = {};
  bucketSearchTerm = '';
  bucketSortBy: 'newest' | 'oldest' = 'newest';

  private updateMergedBucketFilters(): void {
    const extra: any = {};
    if (this.bucketSearchTerm?.trim()) extra.search = this.bucketSearchTerm.trim();
    if (this.bucketSortBy === 'oldest') { extra.sortBy = 'platformCreatedAt'; extra.sortOrder = 'asc'; }
    else { extra.sortBy = 'platformCreatedAt'; extra.sortOrder = 'desc'; }
    this.mergedBucketFilters = { ...this.platformFilters, ...this.topFilters, ...extra };
  }

  onBucketSearchChange(term: string): void {
    this.bucketSearchTerm = term;
    this.updateMergedBucketFilters();
  }

  onBucketSortChange(sort: 'newest' | 'oldest'): void {
    this.bucketSortBy = sort;
    this.updateMergedBucketFilters();
  }

  onBucketInteractionSelect(interaction: IInteraction): void {
    this.onInteractionSelect(interaction);
  }

  onInteractionSelect(interaction: IInteraction): void {
    // markRead:true is ONLY passed here — the single explicit user-open action.
    // Background refreshes, polling, socket events and action-panel refetches must
    // NOT pass markRead so they cannot override a manually-set 'unread' status.
    // Closed chats are NOT auto-reopened here; the user must explicitly click "Open Chat".
    this.inboxService.getInteraction(interaction._id, { markRead: true }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          this.inboxService.setSelectedInteraction(data);

          // Sync the list entry so the status badge updates immediately
          const index = this.interactions.findIndex(i => i._id === data._id);
          if (index !== -1) {
            this.interactions[index] = data;
          }
        }
      },
      error: (error) => {
        console.error('Error fetching interaction details:', error);
        this.inboxService.setSelectedInteraction(interaction);
      }
    });
  }

  onInteractionUpdate(): void {
    // Lightweight refresh: only update the open conversation.
    // Avoid full list reload so chat list doesn't refresh/flicker on send.
    if (this.selectedInteraction?._id) {
      this.inboxService.getInteraction(this.selectedInteraction._id).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.inboxService.setSelectedInteraction(res.data);
            const idx = this.interactions.findIndex(i => i._id === res.data!._id);
            if (idx !== -1) {
              this.interactions[idx] = res.data!;
            }
          }
        }
      });
    }
  }

  onAiSendReply(content: string): void {
    if (this.inboxDetail) {
      this.inboxDetail.insertReplyContent(content);
    }
  }

  /**
   * After bulk operations that mutate interaction data (assign, label, archive…),
   * re-fetch the currently open detail panel so banners / metadata refresh instantly.
   */
  private refreshSelectedIfAffected(ids: string[]): void {
    if (!this.selectedInteraction) return;
    if (!ids.includes(this.selectedInteraction._id)) return;
    this.inboxService.getInteraction(this.selectedInteraction._id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.inboxService.setSelectedInteraction(res.data);
          // Also update the item in the local list so the sidebar stays in sync
          const idx = this.interactions.findIndex(i => i._id === res.data!._id);
          if (idx !== -1) { this.interactions[idx] = res.data!; }
        }
      }
    });
  }

  getUnreadCount(): number {
    return this.interactions.filter(i => i.status === 'unread').length;
  }

  getTodayCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.interactions.filter(i => {
      const interactionDate = new Date(i.platformCreatedAt);
      interactionDate.setHours(0, 0, 0, 0);
      return interactionDate.getTime() === today.getTime();
    }).length;
  }

  /**
   * Keyboard shortcuts: J/K navigate, R focus reply, E resolve, ? show help
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ignore when typing in inputs, textareas, or contenteditable
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      if (event.key !== 'Escape') return;
      if (this.showShortcutsOverlay) {
        this.showShortcutsOverlay = false;
      }
      return;
    }

    switch (event.key) {
      case 'j':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          this.navigateNext();
        }
        break;
      case 'k':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          this.navigatePrev();
        }
        break;
      case 'r':
      case 'R':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          this.inboxDetail?.focusReplyBox();
        }
        break;
      case 'e':
      case 'E':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          if (this.inboxDetail?.canResolve?.()) {
            this.inboxDetail?.resolveInteraction?.();
          }
        }
        break;
      case '?':
        event.preventDefault();
        this.showShortcutsOverlay = !this.showShortcutsOverlay;
        break;
      case 'Escape':
        this.showShortcutsOverlay = false;
        this.showMoreOptions = false;
        this.showBulkMoreActions = false;
        this.showBulkLabelActions = false;
        this.assignDropdownPos = null;
        this.labelDropdownPos = null;
        break;
    }
  }

  navigateNext(): void {
    if (this.interactions.length === 0) return;
    const idx = this.selectedInteraction
      ? this.interactions.findIndex(i => i._id === this.selectedInteraction!._id)
      : -1;
    const nextIdx = idx < 0 ? 0 : Math.min(idx + 1, this.interactions.length - 1);
    this.onInteractionSelect(this.interactions[nextIdx]);
  }

  navigatePrev(): void {
    if (this.interactions.length === 0) return;
    const idx = this.selectedInteraction
      ? this.interactions.findIndex(i => i._id === this.selectedInteraction!._id)
      : 0;
    const prevIdx = Math.max(0, idx - 1);
    this.onInteractionSelect(this.interactions[prevIdx]);
  }

  /**
   * Run sentiment analysis on comments that have no sentiment (so positive/negative/neutral filters work)
   */
  runAnalyzeSentiment(): void {
    this.analyzingSentiment = true;
    this.inboxService.analyzeSentiment(500).subscribe({
      next: (res) => {
        this.analyzingSentiment = false;
        if (res.success && res.data) {
          this.notificationService.success(
            'Sentiment Analyzed',
            res.data.message || `Analyzed ${res.data.analyzed} comment(s). Try the Positive / Negative / Neutral filters again.`
          );
          this.loadInteractions();
        }
      },
      error: () => {
        this.analyzingSentiment = false;
        this.notificationService.error('Analysis Failed', 'Could not analyze sentiment. Try again later.');
      }
    });
  }
}
