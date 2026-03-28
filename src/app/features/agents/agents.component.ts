import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService, IUser, ICreateUserDto, IUpdateUserDto } from '../../core/services/user.service';
import { IntentBucketService, IIntentBucket } from '../../core/services/intent-bucket.service';

@Component({
  selector: 'app-agents',
  standalone: false,
  templateUrl: './agents.component.html',
  styleUrls: ['./agents.component.scss']
})
export class AgentsComponent implements OnInit {
  agents: IUser[] = [];
  loading = false;
  error: string | null = null;

  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  showPerformanceModal = false;
  selectedAgent: IUser | null = null;
  selectedAgentStats: any = null;
  loadingStats = false;

  addAgentForm: FormGroup;
  editAgentForm: FormGroup;

  roleFilter: string = '';
  statusFilter: string = '';
  searchQuery: string = '';

  buckets: IIntentBucket[] = [];

  readonly platformOptions: { value: string; label: string; icon: string }[] = [
    { value: 'instagram', label: 'Instagram', icon: 'fab fa-instagram' },
    { value: 'facebook', label: 'Facebook', icon: 'fab fa-facebook' },
    { value: 'youtube', label: 'YouTube', icon: 'fab fa-youtube' },
    { value: 'google', label: 'Google', icon: 'fab fa-google' },
    { value: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp' },
    { value: 'linkedin', label: 'LinkedIn', icon: 'fab fa-linkedin' }
  ];

  addSelectedBuckets: Set<string> = new Set();
  addSelectedPlatforms: Set<string> = new Set();
  editSelectedBuckets: Set<string> = new Set();
  editSelectedPlatforms: Set<string> = new Set();

  constructor(
    private userService: UserService,
    private fb: FormBuilder,
    private intentBucketService: IntentBucketService
  ) {
    this.addAgentForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      role: ['agent', Validators.required]
    });

