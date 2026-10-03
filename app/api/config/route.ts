import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const openAI = process.env.OPENAI_API_KEY || '';
  const tavily = process.env.TAVILY_API_KEY || '';

  return NextResponse.json({
    hasOpenAI: !!openAI,
    hasTavily: !!tavily,
    maskedOpenAI: openAI ? openAI.slice(0, 10) + '...' + openAI.slice(-4) : '',
    maskedTavily: tavily ? tavily.slice(0, 12) + '...' + tavily.slice(-4) : '',
  });
}
