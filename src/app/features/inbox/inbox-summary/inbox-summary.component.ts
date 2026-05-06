import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  EventEmitter,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { InboxService } from '../../../core/services/inbox.service';
import { AiChatBubbleIconComponent } from '../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';
import { NotificationService } from '../../../core/services/notification.service';
import { IInteraction } from '../../../core/models/interaction.model';

@Component({
  selector: 'app-inbox-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, AiChatBubbleIconComponent],
  templateUrl: './inbox-summary.component.html',
  styleUrls: ['./inbox-summary.component.scss']
})
export class InboxSummaryComponent implements OnChanges, OnDestroy {
  @Input() interaction: IInteraction | null = null;
  @Output() updated = new EventEmitter<void>();

  /** Draft content of the editor */
  draftText = '';

  /** Track whether the user is currently editing */
  editing = false;

  generatingAI = false;
  saving = false;
  aiError: string | null = null;
  saveSuccess = false;

  private sub?: Subscription;

  constructor(
    private inboxService: InboxService,
    private notify: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['interaction']) {
      this.resetState();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get hasSaved(): boolean {
    return !!this.interaction?.summary;
  }

  get savedSummary(): string {
    return this.interaction?.summary ?? '';
  }

  get savedSuggestedAction(): string | null {
    return this.interaction?.summarySuggestedAction ?? null;
  }

  get generatedByLabel(): string {
    if (!this.interaction?.summaryGeneratedBy) return '';
    return this.interaction.summaryGeneratedBy === 'ai' ? 'AI-generated' : 'Written manually';
  }

  get generatedAt(): Date | null {
    return this.interaction?.summaryGeneratedAt
      ? new Date(this.interaction.summaryGeneratedAt)
      : null;
  }

  get draftWordCount(): number {
    const t = this.draftText.trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }

  startEditing(): void {
    this.draftText = this.savedSummary;
    this.editing = true;
    this.saveSuccess = false;
    this.aiError = null;
  }

  cancelEditing(): void {
    this.editing = false;
    this.draftText = '';
  }

  generateAI(): void {
    if (!this.interaction?._id || this.generatingAI) return;
    this.generatingAI = true;
    this.aiError = null;
    this.saveSuccess = false;

    this.sub = this.inboxService.generateAISummary(this.interaction._id).subscribe({
      next: (res) => {
        this.generatingAI = false;
        if (res.success && res.data?.summary) {
          // Put the AI summary into the editor for review/edit
          this.draftText = res.data.summary;
          // Attach the suggested action to the interaction object so it renders immediately
          if (this.interaction) {
            this.interaction.summarySuggestedAction = res.data.suggestedAction ?? null;
          }
          this.editing = true;
          this.notify.success('Summary generated', 'Review and save your AI summary below.');
          this.updated.emit();
        } else {
          this.aiError = 'Failed to generate summary. Please try again.';
        }
      },
      error: (err) => {
        this.generatingAI = false;
        const msg = err?.error?.error || 'Failed to generate AI summary.';
        const code = err?.error?.code;
        if (code === 'INSUFFICIENT_CREDITS') {
          this.aiError = 'Not enough AI credits. Please upgrade your plan.';
        } else {
          this.aiError = msg;
        }
      }
    });
  }

  saveSummary(): void {
    if (!this.interaction?._id || this.saving) return;
    const text = this.draftText.trim();
    if (!text) {
      this.aiError = 'Summary cannot be empty.';
      return;
    }
    this.saving = true;
    this.aiError = null;

    this.sub = this.inboxService.saveSummary(this.interaction._id, text).subscribe({
      next: (res) => {
        this.saving = false;
        if (res.success) {
          this.editing = false;
          this.draftText = '';
          this.saveSuccess = true;
          this.notify.success('Summary saved', 'Chat summary has been saved.');
          this.updated.emit();
          setTimeout(() => { this.saveSuccess = false; }, 3000);
        } else {
          this.aiError = 'Could not save summary. Please try again.';
        }
      },
      error: () => {
        this.saving = false;
        this.aiError = 'Could not save summary. Please try again.';
      }
    });
  }

  private resetState(): void {
    this.sub?.unsubscribe();
    this.editing = false;
    this.draftText = '';
    this.generatingAI = false;
    this.saving = false;
    this.aiError = null;
    this.saveSuccess = false;
  }
}
