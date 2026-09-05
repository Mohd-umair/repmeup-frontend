import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IActivationCampaign, IFilterCondition, IFilterQuery } from '../../../core/models/contact.model';
import { ContactService } from '../../../core/services/contact.service';
import { PremiumSelectComponent, PremiumSelectOption } from '../premium-select/premium-select.component';

const BASE_FIELDS = [
  { key: 'platform', label: 'Platform', type: 'select', options: ['whatsapp', 'instagram', 'facebook', 'shopify'] },
  { key: 'lifecycle', label: 'Lifecycle', type: 'select', options: ['lead', 'engaged', 'qualified', 'customer', 'repeat_customer', 'vip', 'at_risk', 'churned'] },
  { key: 'sentiment', label: 'Sentiment', type: 'select', options: ['positive', 'neutral', 'negative'] },
  { key: 'intent', label: 'Intent', type: 'text' },
  { key: 'engagement', label: 'Engagement', type: 'select', options: ['highly_engaged', 'medium', 'low', 'inactive'] },
  { key: 'lastActivity', label: 'Last activity', type: 'select', options: ['today', 'last_7_days', 'last_30_days'] },
  { key: 'owner', label: 'Owner', type: 'text' },
  { key: 'tags', label: 'Tag', type: 'text' },
  { key: 'location', label: 'City', type: 'text' },
  { key: 'ltv', label: 'Lifetime value', type: 'number' },
  { key: 'orderCount', label: 'Order count', type: 'number' },
  { key: 'leadScore', label: 'Lead score', type: 'number' },
  { key: 'healthScore', label: 'Health score', type: 'number' },
  { key: 'churnRisk', label: 'Churn risk', type: 'select', options: ['low', 'medium', 'high'] },
  { key: 'campaign', label: 'Campaign activity', type: 'campaign' }
];

const OPS = [
  { key: 'eq', label: 'is' },
  { key: 'neq', label: 'is not' },
  { key: 'gt', label: '>' },
  { key: 'gte', label: '≥' },
  { key: 'lt', label: '<' },
  { key: 'lte', label: '≤' },
  { key: 'contains', label: 'contains' }
];

const CAMPAIGN_CONDS = [
  { key: 'sent', label: 'was sent' },
  { key: 'delivered', label: 'was delivered' },
  { key: 'read', label: 'was read' },
  { key: 'replied', label: 'replied' },
  { key: 'did_not_reply', label: 'did not reply' }
];

@Component({
  selector: 'app-filter-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, PremiumSelectComponent],
  templateUrl: './filter-builder.component.html'
})
export class FilterBuilderComponent implements OnInit {
  @Input() value: IFilterQuery = { logic: 'AND', conditions: [] };
  @Output() valueChange = new EventEmitter<IFilterQuery>();

  fields = [...BASE_FIELDS];
  readonly ops = OPS;
  readonly campaignConds = CAMPAIGN_CONDS;
  campaigns: IActivationCampaign[] = [];

  constructor(private contacts: ContactService) {}

  ngOnInit(): void {
    this.contacts.listCampaigns().subscribe({
      next: (res) => { this.campaigns = res.data || []; }
    });
    this.contacts.customFields().subscribe({
      next: (res) => {
        const extra = (res.data || []).map((f) => ({
          key: `custom.${f.key}`,
          label: f.label,
          type: f.type === 'number' || f.type === 'currency' ? 'number' : 'text'
        }));
        this.fields = [...BASE_FIELDS, ...extra];
      }
    });
  }

  add(): void {
    this.value.conditions = [...(this.value.conditions || []), { field: 'platform', operator: 'eq', value: 'whatsapp' }];
    this.emit();
  }

  remove(i: number): void {
    this.value.conditions = this.value.conditions.filter((_, idx) => idx !== i);
    this.emit();
  }

  setLogic(logic: 'AND' | 'OR'): void {
    this.value = { ...this.value, logic };
    this.emit();
  }

  onFieldChange(c: IFilterCondition): void {
    const meta = this.fieldMeta(c.field);
    if (c.field === 'campaign') {
      c.value = { campaignId: '', condition: 'replied' };
      c.operator = 'eq';
    } else if (meta.type === 'select' && meta.options?.length) {
      c.value = meta.options[0];
      c.operator = 'eq';
    } else if (meta.type === 'number') {
      c.value = 0;
      c.operator = 'gte';
    } else {
      c.value = '';
      const op = c.operator ?? '';
      if (!['eq', 'contains', 'exists', 'neq'].includes(op)) {
        c.operator = 'eq';
      }
    }
    this.emit();
  }

  campaignVal(c: IFilterCondition): { campaignId: string; condition: string } {
    if (!c.value || typeof c.value !== 'object') {
      c.value = { campaignId: '', condition: 'replied' };
    }
    return c.value as { campaignId: string; condition: string };
  }

  setCampaignValue(
    condition: IFilterCondition,
    key: 'campaignId' | 'condition',
    value: string
  ): void {
    const current = this.campaignVal(condition);
    condition.value = { ...current, [key]: value };
    this.emit();
  }

  emit(): void {
    this.valueChange.emit({ ...this.value, conditions: [...this.value.conditions] });
  }

  fieldMeta(key?: string) {
    return this.fields.find((f) => f.key === key) || this.fields[0];
  }

  fieldSelectOptions(): PremiumSelectOption[] {
    return this.fields.map((f) => ({ value: f.key, label: f.label }));
  }

  operatorSelectOptions(): PremiumSelectOption[] {
    return this.ops.map((o) => ({ value: o.key, label: o.label }));
  }

  valueSelectOptions(c: IFilterCondition): PremiumSelectOption[] {
    const opts = this.fieldMeta(c.field).options || [];
    return opts.map((opt) => ({ value: String(opt), label: String(opt) }));
  }

  campaignCondOptions(): PremiumSelectOption[] {
    return this.campaignConds.map((c) => ({ value: c.key, label: c.label }));
  }

  campaignOptions(): PremiumSelectOption[] {
    return this.campaigns.map((c) => ({ value: c._id, label: c.name }));
  }
}
