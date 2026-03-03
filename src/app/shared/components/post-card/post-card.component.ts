import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusBadgeComponent, StatusBadgeType } from '../status-badge/status-badge.component';
import { ButtonComponent } from '../button/button.component';

export interface PostCardPlatform {
  id: string;
  name: string;
  icon?: string;
}

export interface PostCardMedia {
  preview: string;
  type: 'image' | 'video';
}

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, ButtonComponent],
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.scss']
})
export class PostCardComponent {
  @Input() content = '';
  @Input() platform?: PostCardPlatform;
  @Input() status?: StatusBadgeType;
  @Input() generatedBy?: 'ai' | 'human';
  @Input() riskScore?: number;
  @Input() media: PostCardMedia[] = [];
  @Input() hashtags: string[] = [];
  @Input() scheduledFor?: Date | string;
  @Input() showActions = true;
  @Input() previewLength = 120;

  @Output() approve = new EventEmitter<void>();
  @Output() reject = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() schedule = new EventEmitter<void>();
  @Output() menuAction = new EventEmitter<string>();

  showMenu = false;

  get truncatedContent(): string {
    if (!this.content) return '';
    if (this.content.length <= this.previewLength) return this.content;
    return this.content.slice(0, this.previewLength).trim() + '…';
  }

  get platformIcon(): string {
    if (this.platform?.icon) return this.platform.icon;
    const id = (this.platform?.id ?? '').toLowerCase();
    if (id === 'instagram') return 'fab fa-instagram';
    if (id === 'facebook') return 'fab fa-facebook';
    if (id === 'linkedin') return 'fab fa-linkedin';
    if (id === 'x' || id === 'twitter') return 'fab fa-x-twitter';
    return 'fas fa-share-alt';
  }

  onApprove(): void { this.approve.emit(); }
  onReject(): void { this.reject.emit(); }
  onEdit(): void { this.edit.emit(); }
  onSchedule(): void { this.schedule.emit(); }
  toggleMenu(): void { this.showMenu = !this.showMenu; }
}
