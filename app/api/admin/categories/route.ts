import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { loadEvent, updateEvent } from '@/lib/store';
import { validateAdminKey } from '@/lib/auth';
import { DEFAULT_LIVE_STATE } from '@/lib/types';
import type { Category } from '@/lib/types';

/**
 * GET /api/admin/categories?key=...
 * List all categories for the current event.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  return NextResponse.json({ categories: event.categories ?? [] });
}

/**
 * POST /api/admin/categories?key=...
 * Add a new category. Body: { name: string }
 */
export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
  }

  // Check for duplicate name
  const categories = event.categories ?? [];
  if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
  }

  const newCategory: Category = {
    id: crypto.randomUUID(),
    name,
    athletes: [],
  };

  const updated = updateEvent({
    categories: [...categories, newCategory],
  });

  return NextResponse.json(
    { category: newCategory, categories: updated.categories },
    { status: 201 }
  );
}

/**
 * DELETE /api/admin/categories?key=...&id=...
 * Remove a category by ID.
 */
export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  const categoryId = request.nextUrl.searchParams.get('id');
  if (!categoryId) {
    return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
  }

  const categories = event.categories ?? [];
  const filtered = categories.filter((c) => c.id !== categoryId);

  if (filtered.length === categories.length) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // If the deleted category is the active live category, reset live state
  const patchData: { categories: Category[]; liveState?: typeof event.liveState } = { categories: filtered };
  if (event.liveState?.activeCategoryId === categoryId) {
    patchData.liveState = {
      ...event.liveState,
      ...DEFAULT_LIVE_STATE,
      activeCategoryId: null,
    };
  }

  const updated = updateEvent(patchData);
  return NextResponse.json({ categories: updated.categories });
}

/**
 * PUT /api/admin/categories?key=...
 * Update an existing category. Body: { id: string, name?: string }
 */
export async function PUT(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!validateAdminKey(key)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = loadEvent();
  if (!event) {
    return NextResponse.json({ error: 'No event found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) {
    return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
  }

  const categories = event.categories ?? [];
  const idx = categories.findIndex((c) => c.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const existing = categories[idx];
  const name = typeof body?.name === 'string' ? body.name.trim() : existing.name;

  if (!name) {
    return NextResponse.json({ error: 'Category name cannot be empty' }, { status: 400 });
  }

  // Check duplicate name (excluding self)
  if (categories.some((c, i) => i !== idx && c.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
  }

  const updatedCategories = [...categories];
  updatedCategories[idx] = { id, name, athletes: existing.athletes ?? [] };

  const updated = updateEvent({ categories: updatedCategories });
  return NextResponse.json({ category: updatedCategories[idx], categories: updated.categories });
}
