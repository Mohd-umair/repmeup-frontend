import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Platform {
  id: string;
  name: string;
  platformUsername?: string;
}

interface MediaFile {
  preview: string;
  type: 'image' | 'video' | 'audio' | 'file';
}

@Component({
  selector: 'app-social-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-preview.component.html',
  styleUrls: ['./social-preview.component.scss']
})
export class SocialPreviewComponent implements OnChanges {
  @Input() platform!: Platform;

  constructor(private sanitizer: DomSanitizer) {}
  @Input() content: string = '';
  @Input() mediaFiles: MediaFile[] = [];
  @Input() location: string = '';
  @Input() scheduledFor?: Date;

  // Preview states
  showFullText: boolean = false;
  truncatedText: string = '';
  hasMoreText: boolean = false;
  currentMediaIndex: number = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] || changes['platform']) {
      this.processTruncation();
    }
  }

  /**
   * Process text truncation based on platform
   */
  processTruncation(): void {
    if (!this.content) {
      this.truncatedText = '';
      this.hasMoreText = false;
      return;
    }

    const maxLength = this.getTruncationLength();
    
    if (this.content.length > maxLength) {
      // Find the last space before maxLength to avoid cutting words
      const lastSpace = this.content.lastIndexOf(' ', maxLength);
      const cutIndex = lastSpace > maxLength - 50 ? lastSpace : maxLength;
      this.truncatedText = this.content.substring(0, cutIndex).trim();
      this.hasMoreText = true;
    } else {
      this.truncatedText = this.content;
      this.hasMoreText = false;
    }
  }

  /**
   * Get truncation length based on platform
   */
  getTruncationLength(): number {
    switch (this.platform.id) {
      case 'facebook':
        return 400; // Facebook shows ~400 chars before "See more"
      case 'instagram':
        return 125; // Instagram shows ~125 chars in feed before "more"
      case 'linkedin':
        return 210; // LinkedIn shows ~210 chars before "...see more"
      case 'youtube':
        return 200; // Description preview (~2 lines in Studio-style UI)
      default:
        return 280;
    }
  }

  /**
   * Get display text
   */
  getDisplayText(): string {
    return this.showFullText ? this.content : this.truncatedText;
  }

  /**
   * Toggle see more/less
   */
  toggleSeeMore(): void {
    this.showFullText = !this.showFullText;
  }

  /**
   * Navigate carousel
   */
  prevMedia(): void {
    if (this.currentMediaIndex > 0) {
      this.currentMediaIndex--;
    }
  }

  nextMedia(): void {
    if (this.currentMediaIndex < this.mediaFiles.length - 1) {
      this.currentMediaIndex++;
    }
  }

  /**
   * Get current media
   */
  getCurrentMedia(): MediaFile | null {
    return this.mediaFiles[this.currentMediaIndex] || null;
  }

  /**
   * Check if media is carousel
   */
  isCarousel(): boolean {
    return this.mediaFiles.length > 1;
  }

  /**
   * Escape HTML entities to prevent XSS when content is bound to [innerHTML]
   */
  private escapeHtml(text: string): string {
    const map: { [k: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
  }

  /**
   * Format content with hashtags and mentions highlighted. Input is escaped first, then
   * only safe tags (span, br) are added, and the result is sanitized for [innerHTML].
   */
  formatContent(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    const escaped = this.escapeHtml(text);
    const withFormatting = escaped
      .replace(/(#\w+)/g, '<span class="hashtag">$1</span>')
      .replace(/(@\w+)/g, '<span class="mention">$1</span>')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(withFormatting);
  }

  /**
   * Get platform-specific engagement metrics (mock data for preview)
   */
  getMockEngagement() {
    return {
      likes: 0,
      comments: 0,
      shares: 0
    };
  }

  /**
   * Get current timestamp
   */
  getTimestamp(): string {
    return 'Just now';
  }

  /**
   * Get profile picture (placeholder)
   */
  getProfilePicture(): string {
    const name = this.platform.platformUsername || 'User';
    
    // Use different colors based on platform for more realistic look
    let bg = '0866FF'; // Facebook blue
    let color = 'fff';
    
    if (this.platform.id === 'instagram') {
      bg = 'E1306C'; // Instagram pink
      color = 'fff';
    } else if (this.platform.id === 'linkedin') {
      bg = '0A66C2'; // LinkedIn blue
      color = 'fff';
    } else if (this.platform.id === 'youtube') {
      bg = 'FF0000'; // YouTube red
      color = 'fff';
    }
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=${color}&size=128&bold=true`;
  }
}
