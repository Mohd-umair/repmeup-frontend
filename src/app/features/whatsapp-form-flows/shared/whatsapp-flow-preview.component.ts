import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Phone mockup of a WhatsApp form, driven by the same customization values the
 * backend turns into Meta Flow JSON. Colours here deliberately mirror WhatsApp's
 * own chat UI rather than the app theme — this is a preview of what the customer
 * sees inside WhatsApp, not a piece of app chrome.
 */
@Component({
  selector: 'app-whatsapp-flow-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whatsapp-flow-preview.component.html',
  styleUrls: ['./whatsapp-flow-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WhatsAppFlowPreviewComponent {
  @Input() headerText = '';
  @Input() ratingPrompt = '';
  @Input() commentPrompt = '';
  @Input() thankYouText = '';

  readonly stars = [1, 2, 3, 4, 5];

  selectedRating = 0;
  submitted = false;

  selectRating(star: number): void {
    this.selectedRating = star;
    this.submitted = false;
  }

  submit(): void {
    if (this.selectedRating > 0) this.submitted = true;
  }

  reset(): void {
    this.selectedRating = 0;
    this.submitted = false;
  }
}
