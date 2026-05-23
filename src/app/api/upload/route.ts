import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStaffSession } from '@/lib/staff-auth';
import { uploadLimiter, ipFromHeaders } from '@/lib/ratelimit';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { success } = await uploadLimiter.limit(`${session.id}:${ipFromHeaders(req.headers)}`);
  if (!success) return NextResponse.json({ error: 'Too many uploads. Wait a minute.' }, { status: 429 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Image type not allowed (use JPG, PNG, WebP, or AVIF)' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Max file size is 5 MB' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  // Sanitize extension from the content type, not the user-supplied filename.
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
  };
  const ext = extMap[file.type] ?? 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from('images')
    .upload(filename, bytes, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filename);
  return NextResponse.json({ url: publicUrl });
}
