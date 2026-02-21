import { NextRequest, NextResponse } from 'next/server';
import { validateAdminKey, validateJudgeKey } from '@/lib/auth';

/**
 * GET /api/auth/validate?key=...&role=admin|judge
 * Internal endpoint used by middleware to validate keys.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  const role = request.nextUrl.searchParams.get('role');

  if (!key || !role) {
    return NextResponse.json({ error: 'Missing key or role' }, { status: 400 });
  }

  if (role === 'admin') {
    if (validateAdminKey(key)) {
      return NextResponse.json({ valid: true, role: 'admin' });
    }
    return NextResponse.json({ error: 'Invalid admin key' }, { status: 401 });
  }

  if (role === 'judge') {
    const judgeRole = validateJudgeKey(key);
    if (judgeRole) {
      return NextResponse.json({ valid: true, role: judgeRole });
    }
    return NextResponse.json({ error: 'Invalid judge key' }, { status: 401 });
  }

  return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
}
