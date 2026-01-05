import { Component } from '@angular/core';

/**
 * Settings Component - Single Responsibility Principle
 * Manages application settings and platform connections
 */

interface Platform {
  id: string;
  name: string;
  icon: string;
  brandColor: string;
  gradientFrom: string;
  gradientTo: string;
  description: string;
  connected: boolean;
  connectedAccount?: string;
  lastSync?: string;
  dataPoints?: number;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  activeTab = 'platforms';

  platforms: Platform[] = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: 'fab fa-instagram',
      brandColor: '#E4405F',
      gradientFrom: '#833AB4',
      gradientTo: '#FD1D1D',
      description: 'Connect your Instagram Business account to manage comments and DMs',
      connected: false
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: 'fab fa-facebook',
      brandColor: '#1877F2',
      gradientFrom: '#1877F2',
      gradientTo: '#0C63D4',
      description: 'Manage Facebook page comments, reviews, and messages',
      connected: false
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: 'fab fa-youtube',
      brandColor: '#FF0000',
      gradientFrom: '#FF0000',
      gradientTo: '#CC0000',
      description: 'Monitor and respond to YouTube video comments',
      connected: false
    },
    {
      id: 'google',
      name: 'Google Business',
      icon: 'fab fa-google',
      brandColor: '#4285F4',
      gradientFrom: '#4285F4',
      gradientTo: '#34A853',
      description: 'Manage Google Business Profile reviews and Q&A',
      connected: false
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      icon: 'fab fa-whatsapp',
      brandColor: '#25D366',
      gradientFrom: '#25D366',
      gradientTo: '#128C7E',
      description: 'Handle WhatsApp Business API messages',
      connected: false
    },
    {
      id: 'twitter',
      name: 'Twitter (X)',
      icon: 'fab fa-twitter',
      brandColor: '#1DA1F2',
      gradientFrom: '#1DA1F2',
      gradientTo: '#0C85D0',
      description: 'Monitor mentions, replies, and direct messages',
      connected: false
    }
  ];

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  connectPlatform(platform: Platform): void {
    if (platform.connected) {
      // Disconnect logic
      if (confirm(`Are you sure you want to disconnect ${platform.name}?`)) {
        platform.connected = false;
        platform.connectedAccount = undefined;
        platform.lastSync = undefined;
        platform.dataPoints = undefined;
      }
    } else {
      // Connect logic - TODO: Implement OAuth flow
      console.log('Connecting to', platform.name);
      // Simulate connection for demo
      platform.connected = true;
      platform.connectedAccount = '@demo_account';
      platform.lastSync = 'Just now';
      platform.dataPoints = 0;
    }
  }

  getConnectedCount(): number {
    return this.platforms.filter(p => p.connected).length;
  }

  getPendingCount(): number {
    return this.platforms.filter(p => !p.connected).length;
  }
}
