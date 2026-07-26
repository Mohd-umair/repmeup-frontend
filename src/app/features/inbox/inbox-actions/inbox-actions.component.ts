import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InboxService } from '../../../core/services/inbox.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, IAvailableAgent } from '../../../core/services/user.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { IInteraction, InteractionStatus } from '../../../core/models/interaction.model';
import { PremiumSelectComponent, PremiumSelectOption } from '../../../shared/components/premium-select/premium-select.component';

@Component({
  selector: 'app-inbox-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, PremiumSelectComponent],
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
  updatingStatus = false;

  readonly InteractionStatus = InteractionStatus;

  readonly statusOptions: { value: InteractionStatus; label: string; icon: string; colorClass: string }[] = [
    { value: InteractionStatus.UNREAD,    label: 'Unread',    icon: 'fa-envelope',        colorClass: 'text-blue-600'   },
    { value: InteractionStatus.READ,      label: 'Read',      icon: 'fa-envelope-open',   colorClass: 'text-gray-500'   },
    { value: InteractionStatus.REPLIED,   label: 'Replied',   icon: 'fa-reply',           colorClass: 'text-green-600'  },
    { value: InteractionStatus.RESOLVED,  label: 'Resolved',  icon: 'fa-check-circle',    colorClass: 'text-emerald-600'},
    { value: InteractionStatus.ARCHIVED,  label: 'Archived',  icon: 'fa-archive',         colorClass: 'text-amber-600'  },
    { value: InteractionStatus.SPAM,      label: 'Spam',      icon: 'fa-ban',             colorClass: 'text-red-600'    },
  ];

  constructor(
    private inboxService: InboxService,
    private authService: AuthService,
    private userService: UserService,
    private sweetAlertService: SweetAlertService
  ) {}

  /** Premium-select options for the Assign dropdown. */
  get agentSelectOptions(): PremiumSelectOption[] {
    return (this.availableAgents || []).map((a) => ({
      value: a._id,
      label: `${a.firstName} ${a.lastName}`.trim(),
      iconClass: 'fas fa-user',
      colorClass: 'text-gray-400'
    }));
  }

  /** Premium-select options for the Status dropdown (current status disabled). */
  get statusSelectOptions(): PremiumSelectOption[] {
    return this.statusOptions.map((o) => ({
      value: o.value,
      label: o.label,
      iconClass: `fas ${o.icon}`,
      colorClass: o.colorClass,
      disabled: this.interaction?.status === o.value
    }));
  }

  /** Premium-select options for the Add-label dropdown (already-applied disabled). */
  get labelSelectOptions(): PremiumSelectOption[] {
    return (this.orgLabels || []).map((l) => ({
      value: l._id,
      label: l.name,
      iconClass: 'fas fa-tag',
      colorClass: 'text-gray-400',
      disabled: this.hasLabel(l._id)
    }));
  }

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
    if (!this.interaction?._id || !status || this.updatingStatus) return;
    this.updatingStatus = true;
    this.inboxService.updateStatus(this.interaction._id, status).subscribe({
      next: (response) => {
        this.updatingStatus = false;
        if (response.success) {
          const option = this.statusOptions.find(o => o.value === status);
          this.sweetAlertService.toast('success', `Status set to ${option?.label ?? status}`);
          this.refreshInteraction();
        }
      },
      error: (err) => {
        this.updatingStatus = false;
        const msg = err?.error?.error || 'Could not update status';
        this.sweetAlertService.toast('error', msg);
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

  getCurrentStatusOption(): { value: InteractionStatus; label: string; icon: string; colorClass: string } | undefined {
    return this.statusOptions.find(o => o.value === this.interaction?.status);
  }
}
