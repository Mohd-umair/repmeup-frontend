import { Component } from '@angular/core';

@Component({
  selector: 'app-terms-conditions',
  standalone: false,
  templateUrl: './terms-conditions.component.html',
  styleUrls: ['./terms-conditions.component.scss']
})
export class TermsConditionsComponent {
  lastUpdated: string = 'January 6, 2026';
}
