import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PremiumSelectComponent, PremiumSelectOption } from '../../../shared/components/premium-select/premium-select.component';
import {
  ContactImportFieldMapping,
  ParsedContactCsv,
  columnOptions,
  isImportMappingValid,
  parseContactCsv,
  previewCell,
  suggestContactImportMapping
} from './contact-csv.util';

@Component({
  selector: 'app-contact-import-map',
  standalone: true,
  imports: [CommonModule, PremiumSelectComponent],
  templateUrl: './contact-import-map.component.html',
  styleUrl: './contact-import-map.component.scss'
})
export class ContactImportMapComponent implements OnChanges {
  @Input() open = false;
  @Input() fileName = '';
  @Input() csvText = '';
  @Input() importing = false;
  @Input() maxRows = 20000;

  @Output() closed = new EventEmitter<void>();
  @Output() confirmImport = new EventEmitter<ContactImportFieldMapping>();

  parsed: ParsedContactCsv = { headers: [], previewRows: [], totalRows: 0 };
  mapping: ContactImportFieldMapping = { name: '', phone: '', email: '' };
  parseError = '';

  readonly nameHint = 'Optional — used as the contact display name.';
  readonly phoneHint = 'Required if email is not mapped.';
  readonly emailHint = 'Required if phone is not mapped.';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['csvText'] || changes['open']) {
      if (this.open && this.csvText) this.loadCsv();
    }
  }

  get canImport(): boolean {
    return isImportMappingValid(this.mapping)
      && this.parsed.totalRows > 0
      && this.parsed.totalRows <= this.maxRows
      && !this.importing
      && !this.parseError;
  }

  get columnSelectOptions(): PremiumSelectOption[] {
    return columnOptions(this.parsed.headers);
  }

  get validationMessage(): string {
    if (this.parseError) return this.parseError;
    if (!this.parsed.headers.length) return 'No column headers found. Ensure the first row contains column names.';
    if (!this.parsed.totalRows) return 'No data rows found below the header row.';
    if (this.parsed.totalRows > this.maxRows) {
      return `This file has ${this.parsed.totalRows.toLocaleString()} rows. Maximum is ${this.maxRows.toLocaleString()} per import.`;
    }
    if (!isImportMappingValid(this.mapping)) {
      return 'Map at least Phone or Email to a CSV column.';
    }
    return '';
  }

  preview(col: string, row: string[]): string {
    return previewCell(row, this.parsed.headers, col);
  }

  onNameChange(v: string): void { this.mapping = { ...this.mapping, name: v || '' }; }
  onPhoneChange(v: string): void { this.mapping = { ...this.mapping, phone: v || '' }; }
  onEmailChange(v: string): void { this.mapping = { ...this.mapping, email: v || '' }; }

  applySuggestions(): void {
    this.mapping = suggestContactImportMapping(this.parsed.headers);
  }

  submit(): void {
    if (!this.canImport) return;
    this.confirmImport.emit({ ...this.mapping });
  }

  close(): void {
    if (this.importing) return;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  private loadCsv(): void {
    this.parseError = '';
    try {
      this.parsed = parseContactCsv(this.csvText);
      this.mapping = suggestContactImportMapping(this.parsed.headers);
      if (!this.parsed.headers.length) {
        this.parseError = 'Could not read column headers from this file.';
      }
    } catch {
      this.parseError = 'Could not parse this CSV file.';
      this.parsed = { headers: [], previewRows: [], totalRows: 0 };
    }
  }
}
