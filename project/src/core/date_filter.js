/**
 * ZetaSports Date Boundary & Calendar Filter Engine
 * Handles UTC rollover, leap year transitions, timezone offsets, and strict calendar day isolation.
 */

/**
 * Determines whether a given year is a leap year according to the Gregorian calendar.
 * @param {number} year
 * @returns {boolean}
 */
function isLeapYear(year) {
  if (typeof year !== 'number' || isNaN(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Returns the number of days in a given month of a given year (1-based month).
 * @param {number} year 
 * @param {number} month 1 to 12
 * @returns {number}
 */
function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Formats a Date object, ISO string, or timestamp into a 'YYYY-MM-DD' calendar date key,
 * applying an optional timezone offset in minutes (e.g. +330 for IST, -300 for EST).
 * @param {Date|string|number} dateInput 
 * @param {number} [timezoneOffsetMinutes=0]
 * @returns {string} 'YYYY-MM-DD'
 */
function getDateKey(dateInput, timezoneOffsetMinutes = 0) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  // Apply offset in milliseconds to get local epoch time
  const offsetMs = (Number(timezoneOffsetMinutes) || 0) * 60 * 1000;
  const localDate = new Date(d.getTime() + offsetMs);

  const y = localDate.getUTCFullYear();
  const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Computes calendar day keys for Yesterday, Today, and Tomorrow relative to a reference date and timezone.
 * Accurately handles leap years, month rollovers, and year rollovers.
 * @param {Date|string|number} [referenceDate=new Date()]
 * @param {number} [timezoneOffsetMinutes=0]
 * @returns {{ yesterday: string, today: string, tomorrow: string }}
 */
function getCalendarBoundaries(referenceDate = new Date(), timezoneOffsetMinutes = 0) {
  const ref = new Date(referenceDate);
  const baseTime = isNaN(ref.getTime()) ? Date.now() : ref.getTime();
  const offsetMs = (Number(timezoneOffsetMinutes) || 0) * 60 * 1000;
  
  // Calculate today's local date
  const todayDate = new Date(baseTime + offsetMs);
  const todayKey = `${todayDate.getUTCFullYear()}-${String(todayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(todayDate.getUTCDate()).padStart(2, '0')}`;

  // Subtract exactly 24 hours in local time
  const yesterdayDate = new Date(todayDate.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayKey = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getUTCDate()).padStart(2, '0')}`;

  // Add exactly 24 hours in local time
  const tomorrowDate = new Date(todayDate.getTime() + (24 * 60 * 60 * 1000));
  const tomorrowKey = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getUTCDate()).padStart(2, '0')}`;

  return {
    yesterday: yesterdayKey,
    today: todayKey,
    tomorrow: tomorrowKey
  };
}

/**
 * Checks whether two dates resolve to the same calendar day in the given timezone.
 * @param {Date|string|number} date1 
 * @param {Date|string|number} date2 
 * @param {number} [timezoneOffsetMinutes=0]
 * @returns {boolean}
 */
function isSameCalendarDay(date1, date2, timezoneOffsetMinutes = 0) {
  const k1 = getDateKey(date1, timezoneOffsetMinutes);
  const k2 = getDateKey(date2, timezoneOffsetMinutes);
  return Boolean(k1 && k2 && k1 === k2);
}

/**
 * Filters a list of matches by calendar date tabs ('yesterday', 'today', 'tomorrow', 'live', 'all').
 * Guarantees strict non-overlapping day boundaries and handles timezone shifts.
 * @param {Array<Object>} matches 
 * @param {string} filter 'yesterday' | 'today' | 'tomorrow' | 'live' | 'all'
 * @param {Date|string|number} [referenceDate=new Date()]
 * @param {number} [timezoneOffsetMinutes=0]
 * @returns {Array<Object>}
 */
function filterMatchesByDate(matches, filter = 'today', referenceDate = new Date(), timezoneOffsetMinutes = 0) {
  if (!Array.isArray(matches)) return [];
  const boundaries = getCalendarBoundaries(referenceDate, timezoneOffsetMinutes);
  const normFilter = (filter || 'today').toLowerCase().trim();

  return matches.filter(match => {
    if (!match) return false;

    // Filter unapproved matches out by default unless explicit
    if (match.is_approved === false) return false;

    const status = (match.status || '').toLowerCase();
    const isLive = status === 'live' || status === 'in_progress' || status === 'in_play' || match.is_live === true;

    if (normFilter === 'all') return true;
    if (normFilter === 'live') return isLive;

    const matchDateKey = getDateKey(match.date || match.kickoff_time, timezoneOffsetMinutes);
    if (!matchDateKey) {
      // If date is invalid or missing, only show in today if live
      return normFilter === 'today' && isLive;
    }

    if (normFilter === 'yesterday') {
      return matchDateKey === boundaries.yesterday;
    }

    if (normFilter === 'tomorrow') {
      return matchDateKey === boundaries.tomorrow;
    }

    // Default 'today'
    if (normFilter === 'today') {
      return matchDateKey === boundaries.today || isLive;
    }

    return false;
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isLeapYear,
    getDaysInMonth,
    getDateKey,
    getCalendarBoundaries,
    isSameCalendarDay,
    filterMatchesByDate
  };
}
