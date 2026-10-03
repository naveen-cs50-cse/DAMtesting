import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const query = data.query;
    const tavilyKey = data.apiKey || process.env.TAVILY_API_KEY;

    if (!tavilyKey) {
      return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 400 });
    }

    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        search_depth: data.search_depth || 'advanced',
        include_answer: true,
        max_results: data.max_results || 5,
      }),
    });

    const result = await tavilyRes.json();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
