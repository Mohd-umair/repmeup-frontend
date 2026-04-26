import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Brand AI mark: navy chat bubble with “eyes” + rep-lime badge and white sparkle (product spec).
 * Replaces generic robot / wand icons anywhere AI is represented.
 */
@Component({
  selector: 'app-ai-chat-bubble-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [ngClass]="iconClass"
      class="inline-block shrink-0 align-middle"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      [attr.aria-hidden]="label ? null : true"
      [attr.role]="label ? 'img' : null"
      [attr.aria-label]="label || null">
      <!-- Main bubble + tail -->
      <path
        fill="#0D2C4D"
        d="M10.5 9.25c0-1.52 1.23-2.75 2.75-2.75h16.9c1.52 0 2.75 1.23 2.75 2.75v11.85c0 1.52-1.23 2.75-2.75 2.75h-6.35l-3.15 5.35a.85.85 0 0 1-1.47 0l-3.15-5.35h-2.93c-1.52 0-2.75-1.23-2.75-2.75V9.25Z" />
      <!-- Eyes -->
      <circle cx="16.35" cy="14.35" r="2.05" fill="#FFFFFF" />
      <circle cx="23.85" cy="14.35" r="2.05" fill="#FFFFFF" />
      <!-- Lime badge -->
      <circle cx="31.25" cy="9.4" r="6.75" class="fill-rep-lime" />
      <!-- White 4-point sparkle -->
      <path
        fill="#FFFFFF"
        d="m31.25 6.15 1.05 2.45h2.55l-2.05 1.5.75 2.45-2.3-1.65-2.3 1.65.75-2.45-2.05-1.5h2.55l1.05-2.45Z" />
    </svg>
  `,
})
export class AiChatBubbleIconComponent {
  /** Tailwind size utilities, e.g. <code>w-7 h-7</code> */
  @Input() iconClass = 'w-7 h-7';
  /** Optional accessible label when the graphic conveys meaning alone */
  @Input() label = '';
}
