import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const contest_id = searchParams.get('contest_id');
  const competition_id = searchParams.get('competition_id');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    if (contest_id) {
      const { data: candidates, error } = await supabase.from('candidates').select('id,name,image_url,vote_count,category').eq('contest_id', contest_id).order('vote_count', { ascending: false });
      if (error) throw error;
      const totalVotes = candidates?.reduce((a, c) => a + (c.vote_count || 0), 0) || 0;
      return NextResponse.json({ candidates: candidates?.map((c,i) => ({ ...c, rank: i+1, percentage: totalVotes > 0 ? Math.round((c.vote_count/totalVotes)*100) : 0, isLeading: i===0 })) || [], totalVotes, updatedAt: new Date().toISOString() });
    }
    if (competition_id) {
      const { data: contests, error } = await supabase.from('contests').select('id,title,vote_price,is_active,candidates(id,name,image_url,vote_count)').eq('competition_id', competition_id).eq('is_active', true);
      if (error) throw error;
      return NextResponse.json({ contests: contests?.map(ct => { const sorted=[...(ct.candidates||[])].sort((a,b)=>b.vote_count-a.vote_count); const total=sorted.reduce((a,c)=>a+(c.vote_count||0),0); return {...ct,candidates:sorted.map((c,i)=>({...c,rank:i+1,percentage:total>0?Math.round((c.vote_count/total)*100):0})),totalVotes:total,leader:sorted[0]||null}; }) || [], updatedAt: new Date().toISOString() });
    }
    return NextResponse.json({ error: 'contest_id or competition_id required' }, { status: 400 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
