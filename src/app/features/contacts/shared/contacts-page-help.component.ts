import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContactsHelpScenario, ContactsHelpSection } from './contacts-help.model';

@Component({
  selector: 'app-contacts-page-help',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contacts-page-help.component.html',
  styleUrl: './contacts-page-help.component.scss'
})
export class ContactsPageHelpComponent {
  @Input() open = false;
  @Input() title = 'Help';
  @Input() subtitle = '';
  @Input() sections: ContactsHelpSection[] = [];
  @Input() scenarios: ContactsHelpScenario[] = [];
  @Input() primaryActionLabel = '';
  @Output() closed = new EventEmitter<void>();
  @Output() primaryAction = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  onPrimary(): void {
    this.primaryAction.emit();
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }
}
