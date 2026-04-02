import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppearanceService } from '../../../core/services/appearance.service';
import { HomeUseCaseTab, PublicNavigationService } from '../../../core/services/public-navigation.service';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './public-footer.component.html',
  styleUrls: ['./public-footer.component.scss'],
})
export class PublicFooterComponent {
  constructor(
    public appearance: AppearanceService,
    private publicNav: PublicNavigationService
  ) {}

  goSection(id: string): void {
    this.publicNav.goToHomeSection(id);
  }

  goUseCase(tab: HomeUseCaseTab): void {
    this.publicNav.goToUseCasesTab(tab);
  }
}
