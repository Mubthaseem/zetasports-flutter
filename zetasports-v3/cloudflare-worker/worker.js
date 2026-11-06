            // ==============================================================================
            // ZetaSports v3: Unified 24/7 Cloudflare Worker Telemetry & Broadcast Engine
            // 24/7 Serverless Live Scores, 4-Day Sliding Window (-1 to +2), 10s Poller & Edge Vector Canvas
            // ==============================================================================

            const DEFAULT_SUPABASE_URL = 'https://udlncusvhmydivtjkjcy.supabase.co';
            const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_VXZvAq86GvVgqY-c23gwmQ_RtuTSlWF';

            const FOTMOB_HEADERS = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.fotmob.com/'
            };

            // Deterministic UUID generator matching Backend toUUID(str)
            function md5(string) {
              function rotateLeft(lValue, iShiftBits) {
                return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
              }
              function addUnsigned(lX, lY) {
                const lX8 = (lX & 0x80000000), lY8 = (lY & 0x80000000);
                const lX4 = (lX & 0x40000000), lY4 = (lY & 0x40000000);
                const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
                if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
                if (lX4 | lY4) {
                  if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
                  else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
                } else return (lResult ^ lX8 ^ lY8);
              }
              function F(x, y, z) { return (x & y) | ((~x) & z); }
              function G(x, y, z) { return (x & z) | (y & (~z)); }
              function H(x, y, z) { return (x ^ y ^ z); }
              function I(x, y, z) { return (y ^ (x | (~z))); }
              function FF(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
              }
              function GG(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
              }
              function HH(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
              }
              function II(a, b, c, d, x, s, ac) {
                a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
                return addUnsigned(rotateLeft(a, s), b);
              }
              function convertToWordArray(str) {
                let lWordCount;
                const lMessageLength = str.length;
                const lNumberOfWordsTempOne = lMessageLength + 8;
                const lNumberOfWordsTempTwo = (lNumberOfWordsTempOne - (lNumberOfWordsTempOne % 64)) / 64;
                const lNumberOfWords = (lNumberOfWordsTempTwo + 1) * 16;
                const lWordArray = Array(lNumberOfWords - 1);
                let lBytePosition = 0;
                let lByteCount = 0;
                while (lByteCount < lMessageLength) {
                  lWordCount = (lByteCount - (lByteCount % 4)) / 4;
                  lBytePosition = (lByteCount % 4) * 8;
                  lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
                  lByteCount++;
                }
                lWordCount = (lByteCount - (lByteCount % 4)) / 4;
                lBytePosition = (lByteCount % 4) * 8;
                lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
                lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
                lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
                return lWordArray;
              }
              function wordToHex(lValue) {
                let WordToHexValue = '', WordToHexValueTemp = '', lByte, lCount;
                for (lCount = 0; lCount <= 3; lCount++) {
                  lByte = (lValue >>> (lCount * 8)) & 255;
                  WordToHexValueTemp = '0' + lByte.toString(16);
                  WordToHexValue = WordToHexValue + WordToHexValueTemp.substr(WordToHexValueTemp.length - 2, 2);
                }
                return WordToHexValue;
              }
              const x = convertToWordArray(string);
              let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
              const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
              const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
              const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
              const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
              for (let k = 0; k < x.length; k += 16) {
                const AA = a, BB = b, CC = c, DD = d;
                a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
                d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
                c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
                b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
                a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
                d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
                c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
                b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
                a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
                d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
                c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
                b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
                a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
                d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
                c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
                b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
                a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
                d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
                c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
                b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
                a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
                d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
                c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
                b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
                a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
                d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
                c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
                b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
                a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
                d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
                c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
                b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
                a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
                d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
                c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
                b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
                a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
                d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
                c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
                b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
                a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
                d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
                c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
                b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
                a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
                d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
                c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
                b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
                a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
                d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
                c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
                b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
                a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
                d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
                c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
                b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
                a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
                d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
                c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
                b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
                a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
                d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
                c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
                b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
                a = addUnsigned(a, AA);
                b = addUnsigned(b, BB);
                c = addUnsigned(c, CC);
                d = addUnsigned(d, DD);
              }
              const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
              return temp.toLowerCase();
            }

            function toUUID(str) {
              const hash = md5(String(str));
              return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
            }

            function formatIST(isoString) {
              if (!isoString) return '';
              try {
                const d = new Date(isoString);
                return d.toLocaleTimeString('en-US', {
                  timeZone: 'Asia/Kolkata',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
              } catch (e) {
                return '';
              }
            }

            // ── 1. Telemetry Parser ───────────────────────────────────────────────────────
            function parseFotMobTelemetry(data) {
              const header = data.header || {};
              const statusObj = header.status || {};
              const teams = header.teams || [];

              let homeScore = 0;
              let awayScore = 0;

              if (teams.length >= 2) {
                homeScore = parseInt(teams[0].score, 10) || 0;
                awayScore = parseInt(teams[1].score, 10) || 0;
              } else if (statusObj.scoreStr) {
                const parts = statusObj.scoreStr.split('-').map(s => parseInt(s.trim(), 10));
                if (parts.length === 2 && !isNaN(parts[0])) {
                  homeScore = parts[0];
                  awayScore = parts[1];
                }
              }

              const isFinished = statusObj.finished === true;
              const isStarted = statusObj.started === true;
              const isCancelled = statusObj.cancelled === true;

              let status = 'scheduled';
              let timeElapsed = '';

              if (isFinished) {
                status = 'finished';
                timeElapsed = 'FT';
              } else if (isCancelled) {
                status = 'cancelled';
                timeElapsed = 'Cancelled';
              } else if (isStarted) {
                status = 'live';
                const liveTime = statusObj.liveTime || {};
                timeElapsed = liveTime.short || liveTime.long || 'LIVE';
                if (!timeElapsed || timeElapsed.includes('-')) {
                  timeElapsed = 'LIVE';
                }
              }

              // 1A. Goal Scorers & Match Events
              const goalScorers = [];
              const cards = [];
              const subs = [];

              const events = data.content?.matchFacts?.events?.events || [];
              events.forEach(e => {
                const min = e.time || e.minute || 0;
                const isHome = e.isHome !== undefined ? e.isHome : (e.team === 'home');
                const teamKey = isHome ? 'home' : 'away';

                if (e.type === 'Goal') {
                  const playerName = (
                    e.fullName ||
                    e.nameStr ||
                    (e.player && e.player.name) ||
                    (typeof e.player === 'string' ? e.player : '') ||
                    e.name ||
                    'Goal'
                  ).trim();

                  const assistName = (e.assistStr || (e.assist && e.assist.name) || '').trim();

                  goalScorers.push({
                    team: teamKey,
                    player: playerName,
                    minute: min,
                    assist: assistName,
                    own_goal: e.isOwnGoal || e.ownGoal || false,
                    penalty: e.isPenalty || e.penalty || false
                  });
                } else if (e.type === 'Card') {
                  const playerName = (
                    e.fullName ||
                    e.nameStr ||
                    (e.player && e.player.name) ||
                    (typeof e.player === 'string' ? e.player : '') ||
                    e.name ||
                    'Player'
                  ).trim();

                  cards.push({
                    team: teamKey,
                    player: playerName,
                    minute: min,
                    type: e.card === 'Red' ? 'red' : 'yellow'
                  });
                } else if (e.type === 'Substitution') {
                  const pIn = (e.playerIn && (e.playerIn.name || e.playerIn.nameStr)) || e.in || 'Sub In';
                  const pOut = (e.playerOut && (e.playerOut.name || e.playerOut.nameStr)) || e.out || 'Sub Out';

                  subs.push({
                    team: teamKey,
                    minute: min,
                    player_in: pIn,
                    player_out: pOut
                  });
                }
              });

              // 1B. Official Lineups & Tactical Pitch
              const lineupContent = data.content?.lineup || {};
              const homeTeamLineup = lineupContent.homeTeam || {};
              const awayTeamLineup = lineupContent.awayTeam || {};

              const homeFormation = homeTeamLineup.formation || '4-3-3';
              const awayFormation = awayTeamLineup.formation || '4-2-3-1';

              const parseStarters = (starters) => {
                if (!Array.isArray(starters)) return [];
                return starters.map(p => ({
                  id: p.id,
                  name: p.fullName || p.nameStr || p.name || 'Player',
                  short_name: p.lastName || (p.name ? p.name.split(' ').pop() : 'Player'),
                  number: parseInt(p.shirtNumber, 10) || 0,
                  position: p.positionId || p.usualPlayingPositionId || null,
                  rating: p.performance?.rating || p.rating || null,
                  x: p.verticalLayout?.x ?? null,
                  y: p.verticalLayout?.y ?? null
                }));
              };

              const parseSubsList = (subsArr) => {
                if (!Array.isArray(subsArr)) return [];
                return subsArr.map(p => ({
                  id: p.id,
                  name: p.fullName || p.nameStr || p.name || 'Player',
                  short_name: p.lastName || (p.name ? p.name.split(' ').pop() : 'Player'),
                  number: parseInt(p.shirtNumber, 10) || 0,
                  rating: p.performance?.rating || p.rating || null
                }));
              };

              const homeStarters = parseStarters(homeTeamLineup.starters);
              const awayStarters = parseStarters(awayTeamLineup.starters);
              const homeBench = parseSubsList(homeTeamLineup.subs);
              const awayBench = parseSubsList(awayTeamLineup.subs);

              const hasOfficialLineup = homeStarters.length > 0 || awayStarters.length > 0;
              const lineups = hasOfficialLineup ? {
                home: {
                  formation: homeFormation,
                  coach: homeTeamLineup.coach?.name || '',
                  starting: homeStarters,
                  bench: homeBench
                },
                away: {
                  formation: awayFormation,
                  coach: awayTeamLineup.coach?.name || '',
                  starting: awayStarters,
                  bench: awayBench
                }
              } : {};

              const formations = {
                home: homeFormation,
                away: awayFormation
              };

              // 1C. Match Statistics Normalizer
              const matchStats = {};
              const statsPeriod = data.content?.stats?.Periods?.All?.stats || [];
              statsPeriod.forEach(group => {
                (group.stats || []).forEach(item => {
                  const title = (item.title || '').toLowerCase().trim();
                  const vals = item.stats || [];
                  if (vals.length >= 2 && vals[0] != null) {
                    if (title.includes('possession')) matchStats.possession = vals;
                    else if (title.includes('total shots') || title === 'shots') matchStats.shots = vals;
                    else if (title.includes('shots on target')) matchStats.shots_on_target = vals;
                    else if (title.includes('corner')) matchStats.corners = vals;
                    else if (title.includes('foul')) matchStats.fouls = vals;
                    else if (title.includes('yellow card')) matchStats.yellow_cards = vals;
                    else if (title.includes('red card')) matchStats.red_cards = vals;
                    else if (title.includes('offside')) matchStats.offsides = vals;
                    else if (title.includes('expected goals') || title.includes('(xg)') || title === 'xg') {
                      matchStats.expected_goals = vals;
                      matchStats.xg = vals;
                    } else if (title === 'big chances') {
                      matchStats.big_chances = vals;
                      matchStats.bigChances = vals;
                    } else if (title.includes('accurate passes') || title === 'accurate passes') {
                      matchStats.accurate_passes = vals;
                      matchStats.pass_accuracy = vals;
                    }
                  }
                });
              });

              // Ingest FotMob live match momentum
              const momentumData = data.content?.momentum?.main?.data;
              if (Array.isArray(momentumData) && momentumData.length > 0) {
                matchStats.momentum = momentumData;
              }

              // 1D. Venue & Referee
              const infoBox = data.content?.matchFacts?.infoBox || {};
              const venueObj = infoBox['Stadium'] || infoBox['Venue'];
              const venue = venueObj ? (venueObj.name + (venueObj.city ? ', ' + venueObj.city : '')) : '';
              const refObj = infoBox['Referee'];
              const referee = refObj ? (refObj.text + (refObj.country ? ' (' + refObj.country + ')' : '')) : '';

              // 1E. H2H Encounters
              const h2hRaw = data.content?.h2h?.matches || [];
              const h2h = h2hRaw.filter(m => m.finished || m.status?.finished).slice(0, 5).map(m => ({
                date: (m.time?.utcTime || m.status?.utcTime || '').split('T')[0],
                home: m.home?.name || 'Home',
                away: m.away?.name || 'Away',
                score: m.status?.scoreStr || (m.home?.score !== undefined ? m.home.score + ' - ' + m.away.score : 'vs'),
                league: m.league?.name || ''
              }));

              return {
                homeScore,
                awayScore,
                status,
                timeElapsed,
                goalScorers,
                cards,
                subs,
                lineups,
                formations,
                matchStats,
                venue,
                referee,
                h2h
              };
            }

            // Extracts dynamic player rating and roster signature for delta cache
            function getLineupRatingSignature(lineups) {
              if (!lineups || (!lineups.home && !lineups.away)) return '';
              const extract = (arr) => {
                if (!Array.isArray(arr)) return '';
                return arr.map(p => `${p.id}:${p.rating != null ? p.rating : ''}`).join(';');
              };
              const hStart = extract(lineups.home?.starting);
              const aStart = extract(lineups.away?.starting);
              const hBench = extract(lineups.home?.bench);
              const aBench = extract(lineups.away?.bench);
              return `${hStart}|${aStart}|${hBench}|${aBench}`;
            }

            // In-memory signature cache for Delta-Only Ingestion (skips DB writes when telemetry is unchanged)
            const telemetrySignatureCache = new Map();

            // ── 2. Poll Active Live Matches ──────────────────────────────────────────────
            async function pollActiveMatches(env) {
              const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
              const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

              const sbHeaders = {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json'
              };

              // 1. Fetch approved leagues list from zeta_leagues
              let approvedLeagueNames = new Set();
              try {
                const lgRes = await fetch(`${sbUrl}/rest/v1/zeta_leagues?select=name,featured&featured=eq.true`, { headers: sbHeaders });
                if (lgRes.ok) {
                  const lgs = await lgRes.json();
                  approvedLeagueNames = new Set(lgs.map(l => (l.name || '').trim().toLowerCase()));
                  console.log(`[Worker] Loaded ${approvedLeagueNames.size} approved leagues from database.`);
                }
              } catch (err) {
                console.warn('[Worker] Could not fetch approved leagues, using fallback:', err.message);
              }

              // 2. Fetch candidate matches: status in live/in_play/scheduled with fotmob_id
              const getUrl = `${sbUrl}/rest/v1/zeta_matches?select=id,fotmob_id,home_team,away_team,home_score,away_score,status,time_elapsed,date,kickoff_ist,is_approved,league_name,article_url&fotmob_id=not.is.null&order=date.asc`;
              const res = await fetch(getUrl, { headers: sbHeaders });
              if (!res.ok) {
                throw new Error(`Supabase GET matches failed: ${res.status}`);
              }

              const allMatches = await res.json();
              const now = new Date();
              const candidates = [];

              for (const m of allMatches) {
                const st = String(m.status || '').toLowerCase();
                const isLiveOrInPlay = st === 'live' || st === 'in_play' || st === 'ht' || st === '1h' || st === '2h';
                const isPublished = Boolean(m.article_url);

                // PRIORITY 1: Any match that is currently live, in-play, or published to Blogger MUST be polled!
                if (isLiveOrInPlay || isPublished) {
                  candidates.push(m);
                  continue;
                }

                // PRIORITY 2: Check approved leagues for upcoming scheduled matches (-30 mins to +24 hours)
                const lgNorm = (m.league_name || '').trim().toLowerCase();
                const isApprovedLeague = m.is_approved === true || (approvedLeagueNames.size > 0 && approvedLeagueNames.has(lgNorm));
                if (!isApprovedLeague) {
                  continue; // Skip non-approved leagues for scheduled matches
                }

                const matchTime = m.date || m.kickoff_ist;
                if (matchTime) {
                  try {
                    const kickoffDt = new Date(matchTime);
                    const diffMins = (now - kickoffDt) / 60000;
                    if (diffMins >= -30 && diffMins <= 1440) {
                      candidates.push(m);
                    }
                  } catch (err) {}
                }
              }

              if (candidates.length === 0) {
                return { live_count: 0, polled: 0, updated: 0, message: 'No live matches active' };
              }

              let updatedCount = 0;

              // Poll telemetry concurrently for all active candidates
              await Promise.all(candidates.map(async (match) => {
                const fotmobId = match.fotmob_id;
                try {
                  const fmUrl = `https://www.fotmob.com/api/data/matchDetails?matchId=${fotmobId}`;
                  const fmRes = await fetch(fmUrl, { headers: FOTMOB_HEADERS });
                  if (!fmRes.ok) return;

                  const raw = await fmRes.json();
                  const parsed = parseFotMobTelemetry(raw);

                  const scoreChanged = parsed.homeScore !== match.home_score || parsed.awayScore !== match.away_score;
                  const statusChanged = parsed.status !== match.status;
                  const timeChanged = parsed.timeElapsed !== match.time_elapsed;
                  const hasLineups = Object.keys(parsed.lineups).length > 0;
                  const hasStats = Object.keys(parsed.matchStats).length > 0;

                  // Enhanced Delta Signature Caching:
                  // Incorporate score, status, elapsed time, events, xG, momentum points length, and dynamic player ratings
                  const xgSig = (parsed.matchStats?.expected_goals || parsed.matchStats?.xg || []).join(',') || '0,0';
                  const momentumLen = (parsed.matchStats?.momentum || []).length;
                  const lineupRatingSig = getLineupRatingSignature(parsed.lineups);
                  const lineupRatingHash = lineupRatingSig ? md5(lineupRatingSig) : '0';

                  // DELTA-ONLY INGESTION: Skip DB write if telemetry unchanged from previous poll
                  const telemetrySig = `${parsed.homeScore}-${parsed.awayScore}|${parsed.status}|${parsed.timeElapsed}|${parsed.goalScorers?.length || 0}|${parsed.cards?.length || 0}|${parsed.subs?.length || 0}|${xgSig}|${momentumLen}|${lineupRatingHash}`;
                  const cacheKey = `fb_${match.id}`;
                  if (telemetrySignatureCache.get(cacheKey) === telemetrySig) {
                    return; // Telemetry unchanged. Skip DB write and WAL log generation!
                  }
                  telemetrySignatureCache.set(cacheKey, telemetrySig);

                  // Update match row in zeta_matches
                  const patchUrl = `${sbUrl}/rest/v1/zeta_matches?id=eq.${match.id}`;
                  const patchPayload = {
                    home_score: parsed.homeScore,
                    away_score: parsed.awayScore,
                    status: parsed.status,
                    time_elapsed: parsed.timeElapsed,
                    goal_scorers: parsed.goalScorers,
                    cards: parsed.cards,
                    substitutions: parsed.subs,
                    updated_at: new Date().toISOString()
                  };

                  if (hasLineups) {
                    patchPayload.lineups = parsed.lineups;
                    patchPayload.formations = parsed.formations;
                  }
                  if (hasStats) {
                    patchPayload.match_stats = parsed.matchStats;
                    patchPayload.stats = parsed.matchStats;
                  }
                  if (parsed.venue) patchPayload.venue = parsed.venue;
                  if (parsed.referee) patchPayload.referee = parsed.referee;
                  if (parsed.h2h && parsed.h2h.length > 0) patchPayload.h2h = parsed.h2h;

                  const patchRes = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: { ...sbHeaders, 'Prefer': 'return=representation' },
                    body: JSON.stringify(patchPayload)
                  });

                  if (patchRes.ok) {
                    updatedCount++;
                    console.log(`[Worker] Updated match ${match.id}: ${parsed.homeScore}-${parsed.awayScore} (${parsed.timeElapsed})`);

                    // ── Auto-generate & Overwrite Thumbnail on Live Goal / FT ──
                    try {
                      const [hB64, aB64] = await Promise.all([
                        getLogoAsBase64(match.home_logo),
                        getLogoAsBase64(match.away_logo)
                      ]);
                      const svg = generateEdgeMatchdaySvg({
                        homeTeam: match.home_team,
                        awayTeam: match.away_team,
                        homeScore: parsed.homeScore,
                        awayScore: parsed.awayScore,
                        homeLogo: hB64 || (typeof match.home_logo === 'string' && match.home_logo.startsWith('data:image/') ? match.home_logo : ''),
                        awayLogo: aB64 || (typeof match.away_logo === 'string' && match.away_logo.startsWith('data:image/') ? match.away_logo : ''),
                        league: match.league_name,
                        status: parsed.status,
                        timeElapsed: parsed.timeElapsed,
                        goalScorers: parsed.goalScorers,
                        venue: match.venue,
                        kickoff: match.kickoff_ist
                      });
                      await uploadThumbnailToSupabase(env, match.id, svg);
                    } catch (thumbErr) {
                      console.warn(`[Worker] Auto-thumbnail overwrite error for ${match.id}:`, thumbErr.message);
                    }
                  }

                  // 3. Upsert into dedicated subtable zeta_match_lineups (refreshes in real-time when player ratings or lineup shifts)
                  const lineupCacheKey = `lineup_${match.id}`;
                  if (hasLineups && telemetrySignatureCache.get(lineupCacheKey) !== lineupRatingHash) {
                    telemetrySignatureCache.set(lineupCacheKey, lineupRatingHash);
                    try {
                      await fetch(`${sbUrl}/rest/v1/zeta_match_lineups`, {
                        method: 'POST',
                        headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
                        body: JSON.stringify({
                          match_id: match.id,
                          home_lineup: parsed.lineups.home || {},
                          away_lineup: parsed.lineups.away || {},
                          updated_at: new Date().toISOString()
                        })
                      });
                    } catch (e) {}
                  }

                  // 4. Upsert into dedicated subtable zeta_match_stats if stats available
                  const statsSig = `${xgSig}|${momentumLen}|${(parsed.matchStats.possession || []).join(',')}|${(parsed.matchStats.shots || []).join(',')}`;
                  const statsCacheKey = `stats_${match.id}`;
                  if (hasStats && telemetrySignatureCache.get(statsCacheKey) !== statsSig) {
                    telemetrySignatureCache.set(statsCacheKey, statsSig);
                    try {
                      await fetch(`${sbUrl}/rest/v1/zeta_match_stats`, {
                        method: 'POST',
                        headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
                        body: JSON.stringify({
                          match_id: match.id,
                          home_stats: parsed.matchStats,
                          away_stats: parsed.matchStats,
                          updated_at: new Date().toISOString()
                        })
                      });
                    } catch (e) {}
                  }
                } catch (e) {
                  console.warn(`[Worker] Error polling FotMob ${fotmobId}:`, e.message);
                }
              }));

              return { live_count: candidates.length, polled: candidates.length, updated: updatedCount };
            }

            // ── 2B. Daily Sliding Window Ingestion (Runs at midnight or on-demand) ─────────
            async function syncDailySlidingWindowFixtures(env) {
              const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
              const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

              const sbHeaders = {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
              };

              // 1. Strict 4-Day Sliding Window: Past 1 day (-1) to Future 2 days (+2)
              const dates = [];
              const base = new Date();
              for (let offset = -1; offset <= 2; offset++) {
                const d = new Date(base);
                d.setUTCDate(base.getUTCDate() + offset);
                dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
              }

              // 2. 35 Whitelisted Competitions + DB Featured Leagues
              const WHITELISTED_35 = [
                'premier league', 'la liga', 'laliga', 'serie a', 'bundesliga', 'ligue 1',
                'uefa champions league', 'champions league', 'uefa europa league', 'europa league',
                'uefa conference league', 'conference league', 'uefa nations league', 'nations league',
                'fa cup', 'efl cup', 'carabao cup', 'copa del rey', 'dfb-pokal', 'dfb pokal',
                'coppa italia', 'coupe de france', 'supercopa', 'supercoppa', 'community shield',
                'eredivisie', 'primeira liga', 'liga portugal', 'major league soccer', 'mls',
                'saudi pro league', 'brasileirao', 'brasileirão', 'liga mx', 'championship',
                'afc champions league', 'copa libertadores', 'copa sudamericana', 'world cup', 'euro', 'friendlies', 'saff', 'saff championship', 'indian super league', 'isl'
              ];

              let approvedLeagueNames = new Set(WHITELISTED_35);
              try {
                const lgRes = await fetch(`${sbUrl}/rest/v1/zeta_leagues?select=name,featured&featured=eq.true`, { headers: sbHeaders });
                if (lgRes.ok) {
                  const lgs = await lgRes.json();
                  if (lgs.length > 0) {
                    lgs.forEach(l => approvedLeagueNames.add((l.name || '').trim().toLowerCase()));
                  }
                }
              } catch (e) {}

              let totalMatches = 0;
              for (const dateQuery of dates) {
                try {
                  const url = `https://www.fotmob.com/api/data/matches?date=${dateQuery}`;
                  const res = await fetch(url, { headers: FOTMOB_HEADERS });
                  if (!res.ok) continue;
                  const data = await res.json();
                  const leagues = data.leagues || [];

                  const matchRows = [];
                  for (const lg of leagues) {
                    const lower = (lg.name || '').toLowerCase();
                    const isApproved = Array.from(approvedLeagueNames).some(allowed => lower.includes(allowed) || allowed.includes(lower));
                    if (!isApproved) continue;

                    for (const m of (lg.matches || [])) {
                      if (!m.home || !m.away) continue;
                      const utcTime = m.status?.utcTime || (m.timeTS ? new Date(m.timeTS).toISOString() : new Date().toISOString());
                      const mUuid = m.id ? toUUID('fotmob_' + m.id) : undefined;
                      matchRows.push({
                        id: mUuid,
                        fotmob_id: String(m.id),
                        home_team: m.home.name,
                        away_team: m.away.name,
                        home_logo: m.home.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${m.home.id}.png` : '',
                        away_logo: m.away.id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${m.away.id}.png` : '',
                        date: utcTime,
                        kickoff_ist: formatIST(utcTime),
                        status: m.status?.finished ? 'finished' : (m.status?.started ? 'live' : 'scheduled'),
                        time_elapsed: m.status?.finished ? 'FT' : (m.status?.started ? (m.status?.liveTime?.short || 'LIVE') : ''),
                        home_score: m.home.score ?? 0,
                        away_score: m.away.score ?? 0,
                        league_name: lg.name,
                        thumbnail_url: mUuid ? `https://zetasports-live-worker.dennisnorwood812.workers.dev/api/poster?matchId=${mUuid}` : '',
                        is_approved: false, // Default false in ZetaSports v3: manual approval only
                        updated_at: new Date().toISOString()
                      });
                    }
                  }

                  if (matchRows.length > 0) {
                    await fetch(`${sbUrl}/rest/v1/zeta_matches`, {
                      method: 'POST',
                      headers: sbHeaders,
                      body: JSON.stringify(matchRows)
                    });
                    totalMatches += matchRows.length;
                  }
                } catch (e) {
                  console.warn(`[Worker] Error syncing date ${dateQuery}:`, e.message);
                }
              }

              // Auto-prune matches older than the 4-day sliding window (older than -1 day)
              const pruneLimit = new Date();
              pruneLimit.setUTCDate(pruneLimit.getUTCDate() - 2);
              try {
                await fetch(`${sbUrl}/rest/v1/zeta_matches?date=lt.${pruneLimit.toISOString()}`, {
                  method: 'DELETE',
                  headers: sbHeaders
                });
              } catch (e) {}

              return { status: 'success', synced_matches: totalMatches };
            }

            const CRICKET_ALIASES = {
              'ind': ['india'],
              'pak': ['pakistan'],
              'aus': ['australia'],
              'wi': ['west indies', 'windies'],
              'sa': ['south africa'],
              'eng': ['england'],
              'nz': ['new zealand'],
              'sl': ['sri lanka'],
              'ban': ['bangladesh'],
              'afg': ['afghanistan'],
              'zim': ['zimbabwe'],
              'usa': ['united states', 'usa'],
              'uae': ['united arab emirates', 'uae'],
              'indu19': ['india under-19s', 'india u19', 'india under 19s', 'india u-19'],
              'ausu19': ['australia under-19s', 'australia u19', 'australia under 19s', 'australia u-19'],
              'paku19': ['pakistan under-19s', 'pakistan u19'],
              'engu19': ['england under-19s', 'england u19'],
              'zimw': ['zimbabwe women', 'zim women', 'zimbabwe w'],
              'wiw': ['west indies women', 'wi women', 'west indies w']
            };

            function normalizeCricketText(str) {
              return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
            }

            function cricketTeamMatchesText(teamName, text) {
              const normTeam = normalizeCricketText(teamName);
              const normText = ' ' + normalizeCricketText(text) + ' ';

              const candidates = new Set([normTeam]);
              if (CRICKET_ALIASES[normTeam]) {
                for (const a of CRICKET_ALIASES[normTeam]) candidates.add(normalizeCricketText(a));
              }

              const stripped = normTeam.replace(/\b(cricket|team|xi)\b/g, '').replace(/\s+/g, ' ').trim();
              if (stripped) {
                candidates.add(stripped);
                if (CRICKET_ALIASES[stripped]) {
                  for (const a of CRICKET_ALIASES[stripped]) candidates.add(normalizeCricketText(a));
                }
              }

              for (const c of candidates) {
                if (!c || c.length < 2) continue;
                if (normText.includes(' ' + c + ' ')) {
                  return true;
                }
              }
              return false;
            }

            function matchCricketTeams(hTeam, aTeam, title) {
              if (!hTeam || !aTeam || !title) return false;
              const parts = title.split(/\s+v\s+|\s+vs\s+/i);
              if (parts.length < 2) return false;
              const tHome = parts[0];
              const tAway = parts[1];

              const direct = (cricketTeamMatchesText(hTeam, tHome) && cricketTeamMatchesText(aTeam, tAway));
              const reverse = (cricketTeamMatchesText(hTeam, tAway) && cricketTeamMatchesText(aTeam, tHome));
              return direct || reverse;
            }

            // ── 2C. Live Cricket Poller (ESPN Cricinfo RSS Feed) ─────────────────────────
            async function pollActiveCricketMatches(env) {
              const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
              const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
              const sbHeaders = {
                'apikey': sbKey,
                'Authorization': `Bearer ${sbKey}`,
                'Content-Type': 'application/json'
              };

              try {
                const qUrl = `${sbUrl}/rest/v1/zeta_matches?sport=eq.cricket&status=in.(live,in_play,scheduled)&select=id,home_team,away_team,home_score,away_score,status,time_elapsed`;
                const res = await fetch(qUrl, { headers: sbHeaders });
                if (!res.ok) return { updated: 0 };
                const matches = await res.json();
                if (!matches || matches.length === 0) return { updated: 0 };

                const rssRes = await fetch('http://static.cricinfo.com/rss/livescores.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (!rssRes.ok) return { updated: 0 };
                const text = await rssRes.text();

                const titles = [...text.matchAll(/<title>([^<]+)<\/title>/gi)].map(m => m[1]).slice(1);
                let updated = 0;

                for (const m of matches) {
                  let matchedTitle = null;
                  for (const title of titles) {
                    if (matchCricketTeams(m.home_team, m.away_team, title)) {
                      matchedTitle = title;
                      break;
                    }
                  }

                  if (!matchedTitle) {
                    if (m.status === 'live') {
                      await fetch(`${sbUrl}/rest/v1/zeta_matches?id=eq.${m.id}`, {
                        method: 'PATCH',
                        headers: sbHeaders,
                        body: JSON.stringify({
                          status: 'scheduled',
                          home_score: 0,
                          away_score: 0,
                          time_elapsed: '',
                          updated_at: new Date().toISOString()
                        })
                      });
                      telemetrySignatureCache.delete(`cric_${m.id}`);
                    }
                    continue;
                  }

                  const cricSig = `live|${matchedTitle.slice(0, 50)}`;
                  const cricKey = `cric_${m.id}`;
                  if (telemetrySignatureCache.get(cricKey) === cricSig && m.status === 'live') {
                    continue; // Score headline unchanged, skip Supabase write!
                  }
                  telemetrySignatureCache.set(cricKey, cricSig);

                  await fetch(`${sbUrl}/rest/v1/zeta_matches?id=eq.${m.id}`, {
                    method: 'PATCH',
                    headers: sbHeaders,
                    body: JSON.stringify({
                      status: 'live',
                      time_elapsed: matchedTitle.slice(0, 50),
                      updated_at: new Date().toISOString()
                    })
                  });
                  updated++;
                }
                return { updated };
              } catch (e) {
                return { updated: 0 };
              }
            }

            // ── 2B. Edge Canvas & Vector Matchday Poster Generator ───────────────
            function escapeXml(str) {
              if (!str) return '';
              return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            }

            const logoDataUriCache = new Map();

            async function getLogoAsBase64(url) {
              if (!url || typeof url !== 'string' || !url.startsWith('http')) return '';
              if (url.startsWith('data:')) return url;
              if (logoDataUriCache.has(url)) return logoDataUriCache.get(url);

              try {
                const res = await fetch(url, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                  }
                });
                if (!res.ok) return '';
                const buf = await res.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                const b64 = btoa(binary);
                const mime = res.headers.get('content-type') || 'image/png';
                const dataUri = `data:${mime};base64,${b64}`;
                logoDataUriCache.set(url, dataUri);
                return dataUri;
              } catch (err) {
                return '';
              }
            }

            // Extracts crisp 3-character monogram acronym for vector fallback
            function getTeamAcronym(name) {
              if (!name) return 'ZET';
              let clean = String(name).trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
              let words = clean.split(/\s+/).filter(Boolean);
              if (words.length > 1 && (words[0] === 'FC' || words[0] === 'AFC' || words[0] === 'CF' || words[0] === 'SC')) {
                words = words.slice(1);
                clean = words.join(' ');
              }
              if (words.length >= 3) {
                return words.slice(0, 3).map(w => w[0]).join('');
              }
              if (words.length === 2) {
                return (words[0][0] + words[1].slice(0, 2)).slice(0, 3);
              }
              return clean.slice(0, 3);
            }

            function generateEdgeMatchdaySvg({
              homeTeam = 'Home Team',
              awayTeam = 'Away Team',
              homeScore = 0,
              awayScore = 0,
              homeLogo = '',
              awayLogo = '',
              league = 'Matchday',
              status = 'scheduled',
              timeElapsed = '',
              goalScorers = [],
              venue = '',
              kickoff = ''
            }) {
              const normStatus = (status || '').toLowerCase();
              const isFinished = normStatus === 'finished' || normStatus === 'ft';
              const isLive = normStatus === 'live' || normStatus === 'in_play';

              const escHome = escapeXml(homeTeam.toUpperCase());
              const escAway = escapeXml(awayTeam.toUpperCase());
              const escLeague = escapeXml((league || 'ZETASPORTS MATCHDAY').toUpperCase());
              const escHomeLogo = escapeXml(homeLogo);
              const escAwayLogo = escapeXml(awayLogo);
              const escTime = escapeXml(timeElapsed || 'LIVE');
              const escVenue = escapeXml(venue);
              const escKickoff = escapeXml(kickoff);

              // Parse & format goal scorers
              let allScorersStr = '';
              if (Array.isArray(goalScorers) && goalScorers.length > 0) {
                const parts = [];
                goalScorers.forEach(g => {
                  if (typeof g === 'string') {
                    parts.push(g);
                  } else if (g && g.player) {
                    const minStr = g.minute ? ` ${g.minute}'` : '';
                    parts.push(`${g.player}${minStr}`);
                  }
                });
                allScorersStr = parts.join(' • ');
              } else if (typeof goalScorers === 'string' && goalScorers.trim()) {
                allScorersStr = goalScorers.trim();
              }
              const escScorers = escapeXml(allScorersStr);

              let middleBadge = '';
              if (isFinished) {
                const scorersPill = escScorers ? `
                  <rect x="-170" y="105" width="340" height="28" rx="14" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" stroke-width="1.5"/>
                  <text x="0" y="124" font-family="'Oswald', sans-serif" font-weight="700" font-size="12" fill="#6ee7b7" text-anchor="middle" letter-spacing="1">&#9917; ${escScorers}</text>
                ` : '';
                middleBadge = `
                  <!-- Full Time Score Card -->
                  <g transform="translate(640, 360)">
                    <rect x="-130" y="-55" width="260" height="110" rx="20" fill="#0b1329" stroke="rgba(255,255,255,0.18)" stroke-width="2" filter="url(#badgeShadow)"/>
                    <text x="0" y="16" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="56" fill="#ffffff" text-anchor="middle" letter-spacing="4">${homeScore} - ${awayScore}</text>
                    <rect x="-65" y="65" width="130" height="30" rx="15" fill="#10b981" filter="url(#glowGreen)"/>
                    <text x="0" y="85" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="2">FULL TIME</text>
                    ${scorersPill}
                  </g>
                `;
              } else if (isLive) {
                const scorersPill = escScorers ? `
                  <rect x="-170" y="105" width="340" height="28" rx="14" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" stroke-width="1.5"/>
                  <text x="0" y="124" font-family="'Oswald', sans-serif" font-weight="700" font-size="12" fill="#fca5a5" text-anchor="middle" letter-spacing="1">&#9917; ${escScorers}</text>
                ` : '';
                middleBadge = `
                  <!-- Live In-Play Score Card with Real-time Scorers -->
                  <g transform="translate(640, 360)">
                    <rect x="-130" y="-55" width="260" height="110" rx="20" fill="#0b1329" stroke="#ef4444" stroke-width="2.5" filter="url(#badgeShadow)"/>
                    <text x="0" y="16" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="56" fill="#ef4444" text-anchor="middle" letter-spacing="4">${homeScore} - ${awayScore}</text>
                    <rect x="-75" y="65" width="150" height="30" rx="15" fill="#ef4444" filter="url(#glowRed)"/>
                    <circle cx="-50" cy="80" r="5" fill="#ffffff"/>
                    <text x="5" y="85" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="2">LIVE IN-PLAY</text>
                    ${scorersPill}
                  </g>
                `;
              } else {
                const venuePill = (escVenue || escKickoff) ? `
                  <rect x="-140" y="110" width="280" height="26" rx="13" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)"/>
                  <text x="0" y="127" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="11" fill="#94a3b8" text-anchor="middle" letter-spacing="1">&#128205; ${escVenue || 'MATCHDAY'} &#8226; ${escKickoff || 'TODAY'}</text>
                ` : '';
                middleBadge = `
                  <!-- Upcoming Match Preview VS -->
                  <g transform="translate(640, 360)">
                    <circle cx="0" cy="0" r="54" fill="url(#vsGrad)" filter="url(#badgeShadow)"/>
                    <circle cx="0" cy="0" r="52" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.3"/>
                    <text x="0" y="14" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="2">VS</text>
                    <rect x="-110" y="70" width="220" height="32" rx="16" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)"/>
                    <text x="0" y="91" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="12" fill="#38bdf8" text-anchor="middle" letter-spacing="2">STARTING XI &#8226; HD STREAM</text>
                    ${venuePill}
                  </g>
                `;
              }

              // Chrome disallows external HTTP subresources inside SVG images; only allow base64 data URIs
              const isHomeValidDataUri = typeof homeLogo === 'string' && homeLogo.startsWith('data:image/');
              const isAwayValidDataUri = typeof awayLogo === 'string' && awayLogo.startsWith('data:image/');

              const homeAcronym = escapeXml(getTeamAcronym(homeTeam));
              const awayAcronym = escapeXml(getTeamAcronym(awayTeam));

              const homeLogoTag = isHomeValidDataUri
                ? `<image href="${escHomeLogo}" x="-80" y="-120" width="160" height="160" preserveAspectRatio="xMidYMid meet" filter="url(#crestShadow)"/>`
                : `<circle cx="0" cy="-40" r="60" fill="#1e293b" stroke="#334155" stroke-width="2"/>
                   <text x="0" y="-28" font-family="'Oswald', sans-serif" font-size="32" font-weight="800" fill="#94a3b8" text-anchor="middle">${homeAcronym}</text>`;

              const awayLogoTag = isAwayValidDataUri
                ? `<image href="${escAwayLogo}" x="-80" y="-120" width="160" height="160" preserveAspectRatio="xMidYMid meet" filter="url(#crestShadow)"/>`
                : `<circle cx="0" cy="-40" r="60" fill="#1e293b" stroke="#334155" stroke-width="2"/>
                   <text x="0" y="-28" font-family="'Oswald', sans-serif" font-size="32" font-weight="800" fill="#94a3b8" text-anchor="middle">${awayAcronym}</text>`;

              return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1280 720" width="1280" height="720">
              <defs>
                <radialGradient id="stadiumGlow" cx="50%" cy="40%" r="65%">
                  <stop offset="0%" stop-color="#142c52" stop-opacity="1"/>
                  <stop offset="60%" stop-color="#091426" stop-opacity="1"/>
                  <stop offset="100%" stop-color="#040812" stop-opacity="1"/>
                </radialGradient>
                <radialGradient id="floodLeft" cx="20%" cy="15%" r="40%">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="floodRight" cx="80%" cy="15%" r="40%">
                  <stop offset="0%" stop-color="#0062b2" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="#0062b2" stop-opacity="0"/>
                </radialGradient>
                <linearGradient id="vsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0062b2"/>
                  <stop offset="100%" stop-color="#38bdf8"/>
                </linearGradient>
                <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
                </filter>
                <filter id="crestShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
                </filter>
                <filter id="glowGreen">
                  <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#10b981" flood-opacity="0.5"/>
                </filter>
                <filter id="glowRed">
                  <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#ef4444" flood-opacity="0.6"/>
                </filter>
              </defs>

              <!-- Background Base & Stadium Floodlights -->
              <rect width="1280" height="720" fill="url(#stadiumGlow)"/>
              <rect width="1280" height="720" fill="url(#floodLeft)"/>
              <rect width="1280" height="720" fill="url(#floodRight)"/>

              <!-- Field Geometry Lines (Subtle Broadcast Feel) -->
              <g opacity="0.08" stroke="#ffffff" stroke-width="2" fill="none">
                <ellipse cx="640" cy="720" rx="480" ry="220"/>
                <line x1="640" y1="0" x2="640" y2="720"/>
                <circle cx="640" cy="360" r="160"/>
              </g>

              <!-- Top Brand Navigation / ZetaSports Broadcast Bar -->
              <g transform="translate(640, 75)">
                <rect x="-240" y="-24" width="480" height="48" rx="24" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(255,255,255,0.12)" filter="url(#badgeShadow)"/>
                <!-- ZetaSports Blue Shield -->
                <rect x="-222" y="-15" width="30" height="30" rx="8" fill="#0062b2"/>
                <path d="M-214 -8 H-199 L-209 6 H-199" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <!-- Brand Title -->
                <text x="-180" y="6" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="14" fill="#38bdf8" letter-spacing="2">ZETASPORTS</text>
                <!-- League Pill -->
                <rect x="-65" y="-12" width="285" height="24" rx="6" fill="rgba(56, 189, 248, 0.12)" stroke="rgba(56, 189, 248, 0.25)"/>
                <text x="77" y="5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="11" fill="#e2e8f0" text-anchor="middle" letter-spacing="1">${escLeague}</text>
              </g>

              <!-- Left: Home Team Presentation -->
              <g transform="translate(310, 360)">
                ${homeLogoTag}
                <text x="0" y="80" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="1" filter="url(#crestShadow)">${escHome}</text>
                <text x="0" y="106" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="12" fill="#38bdf8" text-anchor="middle" letter-spacing="2">HOME</text>
              </g>

              <!-- Center Badge / Score presentation -->
              ${middleBadge}

              <!-- Right: Away Team Presentation -->
              <g transform="translate(970, 360)">
                ${awayLogoTag}
                <text x="0" y="80" font-family="'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="1" filter="url(#crestShadow)">${escAway}</text>
                <text x="0" y="106" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="12" fill="#94a3b8" text-anchor="middle" letter-spacing="2">AWAY</text>
              </g>

              <!-- Bottom Telemetry Ticker -->
              <g transform="translate(640, 665)">
                <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="12" fill="#64748b" text-anchor="middle" letter-spacing="3">
                  OFFICIAL MATCHDAY BROADCAST &#8226; FOTMOB TELEMETRY &#8226; ZETASPORTS NETWORK
                </text>
              </g>
            </svg>`;
            }

            // ── 2C. Automated Supabase Storage Uploader (Overwrites on Goal / FT) ──
            async function uploadThumbnailToSupabase(env, matchId, svgContent) {
              const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
              const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
              const bucket = 'match-thumbnails';
              const fileName = `${matchId}.svg`;
              const uploadUrl = `${sbUrl}/storage/v1/object/${bucket}/${fileName}`;

              try {
                const res = await fetch(uploadUrl, {
                  method: 'POST',
                  headers: {
                    'apikey': sbKey,
                    'Authorization': `Bearer ${sbKey}`,
                    'Content-Type': 'image/svg+xml; charset=utf-8',
                    'x-upsert': 'true'
                  },
                  body: svgContent
                });

                const publicUrl = `${sbUrl}/storage/v1/object/public/${bucket}/${fileName}`;
                if (res.ok) {
                  await fetch(`${sbUrl}/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`, {
                    method: 'PATCH',
                    headers: {
                      'apikey': sbKey,
                      'Authorization': `Bearer ${sbKey}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ thumbnail_url: publicUrl, updated_at: new Date().toISOString() })
                  });
                  console.log(`[Worker Storage]: Overwrote thumbnail for match ${matchId}: ${publicUrl}`);
                }
                return publicUrl;
              } catch (err) {
                console.warn(`[Worker Storage Error]:`, err.message);
                return null;
              }
            }

            // ── 3. Cloudflare Worker Entrypoint ──────────────────────────────────────────
            export default {
              // Cron Handler (Triggered every minute or daily by Cloudflare)
              async scheduled(event, env, ctx) {
                console.log('[Worker] Cron triggered:', event.cron);

                // Daily Midnight Ingestion Cron (00:05 UTC)
                if (event.cron === '5 0 * * *') {
                  console.log('[Worker] Running daily midnight sliding window ingestion...');
                  await syncDailySlidingWindowFixtures(env);
                  return;
                }

                // 10-Second Sub-Minute Loop for Live Football & Cricket:
                const ITERATIONS = 5;
                for (let i = 0; i < ITERATIONS; i++) {
                  const [footballResult, cricketResult] = await Promise.all([
                    pollActiveMatches(env),
                    pollActiveCricketMatches(env)
                  ]);

                  if (footballResult.live_count === 0 && cricketResult.updated === 0) {
                    console.log('[Worker] No matches live. Sleeping until next cron.');
                    break;
                  }

                  if (i < ITERATIONS - 1) {
                    await new Promise(resolve => setTimeout(resolve, 10000)); // sleep 10s
                  }
                }
              },

              // HTTP Webhook Handler
              async fetch(request, env, ctx) {
                const url = new URL(request.url);

                // CORS headers
                const corsHeaders = {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
                  'Content-Type': 'application/json'
                };

                if (request.method === 'OPTIONS') {
                  return new Response(null, { headers: corsHeaders });
                }

                if (url.pathname === '/' || url.pathname === '/health') {
                  return new Response(JSON.stringify({
                    status: 'healthy',
                    service: 'ZetaSports v2 24/7 Cloudflare Telemetry Worker',
                    timestamp: new Date().toISOString(),
                    cron_cadence: '10-Second Sub-Minute Poller'
                  }), { headers: corsHeaders });
                }

                if (url.pathname === '/sync/live') {
                  const result = await pollActiveMatches(env);
                  return new Response(JSON.stringify({
                    status: 'success',
                    polled_at: new Date().toISOString(),
                    result
                  }), { headers: corsHeaders });
                }

                if (url.pathname === '/sync/sliding-window') {
                  const result = await syncDailySlidingWindowFixtures(env);
                  return new Response(JSON.stringify({
                    status: 'success',
                    synced_at: new Date().toISOString(),
                    result
                  }), { headers: corsHeaders });
                }

                if (url.pathname === '/api/fixtures') {
                  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
                  if (cache) {
                    try {
                      const cachedRes = await cache.match(request);
                      if (cachedRes) return cachedRes;
                    } catch (e) {}
                  }

                  const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
                  const sbKey = env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
                  const qUrl = `${sbUrl}/rest/v1/zeta_matches?select=id,home_team,away_team,home_score,away_score,home_logo,away_logo,status,time_elapsed,date,kickoff_ist,league_name,is_approved,match_stats,article_url,article_source&order=date.asc`;

                  const sbRes = await fetch(qUrl, {
                    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
                  });
                  const data = await sbRes.text();

                  const response = new Response(data, {
                    headers: {
                      ...corsHeaders,
                      'Cache-Control': 'public, max-age=10, s-maxage=15',
                      'X-Edge-Cache': 'MISS'
                    }
                  });
                  if (cache && ctx && ctx.waitUntil) {
                    try {
                      ctx.waitUntil(cache.put(request, response.clone()));
                    } catch (e) {}
                  }
                  return response;
                }

                // ── Serverless Match Redirect to Blogger Article ──
                if (url.pathname.startsWith('/r/') || url.pathname === '/api/match-redirect') {
                  let matchId = '';
                  if (url.pathname.startsWith('/r/')) {
                    matchId = decodeURIComponent(url.pathname.replace(/^\/r\//, '').trim());
                  } else {
                    matchId = url.searchParams.get('matchId') || url.searchParams.get('id') || '';
                  }

                  if (matchId) {
                    try {
                      const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
                      const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
                      const qUrl = `${sbUrl}/rest/v1/zeta_matches?or=(id.eq.${encodeURIComponent(matchId)},fotmob_id.eq.${encodeURIComponent(matchId)})&select=article_url,home_team,away_team&limit=1`;
                      const mRes = await fetch(qUrl, {
                        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
                      });
                      if (mRes.ok) {
                        const rows = await mRes.json();
                        if (rows && rows.length > 0) {
                          const artUrl = (rows[0].article_url || '').trim();
                          if (artUrl && artUrl.startsWith('http')) {
                            return Response.redirect(artUrl, 302);
                          }
                          const home = rows[0].home_team || '';
                          const away = rows[0].away_team || '';
                          if (home || away) {
                            return Response.redirect(`https://www.keralahub.online/search?q=${encodeURIComponent((home + ' ' + away).trim())}`, 302);
                          }
                        }
                      }
                    } catch (err) {
                      console.warn('[Worker Redirect Error]:', err.message);
                    }
                  }
                  return Response.redirect('https://www.keralahub.online/', 302);
                }

                // ── Dedicated FotMob Match Details Proxy (CORS & Edge Cache) ──
                if (url.pathname === '/api/match-details') {
                  const matchId = url.searchParams.get('matchId');
                  if (!matchId) {
                    return new Response(JSON.stringify({ error: 'Missing matchId query parameter' }), {
                      status: 400,
                      headers: corsHeaders
                    });
                  }

                  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
                  if (cache) {
                    try {
                      const cachedRes = await cache.match(request);
                      if (cachedRes) return cachedRes;
                    } catch (e) {}
                  }

                  try {
                    const fmUrl = `https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`;
                    const fmRes = await fetch(fmUrl, { headers: FOTMOB_HEADERS });
                    if (!fmRes.ok) {
                      return new Response(JSON.stringify({ error: `FotMob API error: ${fmRes.status}` }), {
                        status: fmRes.status,
                        headers: corsHeaders
                      });
                    }

                    const data = await fmRes.text();
                    const response = new Response(data, {
                      headers: {
                        ...corsHeaders,
                        'Cache-Control': 'public, max-age=15, s-maxage=30',
                        'X-Edge-Cache': 'MISS'
                      }
                    });

                    if (cache && ctx && ctx.waitUntil) {
                      try {
                        ctx.waitUntil(cache.put(request, response.clone()));
                      } catch (e) {}
                    }

                    return response;
                  } catch (err) {
                    return new Response(JSON.stringify({ error: 'Failed to fetch match details', details: err.message }), {
                      status: 502,
                      headers: corsHeaders
                    });
                  }
                }

                // ── Dedicated Edge Matchday Poster Generator (16:9 Vector Canvas) ──
                if (url.pathname === '/api/poster' || url.pathname === '/api/poster.svg') {
                  let homeTeam = url.searchParams.get('home') || 'Home Team';
                  let awayTeam = url.searchParams.get('away') || 'Away Team';
                  let league = url.searchParams.get('league') || 'ZetaSports Matchday';
                  let homeLogo = url.searchParams.get('homeLogo') || '';
                  let awayLogo = url.searchParams.get('awayLogo') || '';
                  let homeScore = parseInt(url.searchParams.get('homeScore') || '0', 10);
                  let awayScore = parseInt(url.searchParams.get('awayScore') || '0', 10);
                  let status = url.searchParams.get('status') || 'scheduled';
                  let timeElapsed = url.searchParams.get('timeElapsed') || '';
                  let venue = url.searchParams.get('venue') || '';
                  let kickoff = url.searchParams.get('kickoff') || '';
                  let goalScorers = [];

                  const matchId = url.searchParams.get('matchId');
                  if (matchId) {
                    try {
                      const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
                      const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
                      const mRes = await fetch(`${sbUrl}/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, {
                        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
                      });
                      if (mRes.ok) {
                        const matches = await mRes.json();
                        if (matches && matches.length > 0) {
                          const m = matches[0];
                          homeTeam = m.home_team || homeTeam;
                          awayTeam = m.away_team || awayTeam;
                          league = m.league_name || league;
                          homeLogo = m.home_logo || homeLogo;
                          awayLogo = m.away_logo || awayLogo;
                          homeScore = m.home_score != null ? m.home_score : homeScore;
                          awayScore = m.away_score != null ? m.away_score : awayScore;
                          status = m.status || status;
                          timeElapsed = m.time_elapsed || timeElapsed;
                          goalScorers = m.goal_scorers || goalScorers;
                          venue = m.venue || venue;
                          kickoff = m.kickoff_ist || m.date || kickoff;
                        }
                      }
                    } catch (e) {
                      console.warn('[Poster] Could not fetch match by id:', e.message);
                    }
                  }

                  const [hB64, aB64] = await Promise.all([
                    getLogoAsBase64(homeLogo),
                    getLogoAsBase64(awayLogo)
                  ]);

                  const svg = generateEdgeMatchdaySvg({
                    homeTeam,
                    awayTeam,
                    homeScore,
                    awayScore,
                    homeLogo: hB64 || (typeof homeLogo === 'string' && homeLogo.startsWith('data:image/') ? homeLogo : ''),
                    awayLogo: aB64 || (typeof awayLogo === 'string' && awayLogo.startsWith('data:image/') ? awayLogo : ''),
                    league,
                    status,
                    timeElapsed,
                    goalScorers,
                    venue,
                    kickoff
                  });

                  // If ?upload=true, upload to Supabase Storage and return public URL
                  if (url.searchParams.get('upload') === 'true' && matchId) {
                    const uploadedUrl = await uploadThumbnailToSupabase(env, matchId, svg);
                    return new Response(JSON.stringify({ success: true, matchId, publicUrl: uploadedUrl }), {
                      headers: corsHeaders
                    });
                  }

                  return new Response(svg, {
                    headers: {
                      'Content-Type': 'image/svg+xml; charset=utf-8',
                      'Access-Control-Allow-Origin': '*',
                      'Cache-Control': 'public, max-age=15, s-maxage=30',
                      'X-Edge-Engine': 'ZetaSports-Worker-SVG-Canvas'
                    }
                  });
                }

                // ── Dedicated Upload & Generate Endpoint ──
                if (url.pathname === '/api/thumbnail/upload' || url.pathname === '/api/thumbnail/generate') {
                  let matchId = url.searchParams.get('matchId');
                  if (!matchId && request.method === 'POST') {
                    try {
                      const body = await request.json();
                      matchId = body.matchId;
                    } catch (e) {}
                  }

                  if (!matchId) {
                    return new Response(JSON.stringify({ error: 'Missing matchId parameter' }), {
                      status: 400,
                      headers: corsHeaders
                    });
                  }

                  const sbUrl = (env.SUPABASE_URL || 'https://udlncusvhmydivtjkjcy.supabase.co').replace(/\/+$/, '');
                  const sbKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
                  const mRes = await fetch(`${sbUrl}/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, {
                    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
                  });

                  if (!mRes.ok) {
                    return new Response(JSON.stringify({ error: `Match fetch failed: ${mRes.status}` }), {
                      status: 404,
                      headers: corsHeaders
                    });
                  }

                  const matches = await mRes.json();
                  if (!matches || matches.length === 0) {
                    return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404, headers: corsHeaders });
                  }

                  const m = matches[0];
                  const [hB64, aB64] = await Promise.all([
                    getLogoAsBase64(m.home_logo),
                    getLogoAsBase64(m.away_logo)
                  ]);

                  const svg = generateEdgeMatchdaySvg({
                    homeTeam: m.home_team,
                    awayTeam: m.away_team,
                    homeScore: m.home_score || 0,
                    awayScore: m.away_score || 0,
                    homeLogo: hB64 || (typeof m.home_logo === 'string' && m.home_logo.startsWith('data:image/') ? m.home_logo : ''),
                    awayLogo: aB64 || (typeof m.away_logo === 'string' && m.away_logo.startsWith('data:image/') ? m.away_logo : ''),
                    league: m.league_name || 'Matchday',
                    status: m.status || 'scheduled',
                    timeElapsed: m.time_elapsed || '',
                    goalScorers: m.goal_scorers || [],
                    venue: m.venue || '',
                    kickoff: m.kickoff_ist || m.date || ''
                  });

                  const uploadedUrl = await uploadThumbnailToSupabase(env, matchId, svg);
                  return new Response(JSON.stringify({
                    success: true,
                    matchId,
                    publicUrl: uploadedUrl,
                    status: m.status
                  }), {
                    headers: corsHeaders
                  });
                }

                return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
                  status: 404,
                  headers: corsHeaders
                });
              }
            };
            
