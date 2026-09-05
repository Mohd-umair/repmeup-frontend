/** Parsed CSV ready for column mapping. */
export interface ParsedContactCsv {
  headers: string[];
  previewRows: string[][];
  totalRows: number;
}

export interface ContactImportFieldMapping {
  name: string;
  phone: string;
  email: string;
}

const SKIP = '';

/** RFC-4180-style CSV tokenizer (mirrors backend csvParser). */
export function parseContactCsv(text: string, previewLimit = 5): ParsedContactCsv {
  const rows = tokenizeCsv(text);
  if (!rows.length) return { headers: [], previewRows: [], totalRows: 0 };

  const rawHeader = rows.shift()!.map((h) => String(h || '').trim());
  const seen = new Map<string, number>();
  const headers = rawHeader.map((h) => {
    const base = h || 'column';
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}_${n}`;
  });

  const dataRows = rows.map((r) => {
    const a = r.slice(0, headers.length);
    while (a.length < headers.length) a.push('');
    return a.map((v) => String(v ?? ''));
  });

  return {
    headers,
    previewRows: dataRows.slice(0, previewLimit),
    totalRows: dataRows.length
  };
}

function tokenizeCsv(text: string): string[][] {
  if (!text?.length) return [];
  let src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { pushField(); continue; }
    if (ch === '\n') { pushField(); pushRow(); continue; }
    if (ch === '\r') {
      if (src[i + 1] !== '\n') { pushField(); pushRow(); }
      continue;
    }
    field += ch;
  }
  if (field.length || row.length) { pushField(); pushRow(); }

  while (rows.length) {
    const last = rows[rows.length - 1];
    if (last.every((c) => !String(c).trim())) rows.pop();
    else break;
  }
  return rows;
}

function normKey(s: string): string {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findCol(headers: string[], candidates: string[], exclude?: string): string {
  for (const c of candidates) {
    const hit = headers.find((h) => normKey(h) === c);
    if (hit && hit !== exclude) return hit;
  }
  return SKIP;
}

/** Pre-fill mapping dropdowns — user must confirm before import. */
export function suggestContactImportMapping(headers: string[]): ContactImportFieldMapping {
  const phone = findCol(headers, ['phone', 'mobile', 'whatsapp', 'whatsappnumber', 'number', 'phonenumber', 'msisdn', 'contact', 'cell'])
    || headers.find((h) => /phone|mobile|whatsapp|mob/i.test(h)) || SKIP;
  const email = findCol(headers, ['email', 'emailaddress', 'mail', 'emailid'], phone)
    || headers.find((h) => /email|mail/i.test(h) && h !== phone) || SKIP;
  const name = findCol(headers, ['name', 'firstname', 'fullname', 'customername', 'recipientname', 'displayname', 'contactname'], phone)
    || headers.find((h) => /name/i.test(h) && h !== phone) || SKIP;
  return { name, phone, email };
}

export function isImportMappingValid(mapping: ContactImportFieldMapping): boolean {
  return !!(mapping.phone?.trim() || mapping.email?.trim());
}

export function columnOptions(headers: string[], includeSkip = true): { value: string; label: string }[] {
  const opts = headers.map((h) => ({ value: h, label: h }));
  return includeSkip ? [{ value: SKIP, label: '— Do not import —' }, ...opts] : opts;
}

export function previewCell(row: string[], headers: string[], column: string): string {
  if (!column) return '—';
  const idx = headers.indexOf(column);
  if (idx < 0) return '—';
  const v = String(row[idx] ?? '').trim();
  return v || '—';
}
