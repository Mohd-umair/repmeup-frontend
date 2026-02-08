import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IInteraction, InteractionStatus, IAssignmentHistory } from '../../../core/models/interaction.model';
import { InboxService } from '../../../core/services/inbox.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserService, IAvailableAgent } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationDataService } from '../../../core/services/notification-data.service';
import { Subscription } from 'rxjs';

/**
 * Inbox Detail Component - Single Responsibility Principle
 * Displays full interaction details and reply form
 */
@Component({
  selector: 'app-inbox-detail',
  templateUrl: './inbox-detail.component.html',
  styleUrls: ['./inbox-detail.component.scss']
})
export class InboxDetailComponent implements OnChanges, OnInit, OnDestroy {
  @Input() interaction: IInteraction | null = null;
  @Output() interactionUpdate = new EventEmitter<void>();

  replyForm: FormGroup;
  submittingReply = false;
  replySuccess = false;
  generatingSuggestion = false;
  aiSuggestion: { content: string; confidence: number; usedKnowledgeBase: boolean } | null = null;
  suggestionError: string | null = null;
  /** Tracks avatar load errors so we can show initial fallback */
  avatarFallback: Record<string, boolean> = {};
  /** Used for star rating display (1–5) */
  readonly ratingStars = [1, 2, 3, 4, 5];
  
  // Agent assignment
  availableAgents: IAvailableAgent[] = [];
  loadingAgents = false;
  assigningAgent = false;
  currentUser: any = null;
  
  // Resolution
  resolvingInteraction = false;

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.loadAvailableAgents();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Clear AI suggestion when interaction changes
    if (changes['interaction'] && !changes['interaction'].firstChange) {
      this.clearAISuggestion();
      this.replyForm.reset();
    }
    
