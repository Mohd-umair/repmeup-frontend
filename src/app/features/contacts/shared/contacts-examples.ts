import { IFilterQuery } from '../../../core/models/contact.model';

/** Example segment form — edit or submit as-is to learn the feature. */
export const EXAMPLE_SEGMENT = {
  name: 'WhatsApp VIP customers',
  filterQuery: {
    logic: 'AND' as const,
    conditions: [
      { field: 'platform', operator: 'eq', value: 'whatsapp' },
      { field: 'lifecycle', operator: 'eq', value: 'vip' }
    ]
  } satisfies IFilterQuery
};

/** Example custom field form — dropdown tier field. */
export const EXAMPLE_CUSTOM_FIELD = {
  label: 'Customer tier',
  key: 'customer_tier',
  type: 'dropdown' as const,
  options: 'Bronze, Silver, Gold, Platinum'
};

export function cloneExampleSegment() {
  return {
    name: EXAMPLE_SEGMENT.name,
    filterQuery: {
      logic: EXAMPLE_SEGMENT.filterQuery.logic,
      conditions: EXAMPLE_SEGMENT.filterQuery.conditions.map((c) => ({ ...c }))
    }
  };
}

export function cloneExampleCustomField() {
  return { ...EXAMPLE_CUSTOM_FIELD };
}
