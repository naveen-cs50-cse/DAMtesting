import { NextRequest, NextResponse } from 'next/server';
import { performOcr } from '@/lib/investigation/ocr';
import {
  analyzePdfDocument,
  extractThreatEntitiesFromDocument,
  validateDocumentBytes
} from '@/lib/investigation/documentAnalysis';
import { createRequestLogger } from '@/lib/security/logger';

export const runtime = 'nodejs';

// Server-side storage outside client localStorage
const SERVER_FILE_STORAGE = new Map<string, {
  buffer: Buffer;
  type: string;
  name: string;
  size: number;
  uploadedAt: number;
}>();

// Cleanup entries older than 2 hours to avoid memory growth
function cleanupOldFiles() {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000;
  for (const [id, entry] of SERVER_FILE_STORAGE.entries()) {
    if (now - entry.uploadedAt > maxAge) {
      SERVER_FILE_STORAGE.delete(id);
    }
  }
}

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get('fileId');
  if (!fileId || !SERVER_FILE_STORAGE.has(fileId)) {
    return new NextResponse('File not found', { status: 404 });
  }

  const entry = SERVER_FILE_STORAGE.get(fileId)!;
  return new NextResponse(new Uint8Array(entry.buffer), {
    headers: {
      'Content-Type': entry.type,
      'Content-Disposition': `inline; filename="${entry.name}"`,
      'Content-Length': entry.buffer.length.toString(),
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    cleanupOldFiles();

    const logger = createRequestLogger(req);
    const contentType = req.headers.get('content-type') || '';
    let name = '';
    let type = '';
    let apiKey = '';
    let buffer: Buffer;

    if (contentType.includes('application/json')) {
      const data = await req.json();
      name = data.name || 'document';
      type = data.type || 'application/octet-stream';
      apiKey = data.apiKey || '';
      const base64 = data.base64 || '';
      const match = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        type = match[1];
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(base64, 'base64');
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
      }
      name = file.name;
      type = file.type;
      apiKey = (formData.get('apiKey') as string) || '';
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Send JSON or multipart/form-data.' }, { status: 400 });
    }

    logger.info('File upload received', { name, type, sizeBytes: buffer.length });

    // 1. Strict Byte and Signature Validation
    const byteValidation = validateDocumentBytes(buffer, name, type);
    if (!byteValidation.valid) {
      return NextResponse.json(
        { error: byteValidation.error || 'Invalid file bytes or unsupported document format.' },
        { status: 400 }
      );
    }

    const fileId = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    SERVER_FILE_STORAGE.set(fileId, {
      buffer,
      type: byteValidation.detectedType === 'pdf' ? 'application/pdf' : type,
      name,
      size: buffer.length,
      uploadedAt: Date.now()
    });

    // 2. PDF Document Analysis Pipeline
    if (byteValidation.isPdf) {
      const documentAnalysis = await analyzePdfDocument(buffer, name, apiKey);

      // Safe failure states
      if (documentAnalysis.status === 'encrypted') {
        return NextResponse.json({
          success: false,
          error: documentAnalysis.error,
          status: 'encrypted',
          file: {
            id: fileId,
            name,
            type: 'application/pdf',
            size: buffer.length,
            previewUrl: null,
            ocrStatus: 'failed',
            documentAnalysis
          }
        }, { status: 422 });
      }

      if (documentAnalysis.status === 'corrupted') {
        return NextResponse.json({
          success: false,
          error: documentAnalysis.error,
          status: 'corrupted',
          file: {
            id: fileId,
            name,
            type: 'application/pdf',
            size: buffer.length,
            previewUrl: null,
            ocrStatus: 'failed',
            documentAnalysis
          }
        }, { status: 400 });
      }

      if (documentAnalysis.status === 'oversized') {
        return NextResponse.json({
          success: false,
          error: documentAnalysis.error,
          status: 'oversized',
          file: {
            id: fileId,
            name,
            type: 'application/pdf',
            size: buffer.length,
            previewUrl: null,
            ocrStatus: 'failed',
            documentAnalysis
          }
        }, { status: 400 });
      }

      const threatEntities = extractThreatEntitiesFromDocument(documentAnalysis);
      const extractedTextSummary = documentAnalysis.pageFindings
        .map(p => `[Page ${p.pageNumber}]\n${p.extractedSnippet}`)
        .join('\n\n');

      return NextResponse.json({
        success: true,
        file: {
          id: fileId,
          name: name || 'document.pdf',
          type: 'application/pdf',
          size: buffer.length,
          previewUrl: `/api/upload?fileId=${fileId}`,
          extractedText: extractedTextSummary,
          ocrStatus: documentAnalysis.status === 'success' ? 'success' : 'failed',
          threatEntities,
          documentAnalysis,
          uploadedAt: new Date().toISOString()
        }
      });
    }

    // 3. Image OCR Pipeline
    const base64Data = `data:${type};base64,${buffer.toString('base64')}`;
    const ocrResult = await performOcr(base64Data, type, apiKey);

    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        name: name || 'attachment',
        type: type,
        size: buffer.length,
        // Only return lightweight server URL, preventing multi-MB base64 in conversation state
        previewUrl: `/api/upload?fileId=${fileId}`,
        extractedText: ocrResult.text || null,
        ocrStatus: ocrResult.status,
        threatEntities: ocrResult.threatEntities,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
