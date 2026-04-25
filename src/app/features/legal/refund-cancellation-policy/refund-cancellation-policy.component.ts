import { Component } from '@angular/core';

@Component({
  selector: 'app-refund-cancellation-policy',
  standalone: false,
  templateUrl: './refund-cancellation-policy.component.html',
  styleUrls: ['./refund-cancellation-policy.component.scss'],
})
export class RefundCancellationPolicyComponent {
  readonly effectiveDate = '1 May 2026';
  readonly version = '2.0';
}
