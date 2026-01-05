import { Component, OnInit } from '@angular/core';
import { InboxService } from '../../core/services/inbox.service';
import { IInboxStats } from '../../core/models/interaction.model';

/**
 * Dashboard Component - Single Responsibility Principle
 * Displays overview of system metrics and statistics
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  stats: IInboxStats | null = null;
  loading = true;

  // Mock data for charts
  platformData = [
    { name: 'Instagram', value: 45, color: 'bg-purple-500' },
    { name: 'Facebook', value: 30, color: 'bg-blue-500' },
    { name: 'YouTube', value: 15, color: 'bg-red-500' },
    { name: 'Google', value: 10, color: 'bg-yellow-500' }
  ];

  recentActivity = [
    {
      platform: 'Instagram',
      type: 'Comment',
      author: 'john_doe',
      content: 'Great product! Really happy with the service.',
      sentiment: 'positive',
      time: '2 minutes ago'
    },
    {
      platform: 'Facebook',
      type: 'Review',
      author: 'Jane Smith',
      content: 'Not satisfied with the delivery time.',
      sentiment: 'negative',
      time: '15 minutes ago'
    },
    {
      platform: 'YouTube',
      type: 'Comment',
      author: 'tech_reviewer',
      content: 'Can you make a tutorial about this?',
      sentiment: 'neutral',
      time: '1 hour ago'
    }
  ];

  constructor(private inboxService: InboxService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.inboxService.getStats().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats = response.data;
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getSentimentClass(sentiment: string): string {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      'Instagram': '📷',
      'Facebook': '👍',
      'YouTube': '🎥',
      'Google': '🔍',
      'WhatsApp': '💬'
    };
    return icons[platform] || '📱';
  }

  getPercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }
}
