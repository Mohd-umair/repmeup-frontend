import { IFlowNode, IFlowNodeCatalogItem } from '../../../../core/models/flow-builder.model';

/** Deep-clone any JSON-serializable value. */
export function deepCloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deep-clone a config object for new nodes. */
export function cloneDefaultConfig(config: Record<string, unknown> = {}): Record<string, unknown> {
  return deepCloneValue(config);
}

/** Build initial node config from catalog item defaults (never overwrites existing keys). */
export function buildDefaultConfig(catalogItem?: IFlowNodeCatalogItem): Record<string, unknown> {
  if (!catalogItem) return {};

  const config: Record<string, unknown> = cloneDefaultConfig(catalogItem.defaultConfig || {});

  for (const field of catalogItem.configFields || []) {
    if (config[field.key] === undefined && field.default !== undefined) {
      config[field.key] = deepCloneValue(field.default);
    }
    if (config[field.key] === undefined) {
      config[field.key] = field.type === 'string[]' ? [] : field.type === 'number' ? 0 : '';
    }
  }

  return config;
}

/** Fill missing keys on an existing node without overwriting user values. */
export function ensureNodeConfigKeys(
  node: IFlowNode,
  catalogItem?: IFlowNodeCatalogItem
): void {
  if (!node.config) node.config = {};
  const defaults = buildDefaultConfig(catalogItem);
  for (const [key, value] of Object.entries(defaults)) {
    if (node.config[key] === undefined) {
      node.config[key] = deepCloneValue(value);
    }
  }
}

const KEYWORD_NODE_TYPES = new Set([
  'trigger.keyword',
  'trigger.ig_comment',
  'trigger.ig_story_reply',
  'condition.keyword_match'
]);

const KEYWORD_INHERITANCE: Record<string, string[]> = {
  'trigger.keyword': ['condition.keyword_match', 'condition.reply_contains'],
  'trigger.ig_comment': ['condition.keyword_match'],
  'trigger.ig_story_reply': ['condition.keyword_match'],
  'condition.keyword_match': ['condition.keyword_match']
};

function hasOnlyDefaultKeywords(node: IFlowNode, catalogItem?: IFlowNodeCatalogItem): boolean {
  const keywords = node.config?.['keywords'];
  if (!Array.isArray(keywords)) return true;
  const defaults = catalogItem?.defaultConfig?.['keywords'];
  if (!Array.isArray(defaults)) return keywords.length === 0;
  return JSON.stringify(keywords) === JSON.stringify(defaults);
}

function copyKeywordsToTarget(sourceKeywords: string[], target: IFlowNode, targetCatalog?: IFlowNodeCatalogItem): boolean {
  if (target.type === 'condition.reply_contains') {
    const current = String(target.config?.['text'] ?? '');
    const defaultText = String(targetCatalog?.defaultConfig?.['text'] ?? 'yes');
    if (current && current !== defaultText) return false;
    target.config!['text'] = sourceKeywords[0] || defaultText;
    return true;
  }
  if (!KEYWORD_NODE_TYPES.has(target.type)) return false;
  if (!hasOnlyDefaultKeywords(target, targetCatalog)) return false;
  target.config!['keywords'] = [...sourceKeywords];
  return true;
}

/** Copy keywords from source to target when target still has empty/default keywords. */
export function inheritConfigOnConnect(
  source: IFlowNode,
  target: IFlowNode,
  sourceCatalog?: IFlowNodeCatalogItem,
  targetCatalog?: IFlowNodeCatalogItem
): boolean {
  if (!source.config || !target.config) return false;

  const allowedTargets = KEYWORD_INHERITANCE[source.type];
  if (!allowedTargets?.includes(target.type)) return false;

  const sourceKeywords = source.config['keywords'];
  if (!Array.isArray(sourceKeywords) || !sourceKeywords.length) return false;

  return copyKeywordsToTarget(sourceKeywords, target, targetCatalog);
}

/** Serialize string[] for textarea display. */
export function formatStringArray(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map(String).join('\n');
}

/** Parse textarea input into string[]. */
export function parseStringArray(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Serialize json field for textarea. */
export function formatJsonField(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Parse json textarea — returns object/array or original string on failure. */
export function parseJsonField(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function getConfigFieldDef(
  catalogItem: IFlowNodeCatalogItem | undefined,
  key: string
) {
  return catalogItem?.configFields.find((f) => f.key === key);
}

const DURATION_FIELD_KEYS = new Set(['delaySec', 'timeoutSec', 'minSec', 'maxSec']);

export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export function isDurationField(key: string): boolean {
  return DURATION_FIELD_KEYS.has(key);
}

/** Pick the largest unit that divides the stored seconds evenly. */
export function inferDurationUnit(seconds: number): DurationUnit {
  const s = Math.max(0, Number(seconds) || 0);
  if (s === 0) return 'minutes';
  if (s % 86400 === 0) return 'days';
  if (s % 3600 === 0) return 'hours';
  if (s % 60 === 0) return 'minutes';
  return 'seconds';
}

export function secondsToAmount(seconds: number, unit: DurationUnit): number {
  const s = Math.max(0, Number(seconds) || 0);
  switch (unit) {
    case 'days':
      return s / 86400;
    case 'hours':
      return s / 3600;
    case 'minutes':
      return s / 60;
    default:
      return s;
  }
}

export function durationToSeconds(amount: number, unit: DurationUnit): number {
  const n = Math.max(0, Number(amount) || 0);
  switch (unit) {
    case 'days':
      return Math.round(n * 86400);
    case 'hours':
      return Math.round(n * 3600);
    case 'minutes':
      return Math.round(n * 60);
    default:
      return Math.round(n);
  }
}
