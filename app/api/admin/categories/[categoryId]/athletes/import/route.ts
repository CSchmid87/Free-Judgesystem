import { NextRequest, NextResponse } from 'next/server';
import { loadEvent, updateEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import type { Athlete, RouteContext } from '@/lib/types';

type ImportRouteContext = RouteContext<{ categoryId: string }>;

interface CsvError {
  line: number;
  message: string;
}

/**
 * Parse a CSV string of "bib,name" rows.
 * Returns parsed athletes and per-line errors.
 * Handles: BOM, \r\n, quoted fields, blank lines, header row detection.
 */
function parseCsv(raw: string): { athletes: { bib: number; name: string; _line: number }[]; errors: CsvError[] } {
  const athletes: { bib: number; name: string; _line: number }[] = [];
  const errors: CsvError[] = [];

  // Strip BOM
  const text = raw.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    // Skip blank lines
    if (!line) continue;

    // Skip header row (first non-blank line that looks like a header)
    if (i === 0 || (athletes.length === 0 && errors.length === 0)) {
      const lower = line.toLowerCase();
      if (lower.startsWith('bib') || lower.startsWith('startnummer') || lower.startsWith('#')) {
        continue;
      }
    }

    // Split on first comma only
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) {
      errors.push({ line: lineNum, message: 'Missing comma separator (expected: bib,name)' });
      continue;
    }

    const bibRaw = line.substring(0, commaIdx).trim().replace(/^"|"$/g, '');
    const nameRaw = line.substring(commaIdx + 1).trim().replace(/^"|"$/g, '');

    // Validate bib
    const bib = Number(bibRaw);
    if (!bibRaw || isNaN(bib)) {
      errors.push({ line: lineNum, message: `Invalid bib "${bibRaw}" — must be a number` });
      continue;
    }
    if (!Number.isInteger(bib) || bib <= 0) {
      errors.push({ line: lineNum, message: `Bib ${bibRaw} must be a positive integer` });
      continue;
    }

    // Validate name
    const name = nameRaw.trim();
    if (!name) {
      errors.push({ line: lineNum, message: `Empty name for bib ${bib}` });
      continue;
    }

    athletes.push({ bib, name, _line: lineNum });
  }

  return { athletes, errors };
}

/**
 * POST /api/admin/categories/[categoryId]/athletes/import?key=...
 * Import athletes from CSV (bib,name).
 * Body: { csv: string }
 *
 * Returns:
 *   - added: number of newly added athletes
 *   - skipped: bibs that already existed
 *   - errors: parse errors with line numbers
 *   - athletes: full updated list
 */
export async function POST(request: NextRequest, context: ImportRouteContext) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  const { categoryId } = await context.params;
  const categories = event.categories ?? [];
  const catIdx = categories.findIndex((c) => c.id === categoryId);
  if (catIdx === -1) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const body = await request.json();
  const csv = typeof body?.csv === 'string' ? body.csv : '';
  if (!csv.trim()) {
    return NextResponse.json({ error: 'CSV data is required' }, { status: 400 });
  }

  const { athletes: parsed, errors } = parseCsv(csv);

  // Check for duplicate bibs within the CSV itself
  const seenBibs = new Set<number>();
  const csvDupes: CsvError[] = [];
  const unique: Athlete[] = [];
  for (const a of parsed) {
    if (seenBibs.has(a.bib)) {
      csvDupes.push({ line: a._line, message: `Duplicate bib ${a.bib} within CSV (kept first occurrence)` });
    } else {
      seenBibs.add(a.bib);
      unique.push({ bib: a.bib, name: a.name });
    }
  }

  const existingAthletes = categories[catIdx].athletes ?? [];
  const existingBibs = new Set(existingAthletes.map((a) => a.bib));

  const added: Athlete[] = [];
  const skipped: number[] = [];

  for (const a of unique) {
    if (existingBibs.has(a.bib)) {
      skipped.push(a.bib);
    } else {
      added.push(a);
      existingBibs.add(a.bib);
    }
  }

  const allErrors = [...errors, ...csvDupes];

  if (added.length === 0 && allErrors.length === 0 && skipped.length === 0) {
    return NextResponse.json({ error: 'No valid data found in CSV' }, { status: 400 });
  }

  let updatedAthletes = existingAthletes;
  if (added.length > 0) {
    updatedAthletes = [...existingAthletes, ...added].sort((a, b) => a.bib - b.bib);
    const updatedCategories = [...categories];
    updatedCategories[catIdx] = { ...categories[catIdx], athletes: updatedAthletes };
    updateEvent({ categories: updatedCategories });
  }

  return NextResponse.json({
    added: added.length,
    skipped,
    errors: allErrors,
    athletes: updatedAthletes,
  });
}
