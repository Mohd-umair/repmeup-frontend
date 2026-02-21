import { Component, Input, Output, EventEmitter, OnInit, OnChanges, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface MediaRequirements {
  platform: string;
  postType: string;
  image?: {
    maxSize: string;
    dimensions: string;
    formats: string;
    description: string;
  };
  video?: {
    maxSize: string;
    duration: string;
    formats: string;
    description: string;
  };
}

@Component({
  selector: 'app-media-upload-guide',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-upload-guide.component.html',
  styleUrls: ['./media-upload-guide.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class MediaUploadGuideComponent implements OnInit, OnChanges {
  @Input() selectedPlatforms: string[] = [];
  @Input() postType: 'post' | 'story' | 'reel' | 'short' = 'post';
  @Input() showModal: boolean = false;
  @Output() close = new EventEmitter<void>();

  requirements: { [key: string]: MediaRequirements } = {};
  loading: boolean = false;
  private hasLoaded: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Don't load on init - wait for modal to open
  }

  ngOnChanges(): void {
    // Only load when modal is opened and hasn't been loaded yet
    if (this.showModal && !this.hasLoaded) {
      this.loadRequirements();
    }
  }

  loadRequirements(): void {
    if (this.hasLoaded) {
      return; // Already loaded, use cached data
    }

    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/posts/media-requirements?postType=${this.postType}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.requirements = response.data;
            this.hasLoaded = true; // Mark as loaded
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading media requirements:', error);
          this.loading = false;
        }
      });
  }

  getFilteredRequirements(): MediaRequirements[] {
    if (this.selectedPlatforms.length === 0) {
      return Object.values(this.requirements);
    }
    
    return this.selectedPlatforms
      .map(platform => this.requirements[platform.toLowerCase()])
      .filter(req => req !== undefined);
  }

  getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      'facebook': 'fab fa-facebook',
      'instagram': 'fab fa-instagram',
      'linkedin': 'fab fa-linkedin'
    };
    return icons[platform.toLowerCase()] || 'fas fa-image';
  }

  getPlatformColor(platform: string): string {
    const colors: { [key: string]: string } = {
      'facebook': '#5B9FFE',
      'instagram': '#F77A9A',
      'linkedin': '#4A9FE5'
    };
    return colors[platform.toLowerCase()] || '#6B7280';
  }

  closeModal(): void {
    this.close.emit();
  }
}
