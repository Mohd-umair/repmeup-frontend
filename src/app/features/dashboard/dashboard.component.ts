import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { InboxService } from '../../core/services/inbox.service';
import { AuthService } from '../../core/services/auth.service';
import { IInboxStats } from '../../core/models/interaction.model';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats: IInboxStats | null = null;
  loading = true;
  currentUser: any = null;
  
  // AI Credits
  aiCredits: any = null;
  loadingCredits = true;

  // Onboarding state
  hasConnectedPlatforms = false;
  checkingPlatforms = true;

  // Tasks tracking
  tasks = {
    total: 0,
    pending: 0,
    completed: 0,
    completionRate: 0
  };
  loadingTasks = true;

  // Quick Navigation Cards
  quickActions = [
    {
      title: 'Inbox',
      description: 'Manage conversations',
      icon: 'fas fa-inbox',
      route: '/app/inbox',
      stats: 0,
      statsLabel: 'unread'
    },
    {
      title: 'Publish',
      description: 'Create & schedule posts',
      icon: 'fas fa-paper-plane',
      route: '/app/publish',
      stats: 0,
      statsLabel: 'scheduled'
    },
    {
      title: 'Analytics',
      description: 'View insights',
      icon: 'fas fa-chart-line',
      route: '/app/analytics',
      stats: 0,
      statsLabel: 'reports'
    },
    {
      title: 'AI Credits',
      description: 'Manage AI usage',
      icon: 'fas fa-bolt',
      route: '/app/ai-credits',
      stats: 0,
      statsLabel: 'remaining'
    }
  ];

  // Performance Metrics
  performanceMetrics = {
    avgResponseTime: '0h',
    resolutionRate: 0,
    satisfactionScore: 0,
    activeAgents: 0,
    overdueCount: 0
  };
  loadingPerformance = true;

  // Growth metrics
  growthPercentage = 0;
  loadingGrowth = true;

  // Dashboard KPIs (Social Autopilot)
  kpi = {
    postsScheduled: 0,
    pendingApprovals: 0,
    engagement30d: 0,
    aiGeneratedPercent: 0
  };
  loadingKpi = true;
  upcomingPosts: any[] = [];
  loadingUpcoming = true;
  trendInsights: any[] = [];
  loadingTrends = true;
  calendarMonth: Date = new Date();

  // Recent Activity
  recentActivity: any[] = [];
  loadingActivity = true;

  // Make Math available in template
  Math = Math;

  private subscriptions: Subscription[] = [];

  constructor(
    private inboxService: InboxService,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadAllData(): void {
    this.checkPlatformConnections();
    this.loadStats();
    this.loadAICredits();
    this.loadRecentActivity();
    this.loadTasks();
    this.loadPerformanceMetrics();
    this.loadGrowthStats();
    this.loadScheduledPosts();
    this.loadDashboardKpi();
    this.loadUpcomingPosts();
    this.loadTrendInsights();
  }

  checkPlatformConnections(): void {
    this.checkingPlatforms = true;
    this.http.get<any>(`${environment.apiUrl}/platforms/connections`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Check if any platform is connected
          this.hasConnectedPlatforms = response.data.some((platform: any) => platform.status === 'connected');
        }
        this.checkingPlatforms = false;
      },
      error: (error) => {
        console.error('Error checking platforms:', error);
        // Assume no platforms connected if error
        this.hasConnectedPlatforms = false;
        this.checkingPlatforms = false;
      }
    });
  }

  loadStats(): void {
    this.inboxService.getStats().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats = response.data;
          this.kpi.engagement30d = response.data.total ?? 0;
          // Update quick action stats
          const inboxAction = this.quickActions.find(action => action.title === 'Inbox');
          if (inboxAction) {
            inboxAction.stats = response.data.unread || 0;
          }
          // Update SLA metrics from stats (avg response time, overdue count)
          const avgMin = response.data.avgResponseTimeMinutes;
          if (avgMin != null && avgMin > 0) {
            this.performanceMetrics.avgResponseTime = this.formatTime(avgMin);
          }
          this.performanceMetrics.overdueCount = response.data.overdueCount ?? 0;
        } else {
          this.stats = { total: 0, unread: 0, positive: 0, negative: 0, neutral: 0 } as any;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading stats:', error);
        this.stats = { total: 0, unread: 0, positive: 0, negative: 0, neutral: 0 } as any;
        this.loading = false;
      }
    });
  }

  loadAICredits(): void {
    this.loadingCredits = true;
    
    this.http.get<any>(`${environment.apiUrl}/users/ai-credits`).subscribe({
      next: (response) => {
        if (response.success && response.credits) {
          this.aiCredits = response.credits;
          // Update AI credits quick action
          const creditsAction = this.quickActions.find(action => action.title === 'AI Credits');
          if (creditsAction) {
            creditsAction.stats = this.aiCredits.isUnlimited ? '∞' : this.aiCredits.remaining;
          }
        } else {
          // Handle empty response
          this.aiCredits = { current: 0, limit: 0, remaining: 0, isUnlimited: false };
          const creditsAction = this.quickActions.find(action => action.title === 'AI Credits');
          if (creditsAction) {
            creditsAction.stats = 0;
          }
        }
        this.loadingCredits = false;
      },
      error: (error) => {
        console.error('Error loading AI credits:', error);
        // Set default values on error
        this.aiCredits = { current: 0, limit: 0, remaining: 0, isUnlimited: false };
        const creditsAction = this.quickActions.find(action => action.title === 'AI Credits');
        if (creditsAction) {
          creditsAction.stats = 0;
        }
        this.loadingCredits = false;
      }
    });
  }

  loadRecentActivity(): void {
    this.loadingActivity = true;
    
    // Load last 5 interactions
    this.inboxService.getInteractions({ page: 1, limit: 5 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Handle both formats: response.data.interactions or response.data as array
          const interactions = response.data.interactions || response.data;
          const interactionArray = Array.isArray(interactions) ? interactions : [];
          
          this.recentActivity = interactionArray.slice(0, 5).map((interaction: any) => ({
            id: interaction._id,
            platform: interaction.platform,
            type: interaction.type,
            author: interaction.author?.username || interaction.author?.name || 'Unknown',
            content: interaction.lastMessage?.content || interaction.content || '',
            sentiment: interaction.sentiment || 'neutral',
            time: this.getTimeAgo(interaction.createdAt),
            isUnread: interaction.status === 'unread'
          }));
        } else {
          this.recentActivity = [];
        }
        this.loadingActivity = false;
      },
      error: (error) => {
        console.error('Error loading recent activity:', error);
        this.recentActivity = [];
        this.loadingActivity = false;
      }
    });
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  }

  getSentimentClass(sentiment: string): string {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500/20 text-green-500 border border-green-500/30';
      case 'negative':
        return 'bg-red-500/20 text-red-500 border border-red-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30';
    }
  }

  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      'instagram': 'fab fa-instagram',
      'facebook': 'fab fa-facebook',
      'youtube': 'fab fa-youtube',
      'google': 'fab fa-google',
      'whatsapp': 'fab fa-whatsapp',
      'twitter': 'fab fa-twitter'
    };
    return icons[platform.toLowerCase()] || 'fas fa-comment';
  }

  getPercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }


  navigateTo(route: string, queryParams?: Record<string, string>): void {
    if (queryParams) {
      this.router.navigate([route], { queryParams });
    } else {
      this.router.navigate([route]);
    }
  }

  viewInteraction(id: string): void {
    this.router.navigate(['/app/inbox'], { queryParams: { selected: id } });
  }

  getCreditStatusColor(): string {
    if (!this.aiCredits) return 'text-gray-400';
    if (this.aiCredits.isUnlimited) return 'text-rep-lime';
    if (this.aiCredits.isAtLimit) return 'text-red-500';
    if (this.aiCredits.isNearLimit) return 'text-yellow-500';
    return 'text-rep-lime';
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  loadTasks(): void {
    this.loadingTasks = true;
    
    // Get only interactions assigned to the current user (agent tasks)
    if (!this.currentUser || !this.currentUser._id) {
      this.tasks = { total: 0, pending: 0, completed: 0, completionRate: 0 };
      this.loadingTasks = false;
      return;
    }
    
    this.inboxService.getInteractions({ 
      page: 1,
      limit: 1000, // Get all assigned interactions
      assignedTo: this.currentUser._id // Filter by current user
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Handle both formats: response.data.interactions or response.data as array
          const interactions = response.data.interactions || response.data;
          const interactionArray = Array.isArray(interactions) ? interactions : [];
          
          // Filter to only show interactions assigned to current user
          const myTasks = interactionArray.filter((int: any) => 
            int.assignedTo === this.currentUser._id || 
            (int.assignedTo && int.assignedTo._id === this.currentUser._id)
          );
          
          this.tasks.total = myTasks.length;
          
          // Count pending (not resolved)
          this.tasks.pending = myTasks.filter((int: any) => 
            int.status !== 'resolved' && int.status !== 'closed'
          ).length;
          
          // Count completed (resolved or closed)
          this.tasks.completed = myTasks.filter((int: any) => 
            int.status === 'resolved' || int.status === 'closed'
          ).length;
          
          // Calculate completion rate
          this.tasks.completionRate = this.tasks.total > 0 
            ? Math.round((this.tasks.completed / this.tasks.total) * 100) 
            : 0;
        } else {
          // Handle empty or error response
          this.tasks = { total: 0, pending: 0, completed: 0, completionRate: 0 };
        }
        this.loadingTasks = false;
      },
      error: (error) => {
        console.error('Error loading tasks:', error);
        // Set default values on error
        this.tasks = { total: 0, pending: 0, completed: 0, completionRate: 0 };
        this.loadingTasks = false;
      }
    });
  }

  getTasksStatusMessage(): string {
    if (this.tasks.pending === 0 && this.tasks.total > 0) {
      return '🎉 Amazing! All assigned tasks completed!';
    } else if (this.tasks.pending === 0) {
      return '👍 No tasks assigned to you yet';
    } else if (this.tasks.pending <= 5) {
      return '💪 Almost there! Just a few more assigned tasks';
    } else if (this.tasks.pending <= 10) {
      return '⚡ Keep going! You\'re making great progress';
    } else {
      return '🚀 Let\'s tackle your assigned tasks!';
    }
  }

  getTasksStatusColor(): string {
    if (this.tasks.pending === 0) {
      return 'text-green-500';
    } else if (this.tasks.pending <= 5) {
      return 'text-rep-lime';
    } else if (this.tasks.pending <= 10) {
      return 'text-yellow-500';
    } else {
      return 'text-red-500';
    }
  }

  loadPerformanceMetrics(): void {
    this.loadingPerformance = true;
    
    // Load all interactions to calculate performance metrics
    this.inboxService.getInteractions({ page: 1, limit: 1000 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Handle both formats: response.data.interactions or response.data as array
          const interactions = response.data.interactions || response.data;
          const interactionArray = Array.isArray(interactions) ? interactions : [];
          
          // Avg response time comes from stats (backend aggregation); only set N/A here if stats didn't
          if (this.performanceMetrics.avgResponseTime === '0h') {
            const respondedInteractions = interactionArray.filter((int: any) => int.respondedAt && (int.platformCreatedAt || int.createdAt));
            if (respondedInteractions.length > 0) {
              const totalResponseTime = respondedInteractions.reduce((sum: number, int: any) => {
                const created = int.platformCreatedAt || int.createdAt;
                return sum + (new Date(int.respondedAt).getTime() - new Date(created).getTime());
              }, 0);
              const avgMinutes = totalResponseTime / respondedInteractions.length / 60000;
              this.performanceMetrics.avgResponseTime = this.formatTime(avgMinutes);
            } else {
              this.performanceMetrics.avgResponseTime = 'N/A';
            }
          }
          
          // Calculate resolution rate
          const totalInteractions = interactionArray.length;
          const resolvedInteractions = interactionArray.filter((int: any) => 
            int.status === 'resolved' || int.status === 'closed'
          ).length;
          this.performanceMetrics.resolutionRate = totalInteractions > 0 
            ? Math.round((resolvedInteractions / totalInteractions) * 100) 
            : 0;
          
          // Calculate satisfaction score (based on positive sentiment)
          const positiveCount = interactionArray.filter((int: any) => int.sentiment === 'positive').length;
          const negativeCount = interactionArray.filter((int: any) => int.sentiment === 'negative').length;
          const neutralCount = interactionArray.filter((int: any) => int.sentiment === 'neutral').length;
          const totalSentiment = positiveCount + negativeCount + neutralCount;
          
          if (totalSentiment > 0) {
            // Score from 0-5 based on sentiment distribution
            const score = ((positiveCount * 5) + (neutralCount * 3) + (negativeCount * 1)) / totalSentiment;
            this.performanceMetrics.satisfactionScore = Math.round(score * 10) / 10; // Round to 1 decimal
          } else {
            this.performanceMetrics.satisfactionScore = 0;
          }
        } else {
          // Set defaults if no data
          this.performanceMetrics.avgResponseTime = 'N/A';
          this.performanceMetrics.resolutionRate = 0;
          this.performanceMetrics.satisfactionScore = 0;
        }
        this.loadingPerformance = false;
      },
      error: (error) => {
        console.error('Error loading performance metrics:', error);
        // Set defaults on error
        this.performanceMetrics.avgResponseTime = 'N/A';
        this.performanceMetrics.resolutionRate = 0;
        this.performanceMetrics.satisfactionScore = 0;
        this.loadingPerformance = false;
      }
    });
    
    // Load active agents count
    this.http.get<any>(`${environment.apiUrl}/users/agents/available`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.performanceMetrics.activeAgents = response.data.length;
        } else {
          this.performanceMetrics.activeAgents = 0;
        }
      },
      error: (error) => {
        console.error('Error loading active agents:', error);
        this.performanceMetrics.activeAgents = 0;
      }
    });
  }

  loadGrowthStats(): void {
    this.loadingGrowth = true;
    
    // Calculate growth compared to last month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get current month stats
    this.inboxService.getInteractions({ page: 1, limit: 10000 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Handle both formats
          const allInteractions = response.data.interactions || response.data;
          const interactionArray = Array.isArray(allInteractions) ? allInteractions : [];
          
          // Count this month's interactions
          const thisMonthCount = interactionArray.filter((int: any) => 
            new Date(int.createdAt) >= thisMonthStart
          ).length;
          
          // Count last month's interactions
          const lastMonthCount = interactionArray.filter((int: any) => {
            const createdAt = new Date(int.createdAt);
            return createdAt >= lastMonth && createdAt < thisMonthStart;
          }).length;
          
          // Calculate percentage growth
          if (lastMonthCount > 0) {
            this.growthPercentage = Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);
          } else if (thisMonthCount > 0) {
            this.growthPercentage = 100; // 100% growth if there was nothing last month
          } else {
            this.growthPercentage = 0;
          }
        } else {
          this.growthPercentage = 0;
        }
        this.loadingGrowth = false;
      },
      error: (error) => {
        console.error('Error loading growth stats:', error);
        this.growthPercentage = 0;
        this.loadingGrowth = false;
      }
    });
  }

  loadScheduledPosts(): void {
    // Load scheduled posts count for quick actions
    this.http.get<any>(`${environment.apiUrl}/posts/scheduled`).subscribe({
      next: (response) => {
        const publishAction = this.quickActions.find(action => action.title === 'Publish');
        if (publishAction) {
          if (response.success && response.data) {
            publishAction.stats = response.data.length || 0;
          } else if (response.posts) {
            // Handle old format
            publishAction.stats = response.posts.length || 0;
          } else {
            publishAction.stats = 0;
          }
        }
      },
      error: (error) => {
        console.error('Error loading scheduled posts:', error);
        const publishAction = this.quickActions.find(action => action.title === 'Publish');
        if (publishAction) {
          publishAction.stats = 0;
        }
      }
    });

    // Load analytics count - use a simpler approach
    // Just count connected platforms as reports
    this.http.get<any>(`${environment.apiUrl}/platforms/connections`).subscribe({
      next: (response) => {
        const analyticsAction = this.quickActions.find(action => action.title === 'Analytics');
        if (analyticsAction) {
          if (response.success && response.data) {
            const connectedPlatforms = response.data.filter((p: any) => p.status === 'connected');
            analyticsAction.stats = connectedPlatforms.length;
          } else {
            analyticsAction.stats = 0;
          }
        }
      },
      error: (error) => {
        console.error('Error loading analytics count:', error);
        const analyticsAction = this.quickActions.find(action => action.title === 'Analytics');
        if (analyticsAction) {
          analyticsAction.stats = 0;
        }
      }
    });
  }

  formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  getTotalInteractionsProgress(): number {
    return this.Math.min(100, ((this.stats?.total || 0) / 100) * 100);
  }

  loadDashboardKpi(): void {
    this.loadingKpi = true;
    this.http.get<any>(`${environment.apiUrl}/posts/dashboard-counts`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.kpi.postsScheduled = res.data.scheduled ?? 0;
          this.kpi.pendingApprovals = res.data.pendingApproval ?? 0;
          this.kpi.aiGeneratedPercent = res.data.aiGeneratedPercent ?? 0;
        }
        this.kpi.engagement30d = this.stats?.total ?? 0;
        this.loadingKpi = false;
      },
      error: () => {
        this.loadingKpi = false;
      }
    });
  }

  loadUpcomingPosts(): void {
    this.loadingUpcoming = true;
    this.http.get<any>(`${environment.apiUrl}/posts/scheduled`).subscribe({
      next: (res) => {
        if (res.success && res.data && Array.isArray(res.data)) {
          this.upcomingPosts = res.data.slice(0, 10);
        } else {
          this.upcomingPosts = [];
        }
        this.loadingUpcoming = false;
      },
      error: () => {
        this.upcomingPosts = [];
        this.loadingUpcoming = false;
      }
    });
  }

  loadTrendInsights(): void {
    this.loadingTrends = true;
    this.http.get<any>(`${environment.apiUrl}/trends`).subscribe({
      next: (res) => {
        if (res.success && res.data && Array.isArray(res.data)) {
          this.trendInsights = res.data.slice(0, 5);
        } else {
          this.trendInsights = [];
        }
        this.loadingTrends = false;
      },
      error: () => {
        this.trendInsights = [];
        this.loadingTrends = false;
      }
    });
  }

  getCalendarDays(): { date: Date; day: number; isCurrentMonth: boolean; isToday: boolean }[] {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const days: { date: Date; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < startPad; i++) {
      const d = new Date(year, month, -startPad + i + 1);
      days.push({ date: d, day: d.getDate(), isCurrentMonth: false, isToday: false });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);
      days.push({ date, day: d, isCurrentMonth: true, isToday: date.getTime() === today.getTime() });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, day: d.getDate(), isCurrentMonth: false, isToday: false });
    }
    return days.slice(0, 42);
  }

  prevMonth(): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1);
  }

  nextMonth(): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1);
  }

  calendarMonthLabel(): string {
    return this.calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  }
}
