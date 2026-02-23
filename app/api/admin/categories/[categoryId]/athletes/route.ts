import { NextRequest, NextResponse } from 'next/server';
import { loadEvent, updateEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import type { RouteContext } from '@/lib/types';

type AthleteRouteContext = RouteContext<{ categoryId: string }>;

/**
 * GET /api/admin/categories/[categoryId]/athletes?key=...
 * List athletes for a category, sorted by bib ascending.
 */
export async function GET(request: NextRequest, context: AthleteRouteContext) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  const { categoryId } = await context.params;
  const category = (event.categories ?? []).find((c) => c.id === categoryId);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const athletes = [...(category.athletes ?? [])].sort((a, b) => a.bib - b.bib);
  return NextResponse.json({ athletes });
}

/**
 * POST /api/admin/categories/[categoryId]/athletes?key=...
 * Add an athlete. Body: { bib: number, name: string }
 * Enforces unique bib within the category.
 */
export async function POST(request: NextRequest, context: AthleteRouteContext) {
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
  const bib = typeof body?.bib === 'number' ? body.bib : -1;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!Number.isInteger(bib) || bib <= 0) {
    return NextResponse.json({ error: 'Bib must be a positive integer' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'Athlete name is required' }, { status: 400 });
  }

  const athletes = categories[catIdx].athletes ?? [];
  if (athletes.some((a) => a.bib === bib)) {
    return NextResponse.json(
      { error: `Bib ${bib} already exists in this category` },
      { status: 409 }
    );
  }

  const updatedAthletes = [...athletes, { bib, name }].sort((a, b) => a.bib - b.bib);
  const updatedCategories = [...categories];
  updatedCategories[catIdx] = { ...categories[catIdx], athletes: updatedAthletes };

  updateEvent({ categories: updatedCategories });
  return NextResponse.json({ athletes: updatedAthletes }, { status: 201 });
}

/**
 * DELETE /api/admin/categories/[categoryId]/athletes?key=...&bib=...
 * Remove an athlete by bib number.
 */
export async function DELETE(request: NextRequest, context: AthleteRouteContext) {
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

  const bibStr = request.nextUrl.searchParams.get('bib');
  const bib = bibStr ? Number(bibStr) : NaN;
  if (!Number.isInteger(bib) || bib <= 0) {
    return NextResponse.json({ error: 'Valid bib number is required' }, { status: 400 });
  }

  const athletes = categories[catIdx].athletes ?? [];
  const filtered = athletes.filter((a) => a.bib !== bib);
  if (filtered.length === athletes.length) {
    return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
  }

  const updatedCategories = [...categories];
  updatedCategories[catIdx] = { ...categories[catIdx], athletes: filtered };

  updateEvent({ categories: updatedCategories });
  return NextResponse.json({ athletes: filtered.sort((a, b) => a.bib - b.bib) });
}
