import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbG5jdXN2aG15ZGl2dGpramN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MTE2MDgsImV4cCI6MjEwOTM4NzYwOH0.gsnxlDww-fUC4HG7R7VasXSaQvqkSsDhhmf16KUCLZY';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getFotmobBuildId() {
  const res = await fetch('https://www.fotmob.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    }
  });
  if (!res.ok) throw new Error(`FotMob home failed: ${res.status}`);
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('No __NEXT_DATA__ found');
  return JSON.parse(match[1]).buildId;
}

export async function syncStandings() {
  console.log('🔄 Fetching Algeria Ligue 1 standings from FotMob...');
  const buildId = await getFotmobBuildId();
  const leagueUrl = `https://www.fotmob.com/_next/data/${buildId}/leagues/516/overview/ligue-1.json`;
  const res = await fetch(leagueUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Ligue 1 overview failed: ${res.status}`);
  const data = await res.json();
  const rawTable = data.pageProps?.table?.[0]?.data?.table?.all || [];
  console.log(`📊 Found ${rawTable.length} teams in Ligue 1 table.`);

  if (rawTable.length === 0) {
    console.warn('⚠️ No teams found in table data.');
    return;
  }

  const formattedTable = rawTable.map((t, idx) => ({
    rank: t.idx || idx + 1,
    team: t.name || t.shortName || 'Team',
    team_name: t.name || t.shortName || 'Team',
    played: t.played ?? 0,
    p: t.played ?? 0,
    wins: t.wins ?? 0,
    draws: t.draws ?? 0,
    losses: t.losses ?? 0,
    scoresStr: t.scoresStr || '0-0',
    goal_diff: t.goalConDiff ?? 0,
    gd: t.goalConDiff != null ? (t.goalConDiff > 0 ? `+${t.goalConDiff}` : `${t.goalConDiff}`) : '0',
    points: t.pts ?? 0,
    pts: t.pts ?? 0,
  }));

  const leagueIds = [
    'f3470422-9d6c-496f-ba96-83187ffa7fce',
    'c9340359-5bb4-400d-aa5b-2a7d40bcac00'
  ];

  for (const lid of leagueIds) {
    // Delete existing to avoid primary key conflict if needed, or upsert
    await sb.from('zeta_league_standings').delete().eq('league_id', lid);
    const { error } = await sb.from('zeta_league_standings').insert({
      league_id: lid,
      standings: formattedTable,
    });

    if (error) {
      console.error(`❌ Error inserting standings for league ${lid}:`, error.message);
    } else {
      console.log(`✅ Saved ${formattedTable.length} teams to zeta_league_standings for league ${lid}!`);
    }
  }
}

if (process.argv[1].endsWith('sync_standings.mjs')) {
  syncStandings().catch(console.error);
}
