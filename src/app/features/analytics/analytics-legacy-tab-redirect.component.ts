import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

const ALLOWED = ['overview', 'platforms', 'trends', 'performance', 'reports'] as const;

/** Old URLs `/app/analytics/overview` → `/app/analytics?tab=overview` (single component instance) */
@Component({
  selector: 'app-analytics-legacy-tab-redirect',
  standalone: true,
  template: ''
})
export class AnalyticsLegacyTabRedirectComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const seg = this.route.snapshot.paramMap.get('legacyTab') || '';
    const tab = (ALLOWED as readonly string[]).includes(seg) ? seg : 'overview';
    void this.router.navigate(['/app/analytics'], {
      queryParams: { tab },
      replaceUrl: true
    });
  }
}
