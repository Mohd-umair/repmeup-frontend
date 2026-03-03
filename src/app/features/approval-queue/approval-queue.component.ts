import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

interface PendingPost {
  _id: string;
  content: string;
  originalContent?: string;
  platform: string;
  generatedBy: 'ai' | 'human';
  riskScore?: number;
  complianceFlags?: string[];
  scheduledFor?: string;
  platformConnection?: { platform: string; platformUsername?: string };
}

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, ButtonComponent],
  templateUrl: './approval-queue.component.html',
  styleUrls: ['./approval-queue.component.scss']
})
export class ApprovalQueueComponent implements OnInit {
  posts: PendingPost[] = [];
  loading = true;
  selectedId: string | null = null;
  selectedPost: PendingPost | null = null;
  filterPlatform = '';
  filterRisk = '';
  selectedIds = new Set<string>();
  bulkApproving = false;
  showBulkConfirm = false;
  rejectReason = '';
  showRejectModal = false;
  rejectingId: string | null = null;
  approvingId: string | null = null;
  scheduleDate = '';
  scheduleTime = '';
  showScheduleModal = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.http.get<{ success: boolean; data: PendingPost[] }>(`${environment.apiUrl}/posts/pending-approval`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.posts = res.data;
        } else {
          this.posts = [];
        }
        this.loading = false;
      },
      error: () => {
        this.posts = [];
        this.loading = false;
      }
    });
  }

  get filteredPosts(): PendingPost[] {
    let list = this.posts;
    if (this.filterPlatform) {
      list = list.filter(p => p.platform?.toLowerCase() === this.filterPlatform.toLowerCase());
    }
    if (this.filterRisk === 'high') {
      list = list.filter(p => (p.riskScore ?? 0) >= 70);
    } else if (this.filterRisk === 'low') {
      list = list.filter(p => (p.riskScore ?? 0) < 70);
    }
    return list;
  }

  openDetail(post: PendingPost): void {
    this.selectedId = post._id;
    this.selectedPost = post;
  }

  closeDetail(): void {
    this.selectedId = null;
    this.selectedPost = null;
  }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedIds.size === this.filteredPosts.length) {
      this.selectedIds.clear();
    } else {
      this.filteredPosts.forEach(p => this.selectedIds.add(p._id));
    }
  }

  openBulkConfirm(): void {
    if (this.selectedIds.size === 0) return;
    this.showBulkConfirm = true;
  }

  bulkApprove(): void {
    const ids = Array.from(this.selectedIds);
    this.bulkApproving = true;
    const next = (i: number) => {
      if (i >= ids.length) {
        this.bulkApproving = false;
        this.showBulkConfirm = false;
        this.selectedIds.clear();
        this.load();
        return;
      }
      this.http.patch(`${environment.apiUrl}/posts/${ids[i]}/approve`, {}).subscribe({
        next: () => next(i + 1),
        error: () => next(i + 1)
      });
    };
    next(0);
  }

  approve(post: PendingPost): void {
    this.approvingId = post._id;
    this.http.patch(`${environment.apiUrl}/posts/${post._id}/approve`, {}).subscribe({
      next: () => {
        this.approvingId = null;
        this.closeDetail();
        this.load();
      },
      error: () => {
        this.approvingId = null;
      }
    });
  }

  openScheduleModal(post: PendingPost): void {
    this.selectedPost = post;
    this.showScheduleModal = true;
  }

  confirmSchedule(): void {
    if (!this.selectedPost || !this.scheduleDate || !this.scheduleTime) return;
    const scheduledFor = new Date(`${this.scheduleDate}T${this.scheduleTime}`).toISOString();
    this.http.patch(`${environment.apiUrl}/posts/${this.selectedPost._id}/approve`, { scheduledFor }).subscribe({
      next: () => {
        this.showScheduleModal = false;
        this.scheduleDate = '';
        this.scheduleTime = '';
        this.closeDetail();
        this.load();
      }
    });
  }

  openRejectModal(post: PendingPost): void {
    this.rejectReason = '';
    this.rejectingId = post._id;
    this.showRejectModal = true;
  }

  confirmReject(): void {
    if (!this.rejectingId) return;
    this.http.patch(`${environment.apiUrl}/posts/${this.rejectingId}/reject`, { reason: this.rejectReason }).subscribe({
      next: () => {
        this.showRejectModal = false;
        this.rejectingId = null;
        this.rejectReason = '';
        this.closeDetail();
        this.load();
      }
    });
  }

  platformName(p: PendingPost): string {
    return p.platform === 'instagram' ? 'Instagram' : p.platform === 'facebook' ? 'Facebook' : p.platform === 'linkedin' ? 'LinkedIn' : p.platform || '';
  }
}
