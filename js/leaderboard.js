// Bestenliste "Wer schießt die meiste Provision ab" – Supabase (Tabelle public.mofu_scores)
export const SUPABASE_URL = 'https://ihqcgjndnjxxgeqheoei.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_0YKvFqXx8JX_xGH6ZcloRg_1Lrb_Ngz';
const TABLE = 'mofu_scores';
let clientPromise = null;

function client() {
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm')
      .then(m => m.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))
      .catch(e => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

function isMissingTable(err) {
  if (!err) return false;
  const s = `${err.code || ''} ${err.message || ''} ${err.details || ''}`;
  return /PGRST205|42P01|does not exist|Could not find the table|schema cache/i.test(s);
}

export class LeaderboardError extends Error {
  constructor(kind, msg) { super(msg); this.kind = kind; }
}

export async function fetchTop(limit = 15) {
  let sb;
  try { sb = await client(); } catch (e) { throw new LeaderboardError('offline', 'Bestenliste gerade nicht erreichbar.'); }
  const { data, error } = await sb.from(TABLE)
    .select('name,provision_cents,hits,shots,created_at')
    .order('provision_cents', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) throw new LeaderboardError('missing', 'Bestenliste noch nicht eingerichtet.');
    throw new LeaderboardError('offline', 'Bestenliste gerade nicht erreichbar.');
  }
  return data || [];
}

export async function submitScore({ name, provisionCents, hits, shots }) {
  let sb;
  try { sb = await client(); } catch (e) { throw new LeaderboardError('offline', 'Bestenliste gerade nicht erreichbar.'); }
  const { error } = await sb.from(TABLE).insert({
    name: String(name).trim().slice(0, 16),
    provision_cents: Math.max(0, Math.round(provisionCents)),
    hits: Math.max(0, hits | 0),
    shots: Math.max(0, shots | 0),
  });
  if (error) {
    if (isMissingTable(error)) throw new LeaderboardError('missing', 'Bestenliste noch nicht eingerichtet.');
    throw new LeaderboardError('offline', 'Eintrag konnte nicht gespeichert werden.');
  }
  return true;
}
