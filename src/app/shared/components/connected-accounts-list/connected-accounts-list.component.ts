import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { PlatformConnection } from '../../../core/services/platform-connection.service';

/**
 * Connected Accounts List Component (Single Responsibility)
 * Displays list of connected social media accounts
 * One row per connection (not per platform type)
 */
@Component({
  selector: 'app-connected-accounts-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connected-accounts-list.component.html',
  styleUrls: ['./connected-accounts-list.component.scss']
})
export class ConnectedAccountsListComponent {
  @Input() connections: PlatformConnection[] = [];
  @Input() loading: boolean = false;

  constructor(private sanitizer: DomSanitizer) {}

  @Output() sync = new EventEmitter<PlatformConnection>();
  @Output() disconnect = new EventEmitter<PlatformConnection>();
  @Output() refreshLocations = new EventEmitter<PlatformConnection>();

  /** Track profile picture load errors so we can show platform icon instead */
  profilePictureError: Set<string> = new Set();

  platformIcons: Record<string, string> = {
    'instagram': 'fab fa-instagram',
    'facebook': 'fab fa-facebook-f',
    'youtube': 'fab fa-youtube',
    'google': 'fab fa-google',
    'linkedin': 'fab fa-linkedin',
    'whatsapp': 'fab fa-whatsapp'
  };

  platformColors: Record<string, { bg: string, text: string, border: string }> = {
    'instagram': { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', text: 'text-white', border: 'border-purple-500' },
    'facebook': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-600' },
    'youtube': { bg: 'bg-red-600', text: 'text-white', border: 'border-red-600' },
    'google': { bg: 'bg-gradient-to-r from-blue-500 to-green-500', text: 'text-white', border: 'border-blue-500' },
    'linkedin': { bg: 'bg-blue-700', text: 'text-white', border: 'border-blue-700' },
    'whatsapp': { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' }
  };

  getPlatformIcon(platform: string): string {
    return this.platformIcons[platform] || 'fas fa-link';
  }

  getPlatformColors(platform: string) {
    return this.platformColors[platform] || { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-500' };
  }

  getPlatformLabel(platform: string): string {
    const labels: Record<string, string> = {
      'instagram': 'Instagram',
      'facebook': 'Facebook',
      'youtube': 'YouTube',
      'google': 'Google Business',
      'linkedin': 'LinkedIn',
      'whatsapp': 'WhatsApp'
    };
    return labels[platform] || platform;
  }

  getAccountName(connection: PlatformConnection): string {
    return connection.platformDisplayName ||
           connection.platformUsername ||
           connection.platformEmail ||
           'Connected Account';
  }

  /** Profile picture URL (root or metadata); null if none (use platform icon). */
  getProfilePictureUrl(connection: PlatformConnection): string | null {
    return connection.platformProfilePicture
      || connection.metadata?.profilePicture
      || null;
  }

  /** Safe URL for img [src] so Angular does not block external CDN (e.g. fbcdn.net). */
  getProfilePictureSafeUrl(connection: PlatformConnection): SafeUrl | null {
    const url = this.getProfilePictureUrl(connection);
    return url ? this.sanitizer.bypassSecurityTrustUrl(url) : null;
  }

  showProfilePicture(connection: PlatformConnection): boolean {
    const url = this.getProfilePictureUrl(connection);
    return !!url && !this.profilePictureError.has(connection._id);
  }

  onProfilePictureError(connection: PlatformConnection): void {
    this.profilePictureError.add(connection._id);
  }

  getStatusBadge(status: string): { class: string, label: string, icon: string } {
    switch (status) {
      case 'connected':
        return {
          class:
            'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
          label: 'Connected',
          icon: 'fa-check-circle'
        };
      case 'error':
        return {
          class:
            'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/45 dark:text-red-300 dark:border-red-800',
          label: 'Error',
          icon: 'fa-exclamation-circle'
        };
      case 'token_expired':
        return {
          class:
            'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700',
          label: 'Token Expired',
          icon: 'fa-clock'
        };
      case 'disconnected':
        return {
          class:
            'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/80 dark:text-gray-200 dark:border-gray-600',
          label: 'Disconnected',
          icon: 'fa-times-circle'
        };
      default:
        return {
          class:
            'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/80 dark:text-gray-200 dark:border-gray-600',
          label: status,
          icon: 'fa-circle'
        };
    }
  }

  formatLastSync(date?: Date): string {
    if (!date) return 'Never';
    
    const now = new Date();
    const syncDate = new Date(date);
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return syncDate.toLocaleDateString();
  }

  onSync(connection: PlatformConnection, event: Event): void {
    event.stopPropagation();
    this.sync.emit(connection);
  }

  onDisconnect(connection: PlatformConnection, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to disconnect ${this.getAccountName(connection)}? This will stop syncing data from this account.`)) {
      this.disconnect.emit(connection);
    }
  }

  /**
   * Check if connection needs location setup (Google with no locations)
   */
  needsLocationSetup(connection: PlatformConnection): boolean {
    return connection.platform === 'google' && 
           (!connection.platformData?.locationIds || 
            connection.platformData?.locationIds?.length === 0);
  }

  /**
   * Handle refresh locations button click
   */
  onRefreshLocations(connection: PlatformConnection, event: Event): void {
    event.stopPropagation();
    this.refreshLocations.emit(connection);
  }

  /**
   * Get warning message for connections needing setup
   */
  getSetupWarning(connection: PlatformConnection): string {
    if (this.needsLocationSetup(connection)) {
      return 'No business locations found. Click "Setup Locations" to add your business.';
    }
    return '';
  }
}
