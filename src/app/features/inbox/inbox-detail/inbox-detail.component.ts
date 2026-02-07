import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IInteraction } from '../../../core/models/interaction.model';
import { InboxService } from '../../../core/services/inbox.service';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Inbox Detail Component - Single Responsibility Principle
 * Displays full interaction details and reply form
 */
@Component({
  selector: 'app-inbox-detail',
  templateUrl: './inbox-detail.component.html',
  styleUrls: ['./inbox-detail.component.scss']
})
export class InboxDetailComponent implements OnChanges {
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

  ngOnChanges(changes: SimpleChanges): void {
    // Clear AI suggestion when interaction changes
    if (changes['interaction'] && !changes['interaction'].firstChange) {
      this.clearAISuggestion();
      this.replyForm.reset();
    }
    
    // Mark interaction as read when it's viewed
    if (changes['interaction'] && this.interaction && this.interaction._id) {
      this.markAsRead();
    }
  }

  constructor(
    private fb: FormBuilder,
    private inboxService: InboxService,
    public themeService: ThemeService
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
}
