import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PostCardComponent } from '../../shared/components/post-card/post-card.component';
import { SocialPreviewComponent } from '../publish/social-preview/social-preview.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

interface PlatformOption {
  id: string;
  name: string;
  icon: string;
}

interface VariantItem {
  content: string;
  imageUrl?: string;
}

@Component({
  selector: 'app-content-studio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PostCardComponent,
    SocialPreviewComponent,
    ButtonComponent
  ],
  templateUrl: './content-studio.component.html',
  styleUrls: ['./content-studio.component.scss']
})
export class ContentStudioComponent implements OnInit {
  topic = '';
  audience = '';
  intent: 'Awareness' | 'Offer' | 'Education' | '' = '';
  platforms: PlatformOption[] = [];
  selectedPlatformIds: string[] = [];
  includeTrend = false;
  includeImage = false;
  generating = false;
  variants: VariantItem[] = [];
  selectedVariantIndex = 0;
  editedContent: string = '';
  previewPlatform: PlatformOption | null = null;
  scheduleDate = '';
  scheduleTime = '';
  showScheduleModal = false;
  sendingToApproval = false;
  scheduling = false;
  aiCredits: any = null;

  intentOptions = [
    { value: 'Awareness', label: 'Awareness' },
    { value: 'Offer', label: 'Offer' },
    { value: 'Education', label: 'Education' }
  ];

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadPlatforms();
    this.loadCredits();
    this.route.queryParams.subscribe(q => {
      if (q['topic']) this.topic = q['topic'];
      if (q['trend']) this.includeTrend = true;
    });
  }

  loadPlatforms(): void {
    this.http.get<any>(`${environment.apiUrl}/platforms/connections`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const conns = res.data.filter((c: any) => c.status === 'connected');
          this.platforms = conns.map((c: any) => ({
            id: c.platform?.toLowerCase() || c.platform,
            name: c.platform === 'instagram' ? 'Instagram' : c.platform === 'facebook' ? 'Facebook' : c.platform === 'linkedin' ? 'LinkedIn' : c.platform,
            icon: c.platform === 'instagram' ? 'fab fa-instagram' : c.platform === 'facebook' ? 'fab fa-facebook' : c.platform === 'linkedin' ? 'fab fa-linkedin' : 'fas fa-share-alt'
          }));
          if (this.platforms.length && !this.previewPlatform) {
            this.previewPlatform = this.platforms[0];
          }
        }
      }
    });
  }

  loadCredits(): void {
    this.http.get<any>(`${environment.apiUrl}/users/ai-credits`).subscribe({
      next: (res) => {
        this.aiCredits = res.credits || null;
      }
    });
  }

  togglePlatform(id: string): void {
    const i = this.selectedPlatformIds.indexOf(id);
    if (i >= 0) {
      this.selectedPlatformIds = this.selectedPlatformIds.filter(p => p !== id);
    } else {
      this.selectedPlatformIds = [...this.selectedPlatformIds, id];
    }
  }

  generateVariants(): void {
    if (!this.topic.trim() || this.selectedPlatformIds.length === 0) return;
    this.generating = true;
    this.variants = [];
    this.http.post<{ success: boolean; data: { variants: VariantItem[] } }>(
      `${environment.apiUrl}/posts/generate-variants`,
      {
        topic: this.topic.trim(),
        platforms: this.selectedPlatformIds,
        count: 3,
        audience: this.audience.trim(),
        intent: this.intent || undefined,
        includeTrend: this.includeTrend,
        generateImage: this.includeImage
      }
    ).subscribe({
      next: (res) => {
        if (res.success && res.data?.variants) {
          this.variants = res.data.variants;
          this.selectedVariantIndex = 0;
          this.editedContent = this.variants[0]?.content || '';
        }
        this.generating = false;
        this.loadCredits();
      },
      error: () => {
        this.generating = false;
      }
    });
  }

  get selectedContent(): string {
    return this.editedContent || this.variants[this.selectedVariantIndex]?.content || '';
  }

  selectVariant(i: number): void {
    this.selectedVariantIndex = i;
    this.editedContent = this.variants[i]?.content || '';
  }

  openAddToCalendar(): void {
    this.showScheduleModal = true;
  }

  addToCalendar(): void {
    const content = this.selectedContent;
    const platform = this.selectedPlatformIds[0];
    const selectedVariant = this.variants[this.selectedVariantIndex];
    const mediaUrl = selectedVariant?.imageUrl;
    if (!content || !platform) return;
    const scheduledFor = this.scheduleDate && this.scheduleTime
      ? new Date(`${this.scheduleDate}T${this.scheduleTime}`).toISOString()
      : null;
    if (!scheduledFor) return;
    this.scheduling = true;
    const body: any = { platform, content, scheduledFor, postType: 'post' };
    if (mediaUrl) body.mediaUrl = mediaUrl;
    this.http.post<any>(`${environment.apiUrl}/posts/schedule`, body).subscribe({
      next: () => {
        this.showScheduleModal = false;
        this.scheduleDate = '';
        this.scheduleTime = '';
        this.scheduling = false;
      },
      error: () => {
        this.scheduling = false;
      }
    });
  }

  sendToApproval(): void {
    const content = this.selectedContent;
    const platform = this.selectedPlatformIds[0];
    const selectedVariant = this.variants[this.selectedVariantIndex];
    const mediaUrl = selectedVariant?.imageUrl;
    if (!content || !platform) return;
    this.sendingToApproval = true;
    const body: any = {
      platform,
      content,
      generatedBy: 'ai',
      originalContent: this.variants[this.selectedVariantIndex]?.content
    };
    if (mediaUrl) body.mediaUrl = mediaUrl;
    this.http.post<any>(`${environment.apiUrl}/posts/to-approval`, body).subscribe({
      next: () => {
        this.sendingToApproval = false;
      },
      error: () => {
        this.sendingToApproval = false;
      }
    });
  }

  getPreviewPlatform(): PlatformOption {
    return this.previewPlatform || this.platforms[0] || { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram' };
  }

  getSelectedVariantMedia(): { preview: string; type: 'image' }[] {
    const v = this.variants[this.selectedVariantIndex];
    if (!v?.imageUrl) return [];
    return [{ preview: v.imageUrl, type: 'image' }];
  }
}
