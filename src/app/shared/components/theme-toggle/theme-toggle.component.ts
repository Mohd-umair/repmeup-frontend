import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppearanceService } from '../../../core/services/appearance.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss']
})
export class ThemeToggleComponent {
  /** `header` = compact icon in top bar; `fab` = fixed floating button (legacy). */
  @Input() variant: 'header' | 'fab' = 'header';

  constructor(public theme: AppearanceService) {}
}
