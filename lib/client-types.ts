/**
 * Shared client-side types.
 *
 * These mirror the API response shapes so that every client page can import
 * from one place instead of re-declaring interfaces locally.
 *
 * IMPORTANT: This file must not import server-only modules (fs, crypto, etc.)
 * so that it remains safe for 'use client' pages.
 */

// Re-export scoring result types that client pages need.
// These are already defined in lib/scoring.ts and are safe for the client.
export type {
  RunScoreResult,
  CategoryScoreDetail,
  RankedAthlete,
} from './scoring';

// ─── Category summary (returned by multiple admin endpoints) ─────────────────

export interface CategorySummary {
  id: string;
  name: string;
  athleteCount: number;
}

// ─── Simple athlete shape (used in client-side lists) ────────────────────────

export interface ClientAthlete {
  bib: number;
  name: string;
}

// ─── Shared table styles (used by results + judge pages) ─────────────────────

import type React from 'react';

export const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  textAlign: 'center',
  fontWeight: 700,
  color: '#374151',
};

export const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  textAlign: 'left',
};
