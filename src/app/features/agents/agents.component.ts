import { Component } from '@angular/core';

/**
 * Agents Component - Single Responsibility Principle
 * Manages team members and agent assignment
 */
@Component({
  selector: 'app-agents',
  templateUrl: './agents.component.html',
  styleUrls: ['./agents.component.scss']
})
export class AgentsComponent {
  agents = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
      status: 'active',
      assignedTasks: 12,
      resolvedToday: 8,
      avatar: 'JD'
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'agent',
      status: 'active',
      assignedTasks: 8,
      resolvedToday: 5,
      avatar: 'JS'
    },
    {
      id: '3',
      name: 'Mike Johnson',
      email: 'mike@example.com',
      role: 'agent',
      status: 'offline',
      assignedTasks: 3,
      resolvedToday: 3,
      avatar: 'MJ'
    }
  ];

  getRoleColor(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'agent':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusColor(status: string): string {
    return status === 'active' ? 'bg-green-500' : 'bg-gray-400';
  }

  addAgent(): void {
    // TODO: Implement add agent modal
    console.log('Add agent clicked');
  }

  editAgent(agent: any): void {
    // TODO: Implement edit agent modal
    console.log('Edit agent:', agent);
  }

  deleteAgent(agent: any): void {
    // TODO: Implement delete confirmation
    console.log('Delete agent:', agent);
  }

  getTotalTasks(): number {
    return this.agents.reduce((sum, agent) => sum + agent.assignedTasks, 0);
  }

  getTotalResolved(): number {
    return this.agents.reduce((sum, agent) => sum + agent.resolvedToday, 0);
  }

  getActiveAgentsCount(): number {
    return this.agents.filter(agent => agent.status === 'active').length;
  }
}
