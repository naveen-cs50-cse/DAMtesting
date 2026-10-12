import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ThreatEntities } from './types';
import fs from 'fs';
import path from 'path';

export interface OcrResult {
  text: string;
  threatEntities: ThreatEntities;
  status: 'success' | 'empty' | 'failed';
  error?: string;
}

export function extractEntitiesFromText(text: string): ThreatEntities {
  if (!text) return {};

  // Indian phone numbers: +91 xxxxxxxxxx, 0xxxx xxxxxx, or 10-digit mobile starting with 6-9
  const phoneRegex = /(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}\b/g;
  const rawPhones = text.match(phoneRegex) || [];
  const phones = Array.from(new Set(rawPhones.map(p => p.replace(/[\-\s]/g, ''))));

  // URLs & domains
  const urlRegex = /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*|(?:[a-zA-Z0-9-]+\.)+(?:com|in|org|net|gov\.in|nic\.in|co\.in|apk|xyz|top|live)[^\s]*/gi;
  const rawUrls = text.match(urlRegex) || [];
  const urls = Array.from(new Set(rawUrls.map(u => u.trim())));

  // Indian DLT Sender IDs (e.g., CP-SBIINB, VM-POWER, BZ-VODAFN, AX-KVSIND)
  const senderIdRegex = /\b[A-Za-z]{2}-[A-Za-z0-9]{5,8}\b/g;
  const rawSenders = text.match(senderIdRegex) || [];
  const senderIds = Array.from(new Set(rawSenders.map(s => s.toUpperCase())));

  // Currency amounts (₹ 500, Rs. 1000, INR 5,000)
  const amountRegex = /(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{2})?\b/gi;
  const rawAmounts = text.match(amountRegex) || [];
  const amounts = Array.from(new Set(rawAmounts.map(a => a.trim())));

  return { phones, urls, senderIds, amounts };
}

export async function performOcr(
  base64DataUrl: string,
  mimeType: string,
  apiKey?: string
): Promise<OcrResult> {
  let key = apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || '';
  if (!key.startsWith('sk-')) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/^OPENAI_API_KEY=(.+)$/m);
        if (match && match[1]?.trim().startsWith('sk-')) {
          key = match[1].trim();
        }
      }
    } catch {
      // ignore
    }
  }

  if (!key) {
    return {
      text: '',
      threatEntities: {},
      status: 'failed',
      error: 'OpenAI API key not configured for OCR extraction.'
    };
  }

  try {
    const openai = createOpenAI({ apiKey: key });

    // Handle PDF or Images via GPT-4o-mini Vision
    const isImage = mimeType.startsWith('image/');
    if (!isImage) {
      // PDF text extraction can be added or handled as document
      return {
        text: '',
        threatEntities: {},
        status: 'empty',
        error: 'PDF OCR requires image conversion; upload screenshots for instant vision OCR.'
      };
    }

    const prompt = `You are a high-precision OCR and digital forensics engine for DAM (Defence Against Misinformation).
Analyze this uploaded screenshot (WhatsApp message, SMS, government circular, bank notice, or document).
Task:
1. Extract ALL visible text verbatim. Maintain line breaks and exact spelling, including phone numbers, URLs, reference codes, names, and dates.
2. If text is in Hindi or regional Indian language, transcribe accurately in its script.
3. If no readable text is present, return: NO_TEXT_FOUND.
Do NOT summarize or add editorial remarks. Return ONLY the transcribed text.`;

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: base64DataUrl }
          ]
        }
      ],
      temperature: 0.1
    });

    const trimmed = text.trim();
    if (!trimmed || trimmed.includes('NO_TEXT_FOUND')) {
      return {
        text: '',
        threatEntities: {},
        status: 'empty'
      };
    }

    const threatEntities = extractEntitiesFromText(trimmed);

    return {
      text: trimmed,
      threatEntities,
      status: 'success'
    };
  } catch (err: unknown) {
    console.error('OCR Error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to extract text from image.';
    return {
      text: '',
      threatEntities: {},
      status: 'failed',
      error: msg
    };
  }
}
