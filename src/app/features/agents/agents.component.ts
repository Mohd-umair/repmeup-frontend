import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService, IUser, ICreateUserDto, IUpdateUserDto } from '../../core/services/user.service';

/**
 * Agents Component - Single Responsibility Principle
 * Manages team members and agent assignment
 */
@Component({
  selector: 'app-agents',
  templateUrl: './agents.component.html',
  styleUrls: ['./agents.component.scss']
})
export class AgentsComponent implements OnInit {
  agents: IUser[] = [];
  loading = false;
  error: string | null = null;
  
  // Modal states
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  selectedAgent: IUser | null = null;
  
  // Forms
  addAgentForm: FormGroup;
  editAgentForm: FormGroup;
  
  // Filters
  roleFilter: string = '';
  statusFilter: string = '';
  searchQuery: string = '';

  constructor(
    private userService: UserService,
    private fb: FormBuilder
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

  // Modal actions
  openAddModal(): void {
    this.showAddModal = true;
    this.addAgentForm.reset({ role: 'agent' });
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.addAgentForm.reset();
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
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedAgent = null;
    this.editAgentForm.reset();
  }

  openDeleteModal(agent: IUser): void {
    this.selectedAgent = agent;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedAgent = null;
  }

  // CRUD operations
  submitAddAgent(): void {
    if (this.addAgentForm.invalid) {
      return;
    }

    const data: ICreateUserDto = this.addAgentForm.value;

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
    if (this.editAgentForm.invalid || !this.selectedAgent) {
      return;
    }

    const data: IUpdateUserDto = this.editAgentForm.value;

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
}
