import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CreditUsageUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface CreditUsage {
  _id: string;
  operation: string;
  creditsUsed: number;
  metadata: any;
  createdAt: Date;
  user?: CreditUsageUser;
}

interface CreditStats {
  current: number;
  limit: number;
  planLimit?: number;
  carriedCredits?: number;
  effectiveLimit?: number;
  remaining: number;
  percentage: number;
  isUnlimited: boolean;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

@Component({
  selector: 'app-ai-credits',
  standalone: false,
  templateUrl: './ai-credits.component.html',
  styleUrls: ['./ai-credits.component.scss']
})
export class AiCreditsComponent implements OnInit {
  credits: CreditStats | null = null;
  usageHistory: CreditUsage[] = [];
  loading = true;
  error: string | null = null;

  // Pagination
  page = 1;
  limit = 20;
  totalPages = 1;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadCredits();
    this.loadUsageHistory();
  }

  loadCredits(): void {
    this.http.get<any>(`${environment.apiUrl}/users/ai-credits`).subscribe({
      next: (response) => {
        this.credits = response.credits;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading credits:', error);
        this.error = 'Failed to load Reppy credits';
        this.loading = false;
      }
    });
  }

  loadUsageHistory(): void {
    this.http.get<any>(`${environment.apiUrl}/users/ai-credits/usage?page=${this.page}&limit=${this.limit}`).subscribe({
      next: (response) => {
        this.usageHistory = response.data;
        this.totalPages = response.pagination.pages;
      },
      error: (error) => {
        console.error('Error loading usage history:', error);
      }
    });
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadUsageHistory();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadUsageHistory();
    }
  }

  getOperationIcon(operation: string): string {
    switch (operation) {
      case 'post_generation':
        return 'fas fa-wand-magic-sparkles';
      case 'content_analysis':
        return 'fas fa-chart-line';
      case 'sentiment_analysis':
        return 'fas fa-face-smile';
      default:
        return 'fas fa-bolt';
    }
  }

  getOperationLabel(operation: string): string {
    switch (operation) {
      case 'post_generation':
        return 'Post Generation';
      case 'content_analysis':
        return 'Content Analysis';
      case 'sentiment_analysis':
        return 'Sentiment Analysis';
      default:
        return operation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }

  getProgressBarColor(): string {
    if (!this.credits) return 'bg-gray-500';
    if (this.credits.isAtLimit) return 'bg-red-500';
    if (this.credits.isNearLimit) return 'bg-yellow-500';
    return 'bg-rep-lime';
  }

  hasCarryForward(): boolean {
    return !!(this.credits?.carriedCredits && this.credits.carriedCredits > 0);
  }

  formatNumber(n: number | undefined): string {
    if (n == null) return '0';
    return n.toLocaleString();
  }

  getUserName(user?: CreditUsageUser): string {
    if (!user) return 'System';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.email || 'Unknown User';
  }

  getUserInitials(user?: CreditUsageUser): string {
    if (!user) return 'SY';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    if (first || last) return (first + last).toUpperCase();
    return (user.email?.[0] ?? 'U').toUpperCase();
  }

  isRollover(operation: string): boolean {
    return operation === 'credit_rollover';
  }
}
