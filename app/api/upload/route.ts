import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let name = '';
    let type = '';
    let size = 0;
    let base64 = '';

    if (contentType.includes('application/json')) {
      const data = await req.json();
      name = data.name;
      type = data.type;
      size = data.size;
      base64 = data.base64;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
      }
      name = file.name;
      type = file.type;
      size = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      base64 = `data:${type};base64,${buffer.toString('base64')}`;
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Send JSON or multipart/form-data.' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${type}. Allowed types: PNG, JPEG, WebP, PDF.` },
        { status: 400 }
      );
    }

    if (size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    const fileId = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    return NextResponse.json({
      success: true,
      file: {
        id: fileId,
        name: name || 'attachment',
        type: type,
        size: size,
        previewUrl: base64 ? base64.slice(0, 300) : null,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
