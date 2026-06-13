import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SOCIAL_LINKS } from '../../../core/constants/social-links.constants';
import { AppearanceService } from '../../../core/services/appearance.service';
import { AiChatBubbleIconComponent } from '../ai-chat-bubble-icon/ai-chat-bubble-icon.component';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AiChatBubbleIconComponent],
  templateUrl: './public-footer.component.html',
  styleUrls: ['./public-footer.component.scss'],
})
export class PublicFooterComponent {
  readonly currentYear = new Date().getFullYear();
  readonly supportEmail = 'info@repmeup.in';
  readonly socialLinks = SOCIAL_LINKS;
  newsletterEmail = '';

  constructor(public appearance: AppearanceService) {}

  submitNewsletter(event: Event): void {
    event.preventDefault();
    const email = this.newsletterEmail.trim();
    if (!email) {
      return;
    }
    const subject = encodeURIComponent('RepMeUp newsletter signup');
    const body = encodeURIComponent(`Please add this email to your newsletter list:\n\n${email}`);
    window.location.href = `mailto:${this.supportEmail}?subject=${subject}&body=${body}`;
  }
}
