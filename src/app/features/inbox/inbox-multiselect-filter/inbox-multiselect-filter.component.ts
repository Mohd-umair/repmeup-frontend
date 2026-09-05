import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  PremiumMultiselectFilterComponent,
  PremiumMultiselectOption
} from '../../../shared/components/premium-multiselect-filter/premium-multiselect-filter.component';

export type InboxMultiselectOption = PremiumMultiselectOption;

/** Inbox alias — delegates to shared premium multiselect. */
@Component({
  selector: 'app-inbox-multiselect-filter',
  standalone: true,
  imports: [PremiumMultiselectFilterComponent],
  template: `
    <app-premium-multiselect-filter
      [label]="label"
      [options]="options"
      [selected]="selected"
      [placeholder]="placeholder"
      (selectedChange)="selectedChange.emit($event)" />
  `
})
export class InboxMultiselectFilterComponent {
  @Input() label = '';
  @Input() options: PremiumMultiselectOption[] = [];
  @Input() selected: string[] = [];
  @Input() placeholder = 'Any';
  @Output() selectedChange = new EventEmitter<string[]>();
}
