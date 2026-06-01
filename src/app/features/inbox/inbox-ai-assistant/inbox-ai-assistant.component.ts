import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InboxService } from '../../../core/services/inbox.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { IInteraction } from '../../../core/models/interaction.model';
import { AiChatBubbleIconComponent } from '../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';
import { AppCurrencyPipe } from '../../../shared/pipes/app-currency.pipe';
import { IProduct } from '../../../core/models/product.model';

export interface AiReplyCard {
  type: 'short' | 'detailed' | 'sales';
  label: string;
  icon: string;
  content: string;
  enabled: boolean;
  editing: boolean;
  editContent: string;
  regenerating: boolean;
}

@Component({
  selector: 'app-inbox-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, AiChatBubbleIconComponent, AppCurrencyPipe],
  templateUrl: './inbox-ai-assistant.component.html',
  styleUrls: ['./inbox-ai-assistant.component.scss']
})
export class InboxAiAssistantComponent implements OnChanges {
  @Input() interaction: IInteraction | null = null;
  @Output() sendReply = new EventEmitter<string>();
  /** Emitted when agent clicks "Send product" chip — parent opens product picker pre-selected */
  @Output() sendSuggestedProduct = new EventEmitter<IProduct>();

  loading = false;
  error: string | null = null;
  generated = false;
  improveAutoReplies = false;

  /** AI-suggested products from the catalog (populated after generateSuggestions) */
  suggestedProducts: IProduct[] = [];

  cards: AiReplyCard[] = [
    { type: 'short', label: 'Short Reply', icon: 'fas fa-bolt', content: '', enabled: true, editing: false, editContent: '', regenerating: false },
    { type: 'detailed', label: 'Detailed Reply', icon: 'fas fa-align-left', content: '', enabled: true, editing: false, editContent: '', regenerating: false },
    { type: 'sales', label: 'Sales Reply', icon: 'fas fa-chart-line', content: '', enabled: true, editing: false, editContent: '', regenerating: false }
  ];

  usedKnowledgeBase = false;
  knowledgeBaseCount = 0;

  constructor(
    private inboxService: InboxService,
    private sweetAlertService: SweetAlertService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['interaction'] && this.interaction) {
      this.resetState();
    }
  }

  resetState(): void {
    this.generated = false;
    this.loading = false;
    this.error = null;
    this.suggestedProducts = [];
    this.cards.forEach(c => {
      c.content = '';
      c.editing = false;
      c.editContent = '';
      c.regenerating = false;
    });
  }

  generateSuggestions(): void {
    if (!this.interaction?._id || this.loading) return;
    this.loading = true;
    this.error = null;

    this.inboxService.aiAssist(this.interaction._id).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          this.cards[1].content = response.data.detailed;
          this.cards[0].content = this.buildShortFromDetailed(response.data.detailed);
          this.cards[2].content = response.data.sales;
          this.usedKnowledgeBase = response.data.usedKnowledgeBase;
          this.knowledgeBaseCount = response.data.knowledgeBaseCount;
          this.suggestedProducts = (response.data.suggestedProducts || []).slice(0, 3);
          this.generated = true;
        } else {
          this.error = (response as any).error || 'Failed to generate suggestions.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || err?.message || 'Failed to generate AI suggestions.';
        this.cdr.markForCheck();
      }
    });
  }

  onSend(card: AiReplyCard): void {
    const content = card.editing ? card.editContent : card.content;
    if (!content?.trim()) return;
    this.sendReply.emit(content.trim());
    this.sweetAlertService.toast('success', `${card.label} sent to reply box`);
  }

  onEdit(card: AiReplyCard): void {
    card.editing = true;
    card.editContent = card.content;
  }

  onSaveEdit(card: AiReplyCard): void {
    card.content = card.editContent;
    card.editing = false;
  }

  onCancelEdit(card: AiReplyCard): void {
    card.editing = false;
    card.editContent = '';
  }

  onRegenerate(card: AiReplyCard): void {
    if (card.type === 'short') {
      const detailedCard = this.cards.find(c => c.type === 'detailed');
      this.cards[0].content = this.buildShortFromDetailed(detailedCard?.content || '');
      this.cards[0].editing = false;
      this.sweetAlertService.toast('success', 'Short reply updated from detailed reply');
      this.cdr.markForCheck();
      return;
    }

    if (!this.interaction?._id || card.regenerating) return;
    card.regenerating = true;

    this.inboxService.aiAssistRegenerate(this.interaction._id, card.type).subscribe({
      next: (response) => {
        card.regenerating = false;
        if (response.success && response.data) {
          card.content = response.data.content;
          card.editing = false;
          if (card.type === 'detailed') {
            this.cards[0].content = this.buildShortFromDetailed(response.data.content);
            this.cards[0].editing = false;
          }
        } else {
          this.sweetAlertService.toast('error', 'Failed to regenerate reply.');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        card.regenerating = false;
        this.sweetAlertService.toast('error', err?.error?.error || 'Regeneration failed.');
        this.cdr.markForCheck();
      }
    });
  }

  toggleCard(card: AiReplyCard): void {
    card.enabled = !card.enabled;
  }

  onSendSuggestedProduct(product: IProduct): void {
    this.sendSuggestedProduct.emit(product);
  }

  private buildShortFromDetailed(detailed: string): string {
    const normalized = (detailed || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    const shortFromSentences = sentences.slice(0, 2).join(' ');
    if (shortFromSentences.length <= 160) {
      return shortFromSentences;
    }

    const cut = shortFromSentences.slice(0, 157).trim();
    return `${cut}...`;
  }
}