    this.editAgentForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      role: ['', Validators.required],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadAgents();
    this.loadBuckets();
  }

  loadBuckets(): void {
    this.intentBucketService.getBuckets().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.buckets = res.data;
        }
      }
    });
  }

  loadAgents(): void {
    this.loading = true;
    this.error = null;

    const params: any = {};
    if (this.roleFilter) params.role = this.roleFilter;
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.searchQuery) params.search = this.searchQuery;

    this.userService.getUsers(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.agents = response.data || [];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Load agents error:', error);
        this.error = error.error?.error || 'Failed to load agents';
        this.loading = false;
      }
    });
  }

  openAddModal(): void {
    this.showAddModal = true;
    this.addAgentForm.reset({ role: 'agent' });
    this.addSelectedBuckets.clear();
    this.addSelectedPlatforms.clear();
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.addAgentForm.reset();
    this.addSelectedBuckets.clear();
    this.addSelectedPlatforms.clear();
  }

  openEditModal(agent: IUser): void {
    this.selectedAgent = agent;
    this.showEditModal = true;
    this.editAgentForm.patchValue({
      firstName: agent.firstName,
      lastName: agent.lastName,
      role: agent.role,
      isActive: agent.isActive
    });

    this.editSelectedBuckets = new Set(
      (agent.assignedBuckets || []).map(b => typeof b === 'string' ? b : b._id)
    );
    this.editSelectedPlatforms = new Set(agent.assignedPlatforms || []);
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedAgent = null;
    this.editAgentForm.reset();
    this.editSelectedBuckets.clear();
    this.editSelectedPlatforms.clear();
  }

  openDeleteModal(agent: IUser): void {
    this.selectedAgent = agent;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedAgent = null;
  }

  submitAddAgent(): void {
    if (this.addAgentForm.invalid) return;

    const data: ICreateUserDto = {
      ...this.addAgentForm.value,
      assignedBuckets: Array.from(this.addSelectedBuckets),
      assignedPlatforms: Array.from(this.addSelectedPlatforms)
    };

    this.userService.createUser(data).subscribe({
      next: (response) => {
        if (response.success) {
          this.closeAddModal();
          this.loadAgents();
        }
      },
      error: (error) => {
        console.error('Create agent error:', error);
        this.error = error.error?.error || 'Failed to create agent';
      }
    });
  }

  submitEditAgent(): void {
    if (this.editAgentForm.invalid || !this.selectedAgent) return;

    const data: IUpdateUserDto = {
      ...this.editAgentForm.value,
      assignedBuckets: Array.from(this.editSelectedBuckets),
      assignedPlatforms: Array.from(this.editSelectedPlatforms)
    };

    this.userService.updateUser(this.selectedAgent._id, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.closeEditModal();
          this.loadAgents();
        }
      },
      error: (error) => {
        console.error('Update agent error:', error);
        this.error = error.error?.error || 'Failed to update agent';
      }
    });
  }

  confirmDelete(): void {
    if (!this.selectedAgent) {
      return;
    }

    this.userService.deleteUser(this.selectedAgent._id).subscribe({
      next: (response) => {
        if (response.success) {
          this.closeDeleteModal();
          this.loadAgents();
        }
      },
      error: (error) => {
        console.error('Delete agent error:', error);
        this.error = error.error?.error || 'Failed to delete agent';
      }
    });
  }

  // Filter actions
  applyFilters(): void {
    this.loadAgents();
  }

  clearFilters(): void {
    this.roleFilter = '';
    this.statusFilter = '';
    this.searchQuery = '';
    this.loadAgents();
  }

  // Helper methods
  getRoleColor(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-rep-lime/20 text-rep-black border border-rep-lime/30';
      case 'manager':
        return 'bg-rep-lime/20 text-rep-black border border-rep-lime/30';
      case 'agent':
        return 'bg-gray-100 text-gray-800 border border-gray-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-600 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  }

  getStatusColor(isActive: boolean): string {
    return isActive ? 'bg-rep-lime' : 'bg-gray-400';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'active' : 'inactive';
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  getTotalTasks(): number {
    return this.agents.reduce((sum, agent) => sum + (agent.assignedTasks || 0), 0);
  }

  getTotalResolved(): number {
    return this.agents.reduce((sum, agent) => sum + (agent.resolvedToday || 0), 0);
  }

  getActiveAgentsCount(): number {
    return this.agents.filter(agent => agent.isActive).length;
  }

  toggleBucket(set: Set<string>, bucketId: string): void {
    set.has(bucketId) ? set.delete(bucketId) : set.add(bucketId);
  }

  togglePlatform(set: Set<string>, platform: string): void {
    set.has(platform) ? set.delete(platform) : set.add(platform);
  }

  getBucketName(id: string): string {
    return this.buckets.find(b => b._id === id)?.name || id;
  }

  getBucketColor(id: string): string {
    return this.buckets.find(b => b._id === id)?.color || '#6b7280';
  }

  getPlatformIcon(platform: string): string {
    return this.platformOptions.find(p => p.value === platform)?.icon || 'fas fa-globe';
  }

  getPlatformLabel(platform: string): string {
    return this.platformOptions.find(p => p.value === platform)?.label || platform;
  }

  getAgentBuckets(agent: IUser): { _id: string; name: string; color?: string }[] {
    if (!agent.assignedBuckets || agent.assignedBuckets.length === 0) return [];
    return (agent.assignedBuckets as any[]).map(b =>
      typeof b === 'string' ? { _id: b, name: this.getBucketName(b), color: this.getBucketColor(b) } : b
    );
  }

  openPerformanceModal(agent: IUser): void {
    this.selectedAgent = agent;
    this.showPerformanceModal = true;
    this.loadAgentStats(agent._id);
  }

  /**
   * Close performance modal
   */
  closePerformanceModal(): void {
    this.showPerformanceModal = false;
    this.selectedAgent = null;
    this.selectedAgentStats = null;
  }

  /**
   * Load detailed agent statistics
   */
  loadAgentStats(agentId: string): void {
    this.loadingStats = true;
    this.userService.getUserStats(agentId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.selectedAgentStats = response.data.stats;
        }
        this.loadingStats = false;
      },
      error: (error) => {
        console.error('Load agent stats error:', error);
        this.loadingStats = false;
      }
    });
  }
}
