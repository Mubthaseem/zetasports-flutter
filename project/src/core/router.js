/**
 * ZetaSports Client-Side Routing & 404 Interception Engine
 */

function resolveRoute(pathname, search) {
  const params = new URLSearchParams(search || '');
  
  // 1. Link Gateway Query Route: /?links={matchId}
  if (params.has('links')) {
    return { view: 'links', matchId: params.get('links') };
  }

  // 2. Stream Player Query Route: /?stream={matchId}
  if (params.has('stream')) {
    return { view: 'stream', matchId: params.get('stream') };
  }

  // 3. Match Details Slug Route: /{slug}-{uuid}
  const matchIdRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
  const match = (pathname || '').match(matchIdRegex);
  if (match) {
    return { view: 'match', matchId: match[1] };
  }

  // 4. Default: Homepage Fixture List
  return { view: 'home', matchId: null };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveRoute };
}
