import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContactService } from '../../../core/services/contact.service';
import { PremiumSelectComponent, PremiumSelectOption } from '../../../shared/components/premium-select/premium-select.component';
import { ContactsPageHelpComponent } from '../shared/contacts-page-help.component';
import { CUSTOM_FIELDS_HELP } from '../shared/contacts-help-content';
import { cloneExampleCustomField } from '../shared/contacts-examples';
import { ICustomFieldDefinition } from '../../../core/models/contact.model';

@Component({
  selector: 'app-custom-fields',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PremiumSelectComponent, ContactsPageHelpComponent],
  templateUrl: './custom-fields.component.html',
  styleUrl: './custom-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomFieldsComponent implements OnInit {
  items: ICustomFieldDefinition[] = [];
  label = '';
  key = '';
  type: ICustomFieldDefinition['type'] = 'text';
  options = '';
  loading = false;
  creating = false;
  showHelp = false;
  showCreatePanel = true;

  readonly help = CUSTOM_FIELDS_HELP;
  readonly typeOptions: PremiumSelectOption[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'multiselect', label: 'Multi-select' },
    { value: 'boolean', label: 'Yes / No' },
    { value: 'currency', label: 'Currency' }
  ];

  constructor(private contacts: ContactService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.applyExampleForm();
    this.load();
  }

  applyExampleForm(): void {
    const ex = cloneExampleCustomField();
    this.label = ex.label;
    this.key = ex.key;
    this.type = ex.type;
    this.options = ex.options;
  }

  load(): void {
    this.loading = true;
    this.contacts.customFields().subscribe({
      next: (res) => { this.items = res.data || []; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  create(): void {
    if (!this.label.trim() || this.creating) return;
    this.creating = true;
    const key = this.key.trim() || this.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    this.contacts.createCustomField({
      label: this.label.trim(),
      key,
      type: this.type,
      options: this.options.split(',').map((s) => s.trim()).filter(Boolean)
    }).subscribe({
      next: () => {
        this.creating = false;
        this.applyExampleForm();
        this.load();
        this.cdr.markForCheck();
      },
      error: () => { this.creating = false; this.cdr.markForCheck(); }
    });
  }

  remove(field: ICustomFieldDefinition): void {
    this.contacts.deleteCustomField(field._id).subscribe({ next: () => this.load() });
  }

  openHelp(): void { this.showHelp = true; this.cdr.markForCheck(); }
  closeHelp(): void { this.showHelp = false; this.cdr.markForCheck(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeHelp(); }
}
