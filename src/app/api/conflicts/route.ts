import { NextRequest, NextResponse } from 'next/server';

const UCDP_BASE = 'https://ucdpapi.pcr.uu.se/api/gedevents/25.1';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '2023');
  const page = parseInt(searchParams.get('page') || '0');
  const pageSize = Math.min(parseInt(searchParams.get('pagesize') || '1000'), 1000);

  const url = `${UCDP_BASE}?pagesize=${pageSize}&page=${page}&StartDate=${year}-01-01&EndDate=${year}-12-31`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 } // Cache for 24h
    });

    if (!response.ok) {
      return NextResponse.json({ error: `UCDP API returned ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch from UCDP API' }, { status: 502 });
  }
}
