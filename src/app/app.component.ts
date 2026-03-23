import { Component } from '@angular/core';
import { ClientActivityService } from './core/services/client-activity.service';

/**
 * App Component - Root component
 */
@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent {
  title = 'ORM System';

  /** Subscribes to router; injected for side effect only */
  constructor(_clientActivity: ClientActivityService) {}
}
