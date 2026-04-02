import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

export type HomeUseCaseTab = 'support' | 'social' | 'startup' | 'enterprise';

/**
 * Scroll / navigate to home page sections from the marketing header or footer
 * (works when the user is already on `/` or on another public route).
 */
@Injectable({ providedIn: 'root' })
export class PublicNavigationService {
  constructor(private router: Router) {}

  goToHomeSection(sectionId: string): void {
    this.router.navigate(['/'], { fragment: sectionId }).then(() => {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    });
  }

  goToUseCasesTab(tab: HomeUseCaseTab): void {
    this.router.navigate(['/'], { queryParams: { uc: tab }, fragment: 'use-cases' }).then(() => {
      setTimeout(() => {
        document.getElementById('use-cases')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    });
  }
}
