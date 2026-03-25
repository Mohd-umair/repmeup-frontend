import { Component } from '@angular/core';
import { AppearanceService } from '../../../core/services/appearance.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss']
})
export class ThemeToggleComponent {
  constructor(public theme: AppearanceService) {}
}
