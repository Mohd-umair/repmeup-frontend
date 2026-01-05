import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IInteraction } from '../../../core/models/interaction.model';
import { InboxService } from '../../../core/services/inbox.service';

/**
 * Inbox Detail Component - Single Responsibility Principle
 * Displays full interaction details and reply form
 */
@Component({
  selector: 'app-inbox-detail',
  templateUrl: './inbox-detail.component.html',
  styleUrls: ['./inbox-detail.component.scss']
})
export class InboxDetailComponent {
  @Input() interaction: IInteraction | null = null;
  @Output() interactionUpdate = new EventEmitter<void>();

  replyForm: FormGroup;
  submittingReply = false;
  replySuccess = false;

  constructor(
    private fb: FormBuilder,
    private inboxService: InboxService
  ) {
    this.replyForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(1)]]
    });
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
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  getStatusColor(status?: string): string {
    switch (status) {
      case 'unread':
        return 'bg-yellow-100 text-yellow-800';
      case 'replied':
        return 'bg-green-100 text-green-800';
      case 'resolved':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
}
