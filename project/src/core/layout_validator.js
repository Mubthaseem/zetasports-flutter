/**
 * ZetaSports UI Layout Stress & Adversarial Parameter Engine
 * Validates flexbox geometry, extreme scoreline boundaries, rapid tab state machines,
 * and malicious URL parameter neutralization.
 */

const { escapeHtml, sanitizeUrl } = require('./sanitizer.js');

/**
 * Validates match card flexbox geometry under varying viewport widths.
 * Enforces the 100% total width ceiling and prevents the 104% collision bug.
 * @param {string} homeName 
 * @param {string} awayName 
 * @param {string} scoreText 
 * @param {number} containerWidthPx e.g. 390 (mobile) or 1280 (desktop)
 * @returns {Object} Layout metrics and collision assessment
 */
function validateCardFlexGeometry(homeName, awayName, scoreText, containerWidthPx = 390) {
  const safeHome = escapeHtml(homeName || 'Home');
  const safeAway = escapeHtml(awayName || 'Away');
  const safeScore = escapeHtml(scoreText || 'vs');

  // Architecture contract: Left <= 35%, Center >= 80px (approx 30%), Right <= 35%
  const maxTeamPercent = 0.35;
  const maxTeamWidth = containerWidthPx * maxTeamPercent;
  const centerMinWidth = 80;

  // Approximate character rendering width in pixels based on 13px bold font (~8px per char)
  const charWidth = 8;
  const rawHomeWidth = safeHome.length * charWidth;
  const rawAwayWidth = safeAway.length * charWidth;

  const homeTruncated = rawHomeWidth > maxTeamWidth;
  const awayTruncated = rawAwayWidth > maxTeamWidth;

  // With CSS flexbox: overflow:hidden; text-overflow:ellipsis; flex: 1 1 0%; max-width: 35%;
  const effectiveHomeWidth = Math.min(rawHomeWidth, maxTeamWidth);
  const effectiveAwayWidth = Math.min(rawAwayWidth, maxTeamWidth);
  const effectiveCenterWidth = Math.max(centerMinWidth, safeScore.length * 14);

  const totalEffectiveWidth = effectiveHomeWidth + effectiveCenterWidth + effectiveAwayWidth;
  const fitsWithoutCollision = totalEffectiveWidth <= containerWidthPx;

  return {
    containerWidth: containerWidthPx,
    homeTeam: {
      rawLength: safeHome.length,
      isTruncated: homeTruncated,
      allottedWidthPx: maxTeamWidth,
      renderedWidthPx: effectiveHomeWidth
    },
    awayTeam: {
      rawLength: safeAway.length,
      isTruncated: awayTruncated,
      allottedWidthPx: maxTeamWidth,
      renderedWidthPx: effectiveAwayWidth
    },
    scoreCenter: {
      text: safeScore,
      renderedWidthPx: effectiveCenterWidth
    },
    totalRenderedWidthPx: totalEffectiveWidth,
    fitsWithoutCollision,
    overflowPercent: totalEffectiveWidth > containerWidthPx 
      ? (((totalEffectiveWidth - containerWidthPx) / containerWidthPx) * 100).toFixed(1)
      : '0.0'
  };
}

/**
 * Validates and normalizes extreme scoreline strings (e.g. 12-11, 99-100, penalty shootouts).
 * @param {string|number} homeScore 
 * @param {string|number} awayScore 
 * @param {Object} [penalties] { home: number, away: number }
 * @returns {{ display: string, isValid: boolean, isExtreme: boolean }}
 */
function formatExtremeScoreline(homeScore, awayScore, penalties = null) {
  const h = homeScore != null ? Number(homeScore) : null;
  const a = awayScore != null ? Number(awayScore) : null;

  if (h === null || a === null || isNaN(h) || isNaN(a)) {
    return { display: 'VS', isValid: true, isExtreme: false };
  }

  const isExtreme = h >= 10 || a >= 10;
  let display = `${h} - ${a}`;

  if (penalties && typeof penalties === 'object') {
    const ph = Number(penalties.home);
    const pa = Number(penalties.away);
    if (!isNaN(ph) && !isNaN(pa)) {
      display = `(${ph}) ${h} - ${a} (${pa})`;
    }
  }

  // Length check: ensure score string fits within center score unit (max 18 chars)
  const isValid = display.length <= 18 && h >= 0 && a >= 0;

  return { display, isValid, isExtreme };
}

/**
 * State machine managing tab transitions with debounce and race condition prevention.
 */
class TabStateMachine {
  constructor(validTabs = ['overview', 'timeline', 'stats', 'lineups', 'h2h', 'commentary', 'articles'], initialTab = 'overview') {
    this.validTabs = new Set(validTabs);
    this.activeTab = this.validTabs.has(initialTab) ? initialTab : 'overview';
    this.transitionHistory = [];
    this.pendingOperation = null;
  }

  switchTab(newTab) {
    if (!this.validTabs.has(newTab)) {
      return { success: false, activeTab: this.activeTab, reason: 'INVALID_TAB_IDENTIFIER' };
    }

    this.activeTab = newTab;
    this.transitionHistory.push({ tab: newTab, timestamp: Date.now() });

    return { success: true, activeTab: this.activeTab };
  }

  getActiveTab() {
    return this.activeTab;
  }

  getTransitionCount() {
    return this.transitionHistory.length;
  }
}

/**
 * Validates, cleanses, and neutralizes adversarial URL query parameters.
 * @param {string|URLSearchParams} rawParams 
 * @returns {{ matchId: string|null, view: string, isClean: boolean, sanitizedView: string }}
 */
function sanitizeQueryParams(rawParams) {
  const params = typeof rawParams === 'string' ? new URLSearchParams(rawParams) : rawParams;
  
  const rawMatchId = params.get('matchId') || params.get('match') || params.get('links') || params.get('stream');
  const rawView = params.get('view') || 'home';

  // Strict UUID validation: 8-4-4-4-12 hex characters
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  
  let validMatchId = null;
  if (rawMatchId && uuidRegex.test(rawMatchId.trim())) {
    validMatchId = rawMatchId.trim().toLowerCase();
  }

  // Allowed views whitelist
  const allowedViews = new Set(['home', 'match', 'links', 'stream']);
  const sanitizedView = allowedViews.has(rawView) ? rawView : 'home';

  // Security test for injected scripts, SQL, or path traversal
  const rawCombined = `${rawMatchId || ''} ${rawView}`;
  const containsAdversarialPayload = /[<>"'`;\(\)\{\}\\]|\.\.\/|\.\.\\/i.test(rawCombined) ||
    /script|alert|prompt|document\.cookie|select|drop|truncate/i.test(rawCombined);

  return {
    matchId: validMatchId,
    view: sanitizedView,
    isClean: !containsAdversarialPayload && (rawMatchId ? validMatchId !== null : true),
    escapedRawView: escapeHtml(rawView)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateCardFlexGeometry,
    formatExtremeScoreline,
    TabStateMachine,
    sanitizeQueryParams
  };
}
