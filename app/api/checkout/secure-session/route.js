import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Check keys inside the handler so it doesn't crash the whole module
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    return NextResponse.json({ 
      message: "API is reachable", 
      received: body.event_id,
      key_status: !!process.env.SUPABASE_SERVICE_ROLE_KEY 
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
