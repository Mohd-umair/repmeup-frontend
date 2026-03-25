import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/** Legacy `/app/publish/published` → `/app/content?view=published` */
@Component({
  selector: 'app-publish-published-redirect',
  standalone: true,
  template: ''
})
export class PublishPublishedRedirectComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    void this.router.navigate(['/app/content'], {
      replaceUrl: true,
      queryParams: { view: 'published' }
    });
  }
}
