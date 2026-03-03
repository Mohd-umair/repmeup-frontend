import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Meta Page Selector Component (Step 8)
 * Single Responsibility: Handle Facebook/Instagram page selection
 * Allows users to choose which pages to connect (with limit validation)
 */

export interface MetaPage {
  id: string;
  name: string;
  category?: string;
  hasInstagram: boolean;
  instagramAccount?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
  isConnectedFacebook: boolean;
  isConnectedInstagram: boolean;
  canConnect: boolean;
}

export interface PageSelectionData {
  pages: MetaPage[];
  remainingSlots: number;
  totalPages: number;
  connectedCount: number;
}

export interface ConnectionResult {
  connected: Array<{ pageId: string; pageName: string; platform: string }>;
  failed: Array<{ pageId: string; pageName?: string; reason: string; platform?: string }>;
  skipped: Array<{ pageId: string; pageName: string; reason: string; platform: string }>;
}

export interface ConnectPagesResponse {
  success: boolean;
  data: ConnectionResult;
  message: string;
}

export interface GetPagesResponse {
  success: boolean;
  data: PageSelectionData;
}

@Component({
  selector: 'app-meta-page-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meta-page-selector.component.html',
  styleUrls: ['./meta-page-selector.component.scss']
})
export class MetaPageSelectorComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() pagesConnected = new EventEmitter<void>();

  loading = false;
  connecting = false;
  pages: MetaPage[] = [];
  selectedPageIds: Set<string> = new Set();
  includeInstagram: Map<string, boolean> = new Map();
  remainingSlots = 0;
  totalPages = 0;
  connectedCount = 0;

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.visible) {
      this.loadPages();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Watch for visible property changes
    if (changes['visible'] && changes['visible'].currentValue === true) {
      // Reset state when modal opens
      this.selectedPageIds.clear();
      this.includeInstagram.clear();
      // Load pages from API
      this.loadPages();
    }
  }

  /**
   * Load user's Facebook pages (Open/Closed: Easy to extend with filters)
   */
  loadPages(): void {
    this.loading = true;
    
    console.log('🔄 [Meta Page Selector] Loading Facebook pages...');
    
    this.apiService.get<GetPagesResponse>('/meta/pages').subscribe({
      next: (response) => {
        console.log('✅ [Meta Page Selector] Pages loaded successfully:', response);
        if (response.success && response.data) {
          this.pages = response.data.pages;
          this.remainingSlots = response.data.remainingSlots;
          this.totalPages = response.data.totalPages;
          this.connectedCount = response.data.connectedCount;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ [Meta Page Selector] Error loading pages:', error);
        
        // Check if error is due to missing Facebook connection
        if (error.status === 404 && error.error?.code === 'USER_CONNECTION_NOT_FOUND') {
          console.warn('⚠️ Facebook user connection not found. This might be a timing issue.');
          
          // Show a more helpful message with retry option
          this.notificationService.warning(
            'Connection Still Processing',
            'Your Facebook connection is still being set up. Please wait a moment and try again.'
          );
          
          // Don't close the modal immediately - give user a chance to retry
          this.loading = false;
        } else {
          this.notificationService.error(
            'Load Failed',
            error.error?.error || 'Failed to load your Facebook pages. Please try again.'
          );
          this.loading = false;
          this.close();
        }
      }
    });
  }

  /**
   * Toggle page selection (Liskov Substitution: Can swap validation logic)
   */
  togglePageSelection(pageId: string): void {
    if (this.selectedPageIds.has(pageId)) {
      this.selectedPageIds.delete(pageId);
    } else {
      // Check if adding this would exceed remaining slots
      const currentSelectionCount = this.getNewConnectionsCount();
      
      if (currentSelectionCount >= this.remainingSlots) {
        this.notificationService.warning(
          'Selection Limit',
          `You can only add ${this.remainingSlots} more account${this.remainingSlots !== 1 ? 's' : ''}. Please deselect an account or upgrade your plan.`
        );
        return;
      }
      
      this.selectedPageIds.add(pageId);
    }
  }

  /**
   * Toggle Instagram for a page
   */
  toggleInstagram(pageId: string): void {
    const current = this.includeInstagram.get(pageId) || false;
    
    if (!current) {
      // Check limit
      const currentSelectionCount = this.getNewConnectionsCount();
      
      if (currentSelectionCount >= this.remainingSlots) {
        this.notificationService.warning(
          'Selection Limit',
          `You can only add ${this.remainingSlots} more account${this.remainingSlots !== 1 ? 's' : ''}. Instagram connection would exceed your limit.`
        );
        return;
      }
    }
    
    this.includeInstagram.set(pageId, !current);
  }

  /**
   * Calculate how many new connections will be created
   */
  getNewConnectionsCount(): number {
    let count = 0;
    
    this.selectedPageIds.forEach(pageId => {
      const page = this.pages.find(p => p.id === pageId);
      if (!page) return;
      
      // Count Facebook page if not already connected
      if (!page.isConnectedFacebook) {
        count++;
      }
      
      // Count Instagram if selected and not already connected
      if (this.includeInstagram.get(pageId) && page.hasInstagram && !page.isConnectedInstagram) {
        count++;
      }
    });
    
    return count;
  }

  /**
   * Check if page is selected
   */
  isPageSelected(pageId: string): boolean {
    return this.selectedPageIds.has(pageId);
  }

  /**
   * Connect selected pages
   */
  connectPages(): void {
    if (this.selectedPageIds.size === 0) {
      this.notificationService.warning(
        'No Selection',
        'Please select at least one page to connect'
      );
      return;
    }

    const newConnectionsCount = this.getNewConnectionsCount();
    
    if (newConnectionsCount > this.remainingSlots) {
      this.notificationService.error(
        'Plan Limit Exceeded',
        `Your plan allows only ${this.remainingSlots} more account${this.remainingSlots !== 1 ? 's' : ''}. You selected ${newConnectionsCount}. Please unselect ${newConnectionsCount - this.remainingSlots} account${newConnectionsCount - this.remainingSlots !== 1 ? 's' : ''} or upgrade your plan.`
      );
      return;
    }

    if (this.remainingSlots === 0) {
      this.notificationService.error(
        'Plan Limit Reached',
        'You have reached your plan limit. Please upgrade your plan or disconnect an existing account to connect new ones.'
      );
      return;
    }

    this.connecting = true;

    // Build request body
    const requestBody = {
      pageIds: Array.from(this.selectedPageIds),
      includeInstagram: this.pages.some(p => 
        this.selectedPageIds.has(p.id) && this.includeInstagram.get(p.id)
      )
    };

    this.apiService.post<ConnectPagesResponse>('/meta/pages/connect', requestBody).subscribe({
      next: (response) => {
        if (response.success) {
          const results = response.data;
          
          if (results.connected.length > 0) {
            this.notificationService.success(
              'Pages Connected',
              `Successfully connected ${results.connected.length} account(s)!`
            );
          }
          
          if (results.failed.length > 0) {
            this.notificationService.warning(
              'Partial Success',
              `${results.failed.length} account(s) could not be connected. ${results.failed[0]?.reason || ''}`
            );
          }
          
          // Emit success event
          this.pagesConnected.emit();
          this.close();
        }
        this.connecting = false;
      },
      error: (error) => {
        console.error('Error connecting pages:', error);
        
        // Show specific error for plan limit exceeded
        if (error.error?.code === 'PLAN_LIMIT_EXCEEDED') {
          this.notificationService.error(
            'Plan Limit Exceeded',
            error.error?.error || 'You have reached your plan limit for connected accounts.'
          );
          
          // Reload pages to refresh remaining slots
          this.loadPages();
        } else {
          this.notificationService.error(
            'Connection Failed',
            error.error?.error || 'Failed to connect pages. Please try again.'
          );
        }
        
        this.connecting = false;
      }
    });
  }

  /**
   * Close modal
   */
  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.selectedPageIds.clear();
    this.includeInstagram.clear();
  }

  /**
   * Get selection summary text
   */
  getSelectionSummary(): string {
    const count = this.getNewConnectionsCount();
    if (count === 0) return 'Select pages to connect';
    return `Connect ${count} account${count !== 1 ? 's' : ''}`;
  }

  /**
   * Check if can proceed with connection
   */
  canConnect(): boolean {
    return this.selectedPageIds.size > 0 && 
           this.getNewConnectionsCount() <= this.remainingSlots &&
           !this.connecting;
  }
}
