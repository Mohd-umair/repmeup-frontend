/** Normalize filter query values to a string array (supports single value, CSV, or array). */
export function inboxFilterToArray<T extends string>(v: T | T[] | undefined | null): T[] {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) {
    return v.filter((x) => x != null && String(x).trim() !== '') as T[];
  }
  const s = String(v);
  if (s.includes(',')) {
    return s.split(',').map((x) => x.trim()).filter(Boolean) as T[];
  }
  return [s as T];
}

/** True if `item` is included in filter `v` (empty filter = no restriction). */
export function inboxFilterMatches<T extends string>(v: T | T[] | undefined | null, item: T): boolean {
  const arr = inboxFilterToArray(v);
  if (arr.length === 0) return true;
  return arr.includes(item);
}

/** Serialize for HttpParams / API (comma-separated). */
export function inboxFilterSerialize(v: string | string[] | undefined | null): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const joined = v.filter((x) => x != null && String(x).trim() !== '').join(',');
    return joined || undefined;
  }
  const s = String(v).trim();
  return s || undefined;
}

/** Intent bucket id on interaction (ObjectId string or populated sub-doc). */
export function interactionIntentBucketId(interaction: { intentBucket?: unknown }): string | null {
  const ib = interaction?.intentBucket;
  if (ib == null) return null;
  if (typeof ib === 'string') return ib;
  if (typeof ib === 'object' && ib !== null && '_id' in ib) {
    const id = (ib as { _id?: unknown })._id;
    if (id == null) return null;
    return String(id);
  }
  return null;
}

/**
 * Empty filter = no restriction. `none` = conversations with no bucket assigned.
 */
export function inboxIntentBucketMatches(
  filter: string | undefined | null,
  interaction: { intentBucket?: unknown }
): boolean {
  if (filter == null || filter === '') return true;
  const id = interactionIntentBucketId(interaction);
  if (filter === 'none') return id == null;
  return id === filter;
}
