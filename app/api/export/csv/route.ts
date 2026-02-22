import { NextRequest, NextResponse } from 'next/server';
import { loadEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import { rankAthletes } from '@/lib/scoring';
import type { RankedAthlete } from '@/lib/scoring';

/**
 * GET /api/export/csv?key=…[&categoryId=…]
 *
 * Exports the scored leaderboard as a downloadable CSV file.
 * Protected by admin key.
 *
 * - Without categoryId: exports results for every category (one section per
 *   category, separated by a blank row).
 * - With categoryId: exports results for that single category.
 *
 * Columns: Rank, Bib, Name, Run 1, Run 2, Best Run, Score
 */
export async function GET(request: NextRequest) {
  /* ── Auth ─────────────────────────────────────────────────────────────── */
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  /* ── Load event ───────────────────────────────────────────────────────── */
  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  if (event.categories.length === 0) {
    return NextResponse.json(
      { error: 'No categories in event' },
      { status: 404 },
    );
  }

  /* ── Determine which categories to export ─────────────────────────────── */
  const categoryId = request.nextUrl.searchParams.get('categoryId');
  let categoriesToExport = event.categories;

  if (categoryId) {
    const cat = event.categories.find((c) => c.id === categoryId);
    if (!cat) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }
    categoriesToExport = [cat];
  }

  /* ── Build CSV ────────────────────────────────────────────────────────── */
  const lines: string[] = [];

  for (let ci = 0; ci < categoriesToExport.length; ci++) {
    const cat = categoriesToExport[ci];

    // Blank separator between categories
    if (ci > 0) lines.push('');

    // Category header
    lines.push(csvRow(['Category', cat.name]));

    // Column headers
    lines.push(csvRow(['Rank', 'Bib', 'Name', 'Run 1', 'Run 2', 'Best Run', 'Score']));

    // Ranked rows
    const ranked: RankedAthlete[] = rankAthletes(
      event.scores ?? [],
      [cat],
      cat.athletes,
    );

    for (const entry of ranked) {
      const detail = entry.categoryScores[0]; // single-category ranking
      const run1 = detail?.run1?.average;
      const run2 = detail?.run2?.average;
      const bestRun = detail?.bestRun;
      const score = entry.total;

      // Detect ties (same rank as another athlete)
      const isTied =
        entry.total !== null &&
        ranked.some(
          (other) =>
            other.athleteBib !== entry.athleteBib &&
            other.rank === entry.rank,
        );

      lines.push(
        csvRow([
          String(entry.rank) + (isTied ? 'T' : ''),
          String(entry.athleteBib),
          entry.athleteName,
          run1 !== null && run1 !== undefined ? run1.toFixed(2) : '',
          run2 !== null && run2 !== undefined ? run2.toFixed(2) : '',
          bestRun !== null && bestRun !== undefined ? `Run ${bestRun}` : '',
          score !== null && score !== undefined ? score.toFixed(2) : '',
        ]),
      );
    }
  }

  const csv = '\uFEFF' + lines.join('\r\n') + '\r\n'; // BOM for Excel compat

  /* ── Filename ─────────────────────────────────────────────────────────── */
  const safeName = event.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${safeName}_results_${date}.csv`;

  /* ── Response ─────────────────────────────────────────────────────────── */
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape a value for CSV: wrap in double-quotes if the value contains a comma,
 * double-quote, or newline. Double-quotes inside the value are doubled.
 */
function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** Build a single CSV row from an array of cell values. */
function csvRow(cells: string[]): string {
  return cells.map(csvEscape).join(',');
}