    // Mark interaction as read when it's viewed
    if (changes['interaction'] && this.interaction && this.interaction._id) {
      this.markAsRead();
      this.markNotificationsAsRead();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  constructor(
    private fb: FormBuilder,
    private inboxService: InboxService,
    public themeService: ThemeService,
    private userService: UserService,
    private authService: AuthService,
    private notificationDataService: NotificationDataService
  ) {
    this.replyForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  /**
   * Get platform-specific colors for the interaction
   */
  onAvatarError(key: string): void {
    this.avatarFallback = { ...this.avatarFallback, [key]: true };
  }

  getPlatformColors(): any {
    if (!this.interaction) return null;
    const theme = this.themeService.getTheme(this.interaction.platform);
    return {
      primary: theme.primaryColor,
      secondary: theme.secondaryColor,
      gradientFrom: theme.gradientFrom,
      gradientTo: theme.gradientTo
    };
  }

  submitReply(): void {
    if (this.replyForm.invalid || !this.interaction) {
      return;
    }

    this.submittingReply = true;
    this.replySuccess = false;

    const content = this.replyForm.value.content;

    this.inboxService.replyToInteraction(this.interaction._id, content).subscribe({
      next: (response) => {
        if (response.success) {
          this.replySuccess = true;
          this.replyForm.reset();
          this.interactionUpdate.emit();
          
          setTimeout(() => {
            this.replySuccess = false;
          }, 3000);
        }
        this.submittingReply = false;
      },
      error: () => {
        this.submittingReply = false;
      }
    });
  }

  getSentimentClass(sentiment?: string): string {
    switch (sentiment) {
      case 'positive':
        return 'bg-rep-lime/20 text-rep-black border border-rep-lime/30';
      case 'negative':
        return 'bg-gray-100 text-gray-800 border border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  getStatusColor(status?: string): string {
    switch (status) {
      case 'unread':
        return 'bg-gray-100 text-gray-800 border border-gray-300';
      case 'replied':
        return 'bg-rep-lime/20 text-rep-black border border-rep-lime/30';
      case 'resolved':
        return 'bg-rep-lime/20 text-rep-black border border-rep-lime/30';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  }

  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      'instagram': '📷',
      'facebook': '📘',
      'whatsapp': '💬',
      'youtube': '📺',
      'google': '🔍'
    };
    return icons[platform.toLowerCase()] || '💬';
  }

  /** Star rating for reviews (Google Business etc.); undefined if not a review or no rating */
  getReviewRating(): number | undefined {
    if (!this.interaction) return undefined;
    const r = (this.interaction as any).rating ?? this.interaction.metadata?.starRating;
    if (r == null || typeof r !== 'number') return undefined;
    return Math.min(5, Math.max(1, Math.round(r)));
  }

  getSentimentIcon(sentiment?: string): string {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😟';
      default:
        return '😐';
    }
  }

  getInitials(firstName?: string, lastName?: string): string {
    if (!firstName && !lastName) {
      return 'A';
    }
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'A';
  }

  /**
   * Check if sentBy is a populated user object or just a string ID
   */
  isUserObject(sentBy: string | any): boolean {
    return sentBy && typeof sentBy === 'object' && 'firstName' in sentBy;
  }

  /**
   * Get user's first name from sentBy (handles both string ID and populated object)
   */
  getUserFirstName(sentBy: string | any): string {
    if (this.isUserObject(sentBy)) {
      return (sentBy as any).firstName || '';
    }
    return '';
  }

  /**
   * Get user's last name from sentBy (handles both string ID and populated object)
   */
  getUserLastName(sentBy: string | any): string {
    if (this.isUserObject(sentBy)) {
      return (sentBy as any).lastName || '';
    }
    return '';
  }

  /**
   * Get user's full name from sentBy (handles both string ID and populated object)
   */
  getUserFullName(sentBy: string | any): string {
    if (this.isUserObject(sentBy)) {
      const firstName = (sentBy as any).firstName || '';
      const lastName = (sentBy as any).lastName || '';
      return `${firstName} ${lastName}`.trim() || 'Agent';
    }
    return 'Agent';
  }

  /**
   * Generate AI suggestion for reply
   */
  generateAISuggestion(): void {
    if (!this.interaction || this.generatingSuggestion) {
      return;
    }

    this.generatingSuggestion = true;
    this.suggestionError = null;
    this.aiSuggestion = null;

    this.inboxService.suggestReply(this.interaction._id).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.aiSuggestion = {
            content: response.data.suggestedReply,
            confidence: response.data.confidence || 0,
            usedKnowledgeBase: response.data.usedKnowledgeBase || false
          };
          
          // Auto-fill the reply form with the suggestion
          this.replyForm.patchValue({
            content: this.aiSuggestion.content
          });
        } else {
          this.suggestionError = 'Failed to generate AI suggestion. Please try again.';
        }
        this.generatingSuggestion = false;
      },
      error: (error) => {
        console.error('Error generating AI suggestion:', error);
        this.suggestionError = error.error?.error || error.error?.message || 'Failed to generate AI suggestion. Please try again.';
        this.generatingSuggestion = false;
      }
    });
  }

  /**
   * Use the AI suggestion in the reply form
   */
  useAISuggestion(): void {
    if (this.aiSuggestion) {
      this.replyForm.patchValue({
        content: this.aiSuggestion.content
      });
    }
  }

  /**
   * Clear AI suggestion
   */
  clearAISuggestion(): void {
    this.aiSuggestion = null;
    this.suggestionError = null;
  }

  /**
   * Mark interaction as read when viewed
   */
  markAsRead(): void {
    if (!this.interaction || !this.interaction._id) {
      return;
    }

    // Only mark as read if it's currently unread
    if (this.interaction.status === 'unread') {
      // Call the backend to mark as read (this will also update the status)
      this.inboxService.getInteraction(this.interaction._id).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Update the local interaction with the new status
            this.interaction = response.data;
            // Emit update to refresh the list
            this.interactionUpdate.emit();
          }
        },
        error: (error) => {
          console.error('Error marking interaction as read:', error);
        }
      });
    }
  }

  /**
   * Load available agents for assignment
   */
  loadAvailableAgents(): void {
    this.loadingAgents = true;
    this.userService.getAvailableAgents().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.availableAgents = response.data;
        }
        this.loadingAgents = false;
      },
      error: (error) => {
        console.error('Error loading agents:', error);
        this.loadingAgents = false;
      }
    });
  }

  /**
   * Assign interaction to agent
   */
  assignToAgent(userId: string): void {
    if (!this.interaction || !this.interaction._id) {
      return;
    }

    // Don't assign if already assigned to this agent
    if (this.interaction.assignedTo && (this.interaction.assignedTo as any)._id === userId) {
      return;
    }

    this.assigningAgent = true;
    this.inboxService.assignInteraction(this.interaction._id, userId, 'manual').subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Interaction assigned successfully');
          // Refresh the interaction to get updated assignedTo data
          this.inboxService.getInteraction(this.interaction!._id).subscribe({
            next: (refreshResponse) => {
              if (refreshResponse.success && refreshResponse.data) {
                this.interaction = refreshResponse.data;
                this.interactionUpdate.emit();
              }
              this.assigningAgent = false;
            }
          });
        }
      },
      error: (error) => {
        console.error('Error assigning interaction:', error);
        this.assigningAgent = false;
      }
    });
  }

  /**
   * Unassign interaction
   */
  unassignInteraction(): void {
    if (!this.interaction || !this.interaction._id || !this.interaction.assignedTo) {
      return;
    }

    if (!confirm('Are you sure you want to unassign this interaction?')) {
      return;
    }

    this.assigningAgent = true;
    // Assign to empty string to unassign
    this.inboxService.assignInteraction(this.interaction._id, '', 'manual').subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Interaction unassigned successfully');
          // Refresh the interaction
          this.inboxService.getInteraction(this.interaction!._id).subscribe({
            next: (refreshResponse) => {
              if (refreshResponse.success && refreshResponse.data) {
                this.interaction = refreshResponse.data;
                this.interactionUpdate.emit();
              }
              this.assigningAgent = false;
            }
          });
        }
      },
      error: (error) => {
        console.error('Error unassigning interaction:', error);
        this.assigningAgent = false;
      }
    });
  }

  /**
   * Check if current user can assign interactions
   */
  canAssign(): boolean {
    return this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'manager');
  }

  /**
   * Get assigned agent display name
   */
  getAssignedAgentName(): string {
    if (!this.interaction?.assignedTo) return '';
    const agent = this.interaction.assignedTo as any;
    if (agent.firstName && agent.lastName) {
      return `${agent.firstName} ${agent.lastName}`;
    }
    return agent.email || 'Unknown';
  }

  /**
   * Check if interaction is assigned
   */
  isAssigned(): boolean {
    return !!this.interaction?.assignedTo;
  }

  /**
   * Get assigned agent ID for dropdown value
   */
  getAssignedAgentId(): string {
    if (!this.interaction?.assignedTo) return '';
    const agent = this.interaction.assignedTo as any;
    return agent._id || '';
  }

  /**
   * Check if agent is currently assigned to this interaction
   */
  isAgentAssigned(agentId: string): boolean {
    if (!this.interaction?.assignedTo) return false;
    const agent = this.interaction.assignedTo as any;
    return agent._id === agentId;
  }

  /**
   * Resolve interaction
   */
  resolveInteraction(): void {
    if (!this.interaction || !this.interaction._id) {
      return;
    }

    if (!confirm('Are you sure you want to mark this interaction as resolved? This will close the conversation.')) {
      return;
    }

    this.resolvingInteraction = true;
    this.inboxService.updateStatus(this.interaction._id, InteractionStatus.RESOLVED).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Interaction resolved successfully');
          // Refresh the interaction
          this.inboxService.getInteraction(this.interaction!._id).subscribe({
            next: (refreshResponse) => {
              if (refreshResponse.success && refreshResponse.data) {
                this.interaction = refreshResponse.data;
                this.interactionUpdate.emit();
              }
              this.resolvingInteraction = false;
            }
          });
        }
      },
      error: (error) => {
        console.error('Error resolving interaction:', error);
        this.resolvingInteraction = false;
      }
    });
  }

  /**
   * Reopen interaction
   */
  reopenInteraction(): void {
    if (!this.interaction || !this.interaction._id) {
      return;
    }

    this.resolvingInteraction = true;
    this.inboxService.updateStatus(this.interaction._id, InteractionStatus.UNREAD).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('✅ Interaction reopened successfully');
          // Refresh the interaction
          this.inboxService.getInteraction(this.interaction!._id).subscribe({
            next: (refreshResponse) => {
              if (refreshResponse.success && refreshResponse.data) {
                this.interaction = refreshResponse.data;
                this.interactionUpdate.emit();
              }
              this.resolvingInteraction = false;
            }
          });
        }
      },
      error: (error) => {
        console.error('Error reopening interaction:', error);
        this.resolvingInteraction = false;
      }
    });
  }

  /**
   * Check if interaction can be resolved
   */
  canResolve(): boolean {
    return this.interaction?.status !== InteractionStatus.RESOLVED;
  }

  /**
   * Check if interaction is resolved
   */
  isResolved(): boolean {
    return this.interaction?.status === InteractionStatus.RESOLVED;
  }

  /**
   * Mark notifications related to this interaction as read
   */
  private markNotificationsAsRead(): void {
    if (!this.interaction || !this.interaction._id) return;

    // Get all notifications
    const notificationsSub = this.notificationDataService.notifications$.subscribe(notifications => {
      // Find unread notifications related to this interaction
      const relatedNotifications = notifications.filter(n => 
        !n.isRead && 
        n.relatedTo?.model === 'Interaction' && 
        n.relatedTo?.id === this.interaction!._id
      );

      // Mark each as read
      relatedNotifications.forEach(notification => {
        this.notificationDataService.markAsRead(notification._id).subscribe({
          next: () => {
            console.log(`✅ Marked notification ${notification._id} as read`);
          },
          error: (error) => {
            console.error('Error marking notification as read:', error);
          }
        });
      });
    });

    // Unsubscribe immediately after first emission
    this.subscriptions.push(notificationsSub);
    notificationsSub.unsubscribe();
  }

  /**
   * Get formatted assignment info for display
   */
  getAssignmentInfo(): { assignedToName: string; assignedByName: string; assignedAtFormatted: string } | null {
    if (!this.interaction?.assignedTo || !this.interaction?.assignedBy) {
      return null;
    }

    const assignedTo = this.interaction.assignedTo as any;
    const assignedBy = this.interaction.assignedBy as any;
    const assignedAt = this.interaction.assignedAt;

    return {
      assignedToName: assignedTo.firstName && assignedTo.lastName 
        ? `${assignedTo.firstName} ${assignedTo.lastName}` 
        : assignedTo.name || 'Unknown Agent',
      assignedByName: assignedBy.firstName && assignedBy.lastName 
        ? `${assignedBy.firstName} ${assignedBy.lastName}` 
        : assignedBy.name || 'Unknown User',
      assignedAtFormatted: assignedAt ? this.formatAssignmentDate(new Date(assignedAt)) : ''
    };
  }

  /**
   * Format assignment date like WhatsApp
   */
  private formatAssignmentDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffMins = Math.floor(diff / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });

    if (diffDays === 0) {
      return `Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    } else if (diffDays < 7) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      return `${dayName} at ${timeStr}`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  /**
   * Get chronologically sorted timeline (messages, replies, assignments)
   */
  getConversationTimeline(): Array<{type: 'message' | 'reply' | 'assignment', data: any, timestamp: Date}> {
    if (!this.interaction) return [];

    const timeline: Array<{type: 'message' | 'reply' | 'assignment', data: any, timestamp: Date}> = [];

    // Add original message
    timeline.push({
      type: 'message',
      data: this.interaction,
      timestamp: new Date(this.interaction.platformCreatedAt)
    });

    // Add replies
    if (this.interaction.replies && this.interaction.replies.length > 0) {
      this.interaction.replies.forEach(reply => {
        timeline.push({
          type: 'reply',
          data: reply,
          timestamp: new Date(reply.sentAt)
        });
      });
    }

    // Add ALL assignment events from history
    if (this.interaction.assignmentHistory && this.interaction.assignmentHistory.length > 0) {
      this.interaction.assignmentHistory.forEach(assignment => {
        const assignedTo = assignment.assignedTo as any;
        const assignedBy = assignment.assignedBy as any;
        
        // Handle unassignment (assignedTo is null)
        if (!assignedTo) {
          timeline.push({
            type: 'assignment',
            data: {
              isUnassignment: true,
              assignedByName: assignedBy?.firstName && assignedBy?.lastName 
                ? `${assignedBy.firstName} ${assignedBy.lastName}` 
                : assignedBy?.name || 'Unknown User',
              assignedAtFormatted: this.formatAssignmentDate(new Date(assignment.assignedAt))
            },
            timestamp: new Date(assignment.assignedAt)
          });
        } else {
          // Regular assignment
          timeline.push({
            type: 'assignment',
            data: {
              isUnassignment: false,
              assignedToName: assignedTo?.firstName && assignedTo?.lastName 
                ? `${assignedTo.firstName} ${assignedTo.lastName}` 
                : assignedTo?.name || 'Unknown Agent',
              assignedByName: assignedBy?.firstName && assignedBy?.lastName 
                ? `${assignedBy.firstName} ${assignedBy.lastName}` 
                : assignedBy?.name || 'Unknown User',
              assignedAtFormatted: this.formatAssignmentDate(new Date(assignment.assignedAt))
            },
            timestamp: new Date(assignment.assignedAt)
          });
        }
      });
    }

    // Sort by timestamp
    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}
