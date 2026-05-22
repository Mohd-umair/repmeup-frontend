import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  ICsvPreviewResponse,
  ICsvUploadMapping,
  ITemplateSlot,
  ITemplateSlots
} from '../../../../core/services/campaign.service';

/**
 * Maps CSV columns to template variable slots.
 *
 * Renders one dropdown per slot the user marked "from CSV" plus mandatory
 * phone / optional name pickers, and a live preview of the first sample rows
 * showing how the body text would look after substitution.
 */
@Component({
  selector: 'app-csv-column-mapper',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './csv-column-mapper.component.html'
})
export class CsvColumnMapperComponent implements OnChanges {
  @Input() preview: ICsvPreviewResponse | null = null;
  @Input() slots: ITemplateSlots | null = null;

  /** Slot keys the user has explicitly marked "fill from CSV" in Step 2. */
  @Input() varsFromCsv: string[] = [];

  /** Pre-loaded values when resuming an edit. */
  @Input() initialMapping: ICsvUploadMapping | null = null;

  /** Default param values (from Step 2 — used in preview when the slot is NOT from CSV). */
  @Input() defaultParams: Record<string, string> = {};

  @Output() mappingChange = new EventEmitter<ICsvUploadMapping>();

  // ── State ───────────────────────────────────────────────────────────────
  phoneColumn = '';
  nameColumn = '';
  slotColumns: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preview'] || changes['slots'] || changes['varsFromCsv'] || changes['initialMapping']) {
      this.applyDefaults();
    }
  }

  private applyDefaults(): void {
    if (!this.preview) return;
    const sug = this.preview.suggestedMapping || { phoneColumn: null, nameColumn: null, slots: {} };
    const initial: ICsvUploadMapping = this.initialMapping || { phoneColumn: '' };

    this.phoneColumn = initial.phoneColumn || sug.phoneColumn || '';
    this.nameColumn = initial.nameColumn || sug.nameColumn || '';

    const next: Record<string, string> = {};
    for (const key of this.varsFromCsv) {
      const fromInitial = initial.slots?.[key];
      const fromSuggested = sug.slots?.[key];
      next[key] = fromInitial || fromSuggested || '';
    }
    this.slotColumns = next;
    this.emit();
  }

  get csvHeaders(): string[] {
    return this.preview?.headers || [];
  }

  get sampleRows(): string[][] {
    return (this.preview?.sampleRows || []).slice(0, 3);
  }

  /** Map column name → row-array index for fast lookup. */
  private get headerIndex(): Record<string, number> {
    const map: Record<string, number> = {};
    this.csvHeaders.forEach((h, i) => { map[h] = i; });
    return map;
  }

  /** All slots flattened (used for preview rendering). */
  get allSlots(): ITemplateSlot[] {
    if (!this.slots) return [];
    return [
      ...this.slots.header.textSlots,
      ...this.slots.body.slots,
      ...this.slots.buttons.flatMap(b => b.urlVars)
    ];
  }

  get csvSlots(): ITemplateSlot[] {
    return this.allSlots.filter(s => this.varsFromCsv.includes(s.key));
  }

  setPhoneColumn(value: string): void {
    this.phoneColumn = value;
    this.emit();
  }

  setNameColumn(value: string): void {
    this.nameColumn = value;
    this.emit();
  }

  setSlotColumn(slotKey: string, value: string): void {
    this.slotColumns[slotKey] = value;
    this.emit();
  }

  /** Build a preview value for a given slot, sample-row pair. */
  previewSlotValue(slotKey: string, row: string[]): string {
    const col = this.slotColumns[slotKey];
    if (col && this.headerIndex[col] !== undefined) {
      const v = row[this.headerIndex[col]];
      return v != null ? String(v) : '';
    }
    const def = this.defaultParams[slotKey];
    return def || '—';
  }

  /** Single-line body preview substituting body slots for the given row. */
  previewRowSummary(row: string[]): string {
    const parts: string[] = [];
    for (const slot of this.allSlots) {
      const v = this.previewSlotValue(slot.key, row);
      if (v && v !== '—') parts.push(`${slot.label} = ${v}`);
    }
    return parts.length ? parts.join(' · ') : '(no variables)';
  }

  /** Is the form ready (phone column chosen, all CSV slots mapped). */
  get isValid(): boolean {
    if (!this.phoneColumn || !this.csvHeaders.includes(this.phoneColumn)) return false;
    for (const slot of this.csvSlots) {
      if (!this.slotColumns[slot.key]) return false;
    }
    return true;
  }

  private emit(): void {
    this.mappingChange.emit({
      phoneColumn: this.phoneColumn,
      nameColumn: this.nameColumn || undefined,
      slots: { ...this.slotColumns }
    });
  }
}
