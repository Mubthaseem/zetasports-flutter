/**
 * ZetaSports Dynamic SEO & Real-time Keywords Engine
 * Generates match-specific meta keywords, descriptions, and Google SportsEvent Schema.
 */

function injectMatchSEO(home, away, league, scoreText, isLive, kickoff) {
  try {
    const h = home || 'Home Team';
    const a = away || 'Away Team';
    const l = league || 'Football';
    const s = scoreText || 'vs';

    // 1. Meta Keywords
    const kw = `${h} vs ${a}, ${h} vs ${a} live score, ${h} vs ${a} stream, ${h} vs ${a} lineups, ${l} live, FotMob Scores, ZetaSports, KeralaHub`;
    let metaKw = document.querySelector('meta[name="keywords"]');
    if (!metaKw) {
      metaKw = document.createElement('meta');
      metaKw.name = 'keywords';
      document.head.appendChild(metaKw);
    }
    metaKw.content = kw;

    // 2. Meta Description
    const desc = `Watch ${h} vs ${a} (${s}) live score, lineup formations, H2H statistics, and HD stream gateway on ZetaSports.`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = desc;

    // 3. Google SportsEvent JSON-LD Schema
    const schemaId = 'zeta-sportsevent-schema';
    const existing = document.getElementById(schemaId);
    if (existing) existing.remove();

    const schema = document.createElement('script');
    schema.id = schemaId;
    schema.type = 'application/ld+json';
    schema.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      "name": `${h} vs ${a}`,
      "description": desc,
      "startDate": kickoff || new Date().toISOString(),
      "sport": "Soccer",
      "eventStatus": isLive ? "https://schema.org/EventLive" : "https://schema.org/EventScheduled",
      "competitor": [
        { "@type": "SportsTeam", "name": h },
        { "@type": "SportsTeam", "name": a }
      ]
    });
    document.head.appendChild(schema);
  } catch (e) {
    console.error('SEO injection error:', e);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { injectMatchSEO };
}
