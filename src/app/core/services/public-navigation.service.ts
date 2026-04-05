import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { timer } from 'rxjs';
import { take } from 'rxjs/operators';

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
      timer(120)
        .pipe(take(1))
        .subscribe(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
  }

  goToUseCasesTab(tab: HomeUseCaseTab): void {
    this.router.navigate(['/'], { queryParams: { uc: tab }, fragment: 'use-cases' }).then(() => {
      timer(120)
        .pipe(take(1))
        .subscribe(() => {
          document.getElementById('use-cases')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
  }
}
