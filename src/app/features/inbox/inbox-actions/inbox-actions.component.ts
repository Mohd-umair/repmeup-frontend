import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InboxService } from '../../../core/services/inbox.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, IAvailableAgent } from '../../../core/services/user.service';
import { IInteraction, InteractionStatus } from '../../../core/models/interaction.model';

@Component({
  selector: 'app-inbox-actions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inbox-actions.component.html',
  styleUrls: ['./inbox-actions.component.scss']
})
export class InboxActionsComponent implements OnInit {
  @Input() interaction: IInteraction | null = null;
  @Output() updated = new EventEmitter<void>();

  availableAgents: IAvailableAgent[] = [];
  loadingAgents = false;
  assigningAgent = false;
  addingNote = false;
  noteText = '';
  noteIsPrivate = false;
  currentUser: any = null;
  orgLabels: { _id: string; name: string; color?: string }[] = [];
  loadingLabels = false;
  addingLabel = false;

  readonly InteractionStatus = InteractionStatus;

  constructor(
    private inboxService: InboxService,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.loadAvailableAgents();
    this.loadLabels();
  }

  loadLabels(): void {
    this.loadingLabels = true;
    this.inboxService.getLabels().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.orgLabels = response.data;
        }
        this.loadingLabels = false;
      },
      error: () => {
        this.loadingLabels = false;
      }
    });
  }

  loadAvailableAgents(): void {
    this.loadingAgents = true;
    this.userService.getAvailableAgents().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.availableAgents = response.data;
        }
        this.loadingAgents = false;
      },
      error: () => {
        this.loadingAgents = false;
      }
    });
  }

  canAssign(): boolean {
    return this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'manager');
  }

  onStatusChange(status: string): void {
    if (!this.interaction?._id) return;
    this.inboxService.updateStatus(this.interaction._id, status).subscribe({
      next: (response) => {
        if (response.success) {
          this.refreshInteraction();
        }
      }
    });
  }

  onAssign(userId: string): void {
    if (!this.interaction?._id || !userId) return;
    this.assigningAgent = true;
    this.inboxService.assignInteraction(this.interaction._id, userId, 'manual').subscribe({
      next: (response) => {
        if (response.success) {
          this.refreshInteraction();
        }
        this.assigningAgent = false;
      },
      error: () => {
        this.assigningAgent = false;
      }
    });
  }

  get leadLabel(): { _id: string; name: string } | undefined {
    return this.orgLabels.find(l => l.name.toLowerCase() === 'lead');
  }

  hasLabel(labelId: string): boolean {
    const labels = (this.interaction as any)?.labels || [];
    return labels.some((l: any) => (l._id || l) === labelId);
  }

  onMarkAsLead(): void {
    const lead = this.leadLabel;
    if (!lead || !this.interaction?._id) return;
    if (this.hasLabel(lead._id)) return;
    this.onAddLabel(lead._id);
  }

  onAddLabel(labelId: string): void {
    if (!this.interaction?._id || !labelId) return;
    this.addingLabel = true;
    this.inboxService.addLabel(this.interaction._id, labelId).subscribe({
      next: (response) => {
        if (response.success) {
          this.refreshInteraction();
        }
        this.addingLabel = false;
      },
      error: () => {
        this.addingLabel = false;
      }
    });
  }

  onAddNote(): void {
    if (!this.interaction?._id || !this.noteText?.trim()) return;
    this.addingNote = true;
    this.inboxService.addNote(this.interaction._id, this.noteText.trim(), this.noteIsPrivate).subscribe({
      next: (response) => {
        if (response.success) {
          this.noteText = '';
          this.refreshInteraction();
        }
        this.addingNote = false;
      },
      error: () => {
        this.addingNote = false;
      }
    });
  }

  refreshInteraction(): void {
    if (this.interaction?._id) {
      this.inboxService.getInteraction(this.interaction._id).subscribe({
        next: (response) => {
          if (response.success) {
            this.updated.emit();
          }
        }
      });
    } else {
      this.updated.emit();
    }
  }

  getAssignedAgentName(): string {
    if (!this.interaction?.assignedTo) return '';
    const agent = this.interaction.assignedTo as any;
    if (agent.firstName && agent.lastName) {
      return `${agent.firstName} ${agent.lastName}`;
    }
    return agent.email || 'Unknown';
  }

  isAssigned(): boolean {
    return !!this.interaction?.assignedTo;
  }

  getAssignedAgentId(): string {
    if (!this.interaction?.assignedTo) return '';
    const agent = this.interaction.assignedTo as any;
    return agent._id || '';
  }

  isResolved(): boolean {
    return this.interaction?.status === InteractionStatus.RESOLVED;
  }
}
