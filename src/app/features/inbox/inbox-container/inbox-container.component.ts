import { Component, OnInit } from '@angular/core';
import { InboxService } from '../../../core/services/inbox.service';
import { IInteraction, IInboxFilters } from '../../../core/models/interaction.model';

/**
 * Inbox Container Component - Single Responsibility Principle
 * Manages the unified inbox with three-column layout
 */
@Component({
  selector: 'app-inbox-container',
  templateUrl: './inbox-container.component.html',
  styleUrls: ['./inbox-container.component.scss']
})
export class InboxContainerComponent implements OnInit {
  interactions: IInteraction[] = [];
  selectedInteraction: IInteraction | null = null;
  filters: IInboxFilters = {};
  loading = false;

  constructor(private inboxService: InboxService) {}

  ngOnInit(): void {
    this.loadInteractions();

    // Subscribe to interactions
    this.inboxService.interactions$.subscribe(interactions => {
      this.interactions = interactions;
    });

    // Subscribe to selected interaction
    this.inboxService.selectedInteraction$.subscribe(interaction => {
      this.selectedInteraction = interaction;
    });
  }

  loadInteractions(): void {
    this.loading = true;
    this.inboxService.getInteractions(this.filters).subscribe({
      next: () => {
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onFilterChange(filters: IInboxFilters): void {
    this.filters = filters;
    this.loadInteractions();
  }

  onInteractionSelect(interaction: IInteraction): void {
    this.inboxService.setSelectedInteraction(interaction);
  }

  onInteractionUpdate(): void {
    this.loadInteractions();
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
}
