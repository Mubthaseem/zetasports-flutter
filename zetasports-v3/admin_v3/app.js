// ==============================================================================
// Resilient Multi-Tier Auth Storage (localStorage with sessionStorage fallback)
// ==============================================================================
const AuthStorage = {
  get(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch (e) {
      console.warn('[AuthStorage] localStorage read error:', e);
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn('[AuthStorage] sessionStorage read error:', e);
    }
    return null;
  },
  set(key, val) {
    let savedInLocal = false;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        savedInLocal = true;
      }
    } catch (e) {
      console.warn('[AuthStorage] localStorage write error, falling back to sessionStorage:', e);
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, val);
      }
    } catch (e) {
      if (!savedInLocal) {
        console.error('[AuthStorage] Both localStorage and sessionStorage write failed:', e);
      }
    }
  },
  remove(key) {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (_) {}
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); } catch (_) {}
  },
  clear() {
    const keys = [
      'zeta_bearer_token',
      'zeta_admin_user',
      'zeta_blogger_config',
      'zeta_blogger_connected'
    ];
    keys.forEach(k => {
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch (_) {}
      try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(k); } catch (_) {}
    });
  }
};
if (typeof window !== 'undefined') {
  window.AuthStorage = AuthStorage;
}

function isTokenExpired(token) {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decodeFn = (typeof atob === 'function')
      ? atob
      : (str) => Buffer.from(str, 'base64').toString('utf-8');
    const jsonStr = decodeFn(base64);
    const payload = JSON.parse(jsonStr);
    if (payload && typeof payload.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      return payload.exp <= nowSec;
    }
    return false;
  } catch (_) {
    return true;
  }
}
if (typeof window !== 'undefined') {
  window.isTokenExpired = isTokenExpired;
}

// Decoupled API URL & Bearer Token Helpers
function getApiUrl(path) {
  const base = (window.ZETA_CONFIG && window.ZETA_CONFIG.API_BASE_URL) ? window.ZETA_CONFIG.API_BASE_URL.replace(/\/+$/, '') : '';
  return base + path;
}

function getAuthHeaders(extraHeaders = {}) {
  const token = AuthStorage.get('zeta_bearer_token');
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}
if (typeof window !== 'undefined') {
  window.getApiUrl = getApiUrl;
  window.getAuthHeaders = getAuthHeaders;
}

// Cross-Tab Logout Synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'zeta_bearer_token' && !event.newValue) {
      console.log('[AuthStorage] Session terminated in another tab. Locking dashboard.');
      AuthStorage.clear();
      if (typeof lockDashboard === 'function') {
        lockDashboard();
      }
      if (typeof initGoogleIdentity === 'function') {
        initGoogleIdentity();
      }
    }
  });
}

// ==============================================================================
// ZetaSports Admin Portal v3 Client Application Logic
// Blogger API Auto-Poster, Nano Banana 2 AI Studio & Matches Manager
const WHITELISTED_LEAGUES = [
  'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1',
  'UEFA Champions League', 'UEFA Europa League', 'UEFA Europa Conference League',
  'FA Cup', 'EFL Cup', 'Copa del Rey', 'DFB Pokal', 'Coppa Italia',
  'Coupe de France', 'Supercopa de Espana', 'DFL Supercup', 'Supercoppa Italiana',
  'Trophee des Champions', 'FA Community Shield', 'UEFA Super Cup',
  'FIFA Club World Cup', 'MLS', 'Saudi Pro League', 'Brasileirao Serie A',
  'Eredivisie', 'Liga Portugal', 'Super Lig', 'Scottish Premiership',
  'Championship', 'Copa Libertadores', 'Copa Sudamericana', 'AFC Champions League',
  'Indian Super League', 'SAFF Championship', 'A-League', 'World Cup'
];

let allMatches = [];
let allStreams = [];
let bloggerConfig = {};

// --- INITIALIZATION ---
async function ensureBackendConfig() {
  if (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_ANON_KEY && window.ZETA_CONFIG.SUPABASE_ANON_KEY.length > 5) {
    return window.ZETA_CONFIG;
  }
  try {
    const res = await fetch(getApiUrl('/api/auth/config'));
    if (res.ok) {
      const data = await res.json();
      window.ZETA_CONFIG = window.ZETA_CONFIG || {};
      if (data.clientId) window.ZETA_CONFIG.GOOGLE_CLIENT_ID = data.clientId;
      if (data.supabaseAnonKey) window.ZETA_CONFIG.SUPABASE_ANON_KEY = data.supabaseAnonKey;
      if (data.supabaseHost) window.ZETA_CONFIG.SUPABASE_URL = `https://${data.supabaseHost}`;
    }
  } catch (err) {
    console.warn('[ZetaConfig] Could not fetch remote backend config:', err);
  }
  return window.ZETA_CONFIG;
}

// Synchronously restore cached Blogger auth state from localStorage to eliminate UI flicker (0ms delay)
function restoreCachedBloggerState() {
  try {
    const cachedConnected = AuthStorage.get('zeta_blogger_connected') || (typeof localStorage !== 'undefined' ? localStorage.getItem('zeta_blogger_connected') : null);
    const cachedConfigStr = AuthStorage.get('zeta_blogger_config') || (typeof localStorage !== 'undefined' ? localStorage.getItem('zeta_blogger_config') : null);
    if (cachedConfigStr) {
      try {
        const parsed = JSON.parse(cachedConfigStr);
        if (parsed && typeof parsed === 'object') {
          bloggerConfig = Object.assign({}, bloggerConfig, parsed);
        }
      } catch (_) {}
    }

    if (cachedConnected === 'true' || (bloggerConfig && (bloggerConfig.accessToken || bloggerConfig.isConnected))) {
      const dot = document.getElementById('bloggerDot');
      const txt = document.getElementById('bloggerStatusText');
      const oauthBadge = document.getElementById('oauthStatusBadge');
      if (dot) {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
      }
      if (txt) {
        txt.innerText = 'Blogger Connected';
      }
      if (oauthBadge) {
        oauthBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300';
        oauthBadge.innerText = 'Connected';
      }
    }
  } catch (_) {}
}
if (typeof window !== 'undefined') {
  window.restoreCachedBloggerState = restoreCachedBloggerState;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Synchronously restore cached Blogger connection state immediately (0ms visual flicker)
  restoreCachedBloggerState();

  initNavigation();
  setupEventListeners();

  // 0. Ensure backend configuration (credentials & endpoints) is loaded immediately
  await ensureBackendConfig();

  // 1. Authenticate with Google First
  const isAuth = await checkAuthStatus();
  if (!isAuth) {
    console.log('[Admin Portal] Unauthenticated. Google Login Gate active.');
    return;
  }

  // 2. Only if authenticated and not already loaded, load dashboard data
  if (!isDashboardDataLoaded) {
    isDashboardDataLoaded = true;
    initBloggerConfig();
    await Promise.all([loadMatches(), loadStreams()]);
    renderLeaguesGrid();
    initSettingsHub();
    initAuditLogs();
  }
});

// --- URL ROUTING & NAVIGATION TABS ---
const ROUTE_TITLES = {
  'dashboard': 'Dashboard Overview',
  'matches': 'Matches Manager & Blogger Auto-Poster',
  'streams': 'Universal Streams & Server Switcher',
  'blogger-config': 'Blogger API v3 & Gemini AI Studio',
  'leagues': '35 Whitelisted Competitions',
  'settings-hub': '100 Enterprise Settings Hub',
  'audit-logs': 'Security & Immutable Audit Logs'
};

const ROUTE_ALIASES = {
  '': 'dashboard',
  'dashboard': 'dashboard',
  'home': 'dashboard',
  'matches': 'matches',
  'match': 'matches',
  'streams': 'streams',
  'stream': 'streams',
  'blogger': 'blogger-config',
  'blogger-config': 'blogger-config',
  'ai-studio': 'blogger-config',
  'leagues': 'leagues',
  'competitions': 'leagues',
  'settings': 'settings-hub',
  'settings-hub': 'settings-hub',
  'audit': 'audit-logs',
  'audit-logs': 'audit-logs'
};

function getRouteFromUrl() {
  const path = (window.location.pathname || '').replace(/^\/+/, '').split('/')[0].toLowerCase();
  const hash = (window.location.hash || '').replace(/^#\/?/, '').split('/')[0].toLowerCase();
  const raw = path && path !== 'index.html' ? path : (hash || 'dashboard');
  return ROUTE_ALIASES[raw] || 'dashboard';
}

// --- MOBILE OFFCANVAS DRAWER CONTROLS ---
function openMobileSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('sidebarMobileBackdrop');
  if (sidebar) {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
  }
  if (backdrop) {
    backdrop.classList.remove('hidden');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('sidebarMobileBackdrop');
  if (sidebar) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
  }
  if (backdrop) {
    backdrop.classList.add('hidden');
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  if (sidebar && sidebar.classList.contains('translate-x-0')) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

function navigateToTab(tabId, updateUrl = true) {
  const targetTab = ROUTE_ALIASES[tabId] || (ROUTE_TITLES[tabId] ? tabId : 'dashboard');
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.tab-content');
  const titleEl = document.getElementById('currentSectionTitle');
  const mobileTitleEl = document.getElementById('mobileSectionTitle');

  navButtons.forEach(b => {
    b.classList.remove('active', 'bg-zinc-800', 'text-zinc-100', 'bg-[#0062b2]', 'text-white');
    b.classList.add('text-zinc-400');
    const icon = b.querySelector('svg');
    if (icon) { icon.classList.remove('text-zinc-100', 'text-sky-300'); icon.classList.add('text-zinc-400'); }
  });

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${targetTab}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-zinc-800', 'text-zinc-100');
    activeBtn.classList.remove('text-zinc-400');
    const activeIcon = activeBtn.querySelector('svg');
    if (activeIcon) { activeIcon.classList.add('text-zinc-100'); activeIcon.classList.remove('text-zinc-400'); }
  }

  sections.forEach(sec => sec.classList.add('hidden'));
  const activeSection = document.getElementById(`tab-${targetTab}`);
  if (activeSection) activeSection.classList.remove('hidden');

  if (titleEl) titleEl.innerText = ROUTE_TITLES[targetTab] || 'Admin Portal v3';

  // Synchronize mobile top bar section title
  if (mobileTitleEl) {
    const shortTitles = {
      'dashboard': 'Dashboard',
      'matches': 'Match Center',
      'streams': 'Streams',
      'blogger-config': 'Blogger & AI',
      'leagues': 'Competitions',
      'settings-hub': 'Settings Hub',
      'audit-logs': 'Audit Logs'
    };
    mobileTitleEl.innerText = shortTitles[targetTab] || ROUTE_TITLES[targetTab] || 'ZetaAdmin';
  }

  // Auto-close mobile drawer on navigation
  closeMobileSidebar();

  if (updateUrl) {
    const newPath = targetTab === 'dashboard' ? '/' : `/${targetTab}`;
    if (window.location.pathname !== newPath) {
      try {
        window.history.pushState({ tab: targetTab }, '', newPath);
      } catch (_) {
        window.location.hash = targetTab;
      }
    }
  }
}

function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');

  // Hamburger toggle button on mobile top bar
  const toggleBtn = document.getElementById('mobileMenuToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileSidebar();
    });
  }

  // Mobile sidebar backdrop overlay tap to close
  const backdrop = document.getElementById('sidebarMobileBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeMobileSidebar();
    });
  }

  // Close button inside sidebar header on mobile
  const closeSidebarBtn = document.getElementById('closeMobileSidebarBtn');
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
      closeMobileSidebar();
    });
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      navigateToTab(tabId, true);
    });
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', (e) => {
    const route = (e.state && e.state.tab) || getRouteFromUrl();
    navigateToTab(route, false);
  });

  // Handle direct URL navigation on initial load (e.g. /matches or /streams)
  const initialRoute = getRouteFromUrl();
  navigateToTab(initialRoute, false);

  // Quick settings link
  const quickBtn = document.getElementById('openSettingsQuickBtn');
  if (quickBtn) {
    quickBtn.addEventListener('click', () => {
      navigateToTab('blogger-config', true);
    });
  }

  // Dashboard shortcuts
  const dashGoMatches = document.getElementById('dashGoMatchesBtn');
  if (dashGoMatches) {
    dashGoMatches.addEventListener('click', () => {
      navigateToTab('matches', true);
    });
  }
}

// --- BLOGGER CONFIGURATION & STATUS ---
async function initBloggerConfig() {
  // Preload from AuthStorage / localStorage to eliminate status pill flicker
  restoreCachedBloggerState();

  try {
    const res = await fetch(getApiUrl('/api/blogger/config'), {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      bloggerConfig = await res.json();
      if (bloggerConfig && (bloggerConfig.accessToken || bloggerConfig.isConnected)) {
        const safeCache = {
          accessToken: bloggerConfig.accessToken || '',
          blogId: bloggerConfig.blogId || '',
          targetBlogIds: bloggerConfig.targetBlogIds || [],
          blogsList: bloggerConfig.blogsList || [],
          isConnected: true,
          detailsBlogDomain: bloggerConfig.detailsBlogDomain || '',
          streamBlogDomain: bloggerConfig.streamBlogDomain || '',
          thumbnailMode: bloggerConfig.thumbnailMode || 'auto'
        };
        AuthStorage.set('zeta_blogger_config', JSON.stringify(safeCache));
        AuthStorage.set('zeta_blogger_connected', 'true');
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('zeta_blogger_connected', 'true');
            localStorage.setItem('zeta_blogger_config', JSON.stringify(safeCache));
          }
        } catch (_) {}
      } else {
        AuthStorage.set('zeta_blogger_connected', 'false');
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('zeta_blogger_connected', 'false');
          }
        } catch (_) {}
      }
    }

    const idEl = document.getElementById('cfgBlogId');
    const tokenEl = document.getElementById('cfgAccessToken');
    const keyEl = document.getElementById('cfgApiKey');
    const geminiEl = document.getElementById('cfgGeminiKey');
    const bananaEl = document.getElementById('cfgUseNanoBanana');
    const detDomEl = document.getElementById('cfgDetailsDomain');
    const strmDomEl = document.getElementById('cfgStreamDomain');
    const displayClientEl = document.getElementById('displayClientId');

    if (tokenEl) tokenEl.value = bloggerConfig.accessToken || '';
    if (keyEl) keyEl.value = bloggerConfig.apiKey || '';
    if (geminiEl) geminiEl.value = bloggerConfig.geminiApiKey || '';
    if (bananaEl) bananaEl.checked = bloggerConfig.useNanoBananaThumbnail !== false;
    if (detDomEl) detDomEl.value = bloggerConfig.detailsBlogDomain || '';
    if (strmDomEl) strmDomEl.value = bloggerConfig.streamBlogDomain || '';
    const promptTplEl = document.getElementById('cfgPromptTemplate');
    if (promptTplEl) promptTplEl.value = bloggerConfig.thumbnailPromptTemplate || '';
    const modeEl = document.getElementById('cfgThumbnailMode');
    if (modeEl && bloggerConfig.thumbnailMode) modeEl.value = bloggerConfig.thumbnailMode;
    if (displayClientEl) {
      displayClientEl.innerText = bloggerConfig.clientId || (window.ZETA_CONFIG && window.ZETA_CONFIG.GOOGLE_CLIENT_ID) || '';
    }
    const redirectEl = document.getElementById('displayRedirectUri');
    if (redirectEl) {
      redirectEl.innerText = getApiUrl('/oauth2callback');
    }

    // Known Connected Blogs fallback
    const DEFAULT_KNOWN_BLOGS = [
      { id: '2859669537523181583', name: 'KERALA HUB', url: 'https://www.keralahub.online/' },
      { id: '1465102539101242447', name: 'ZETALIVE', url: 'https://zetasports.examsamachar.com/' },
      { id: '2353038694683351503', name: 'ZETA BLOG', url: 'https://dfffffffffw.blogspot.com/' },
      { id: '6844111716509853623', name: 'ZETA SPORTS LIVE', url: 'https://www.zetasports.live/' }
    ];

    if (!Array.isArray(bloggerConfig.blogsList) || bloggerConfig.blogsList.length === 0) {
      bloggerConfig.blogsList = DEFAULT_KNOWN_BLOGS;
    }

    // Resolve saved target blog IDs
    let savedTargetIds = [];
    if (Array.isArray(bloggerConfig.targetBlogIds) && bloggerConfig.targetBlogIds.length > 0) {
      savedTargetIds = bloggerConfig.targetBlogIds.map(String);
    } else if (bloggerConfig.blogId) {
      savedTargetIds = String(bloggerConfig.blogId).split(',').map(s => s.trim()).filter(Boolean);
    }

    // Populate Multi-Blog Checkbox List in Blogger Tab
    const blogsMultiContainer = document.getElementById('cfgBlogsMultiList');
    const countBadge = document.getElementById('cfgSelectedBlogsCount');
    const selectAllBtn = document.getElementById('cfgSelectAllBlogsBtn');
    const clearBtn = document.getElementById('cfgDeselectAllBlogsBtn');

    if (bloggerConfig.blogsList && bloggerConfig.blogsList.length > 0) {
      if (savedTargetIds.length === 0) {
        savedTargetIds = bloggerConfig.blogsList.map(b => String(b.id));
      }

      if (blogsMultiContainer) {
        blogsMultiContainer.innerHTML = bloggerConfig.blogsList.map(b => {
          const isChecked = savedTargetIds.includes(String(b.id));
          return `
            <label class="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/40 cursor-pointer transition-colors">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" class="cfg-target-blog-cb w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer" value="${b.id}" ${isChecked ? 'checked' : ''} />
                <div>
                  <span class="text-xs font-medium text-zinc-200 block">${b.name}</span>
                  <a href="${b.url}" target="_blank" rel="noopener noreferrer" class="text-[10px] text-zinc-500 hover:text-sky-400 truncate max-w-xs block">${b.url}</a>
                </div>
              </div>
              <code class="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800/80">${b.id}</code>
            </label>
          `;
        }).join('');
      }

      const syncMultiBlogUI = () => {
        const checkedBoxes = [...document.querySelectorAll('.cfg-target-blog-cb:checked')];
        const checkedIds = checkedBoxes.map(cb => cb.value);
        if (idEl) idEl.value = checkedIds.join(', ');
        if (countBadge) {
          countBadge.innerText = `${checkedIds.length} of ${bloggerConfig.blogsList.length} selected`;
          countBadge.className = checkedIds.length > 0
            ? 'text-[10px] text-emerald-400 font-mono font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20'
            : 'text-[10px] text-rose-400 font-mono font-medium bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20';
        }
      };

      document.querySelectorAll('.cfg-target-blog-cb').forEach(cb => {
        cb.addEventListener('change', syncMultiBlogUI);
      });

      if (selectAllBtn) {
        selectAllBtn.onclick = () => {
          document.querySelectorAll('.cfg-target-blog-cb').forEach(cb => cb.checked = true);
          syncMultiBlogUI();
        };
      }
      if (clearBtn) {
        clearBtn.onclick = () => {
          document.querySelectorAll('.cfg-target-blog-cb').forEach(cb => cb.checked = false);
          syncMultiBlogUI();
        };
      }

      if (idEl) {
        idEl.value = savedTargetIds.join(', ');
        idEl.oninput = () => {
          const typed = idEl.value.split(',').map(s => s.trim());
          document.querySelectorAll('.cfg-target-blog-cb').forEach(cb => {
            cb.checked = typed.includes(cb.value);
          });
          const checkedCount = document.querySelectorAll('.cfg-target-blog-cb:checked').length;
          if (countBadge) countBadge.innerText = `${checkedCount} of ${bloggerConfig.blogsList.length} selected`;
        };
      }

      syncMultiBlogUI();
    } else {
      if (idEl) idEl.value = bloggerConfig.blogId || '';
      if (blogsMultiContainer) {
        blogsMultiContainer.innerHTML = `
          <div class="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 text-xs text-zinc-400 text-center">
            No blogs detected yet. Click "Connect Google Account" or "Refresh Detected Blogs" after authorizing.
          </div>
        `;
      }
    }

    // Populate Match Center Multi-Blog target selector
    const targetBlogSelect = document.getElementById('matchTargetBlogSelect');
    if (targetBlogSelect && bloggerConfig.blogsList && bloggerConfig.blogsList.length > 0) {
      targetBlogSelect.innerHTML = `<option value="ALL">🎯 Target: All Connected Blogs (${bloggerConfig.blogsList.length})</option>` +
        bloggerConfig.blogsList.map(b => `<option value="${b.id}">${b.name} (${b.id})</option>`).join('');
    }

    // Populate Drawer Blog Checkboxes
    const drawerBlogsBox = document.getElementById('drawerBlogsCheckboxes');
    if (drawerBlogsBox && bloggerConfig.blogsList && bloggerConfig.blogsList.length > 0) {
      drawerBlogsBox.innerHTML = bloggerConfig.blogsList.map(b => `
        <label class="flex items-center gap-2 cursor-pointer py-0.5">
          <input type="checkbox" class="drawer-target-blog-cb w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-sky-400 cursor-pointer" value="${b.id}" checked />
          <span class="text-xs text-zinc-200">${b.name}</span>
          <span class="text-[10px] text-zinc-500 font-mono">(${b.id})</span>
        </label>
      `).join('');
    }

    updateStatusPills();
  } catch (err) {
    console.error('Error loading Blogger config:', err);
  }
}

function updateStatusPills() {
  const dot = document.getElementById('bloggerDot');
  const txt = document.getElementById('bloggerStatusText');
  const gemPill = document.getElementById('geminiStatusPill');
  const oauthBadge = document.getElementById('oauthStatusBadge');

  if (bloggerConfig.accessToken || bloggerConfig.isConnected) {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    if (txt) txt.innerText = 'Blogger Connected';
    if (oauthBadge) {
      oauthBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300';
      oauthBadge.innerText = 'Connected';
    }
  } else {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    if (txt) txt.innerText = 'Google Auth Required';
    if (oauthBadge) {
      oauthBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300';
      oauthBadge.innerText = 'Action Required';
    }
  }

  if (bloggerConfig.geminiApiKey && bloggerConfig.geminiApiKey.length > 10) {
    if (gemPill) {
      gemPill.className = 'hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300';
      gemPill.innerHTML = '<span>⚡ Nano Banana 2 Active</span>';
    }
  }
}

function getSupabaseAnonKey() {
  if (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_ANON_KEY && window.ZETA_CONFIG.SUPABASE_ANON_KEY.length > 5) {
    return window.ZETA_CONFIG.SUPABASE_ANON_KEY;
  }
  return '';
}

function get4DayWindow() {
  const now = new Date();
  // 1 day past (-1)
  const dMinus1 = new Date(now);
  dMinus1.setDate(now.getDate() - 1);
  const startStr = dMinus1.toISOString().split('T')[0] + 'T00:00:00.000Z';

  // 2 days future (+2)
  const dPlus2 = new Date(now);
  dPlus2.setDate(now.getDate() + 2);
  const endStr = dPlus2.toISOString().split('T')[0] + 'T23:59:59.999Z';

  return { startStr, endStr };
}

// --- LOAD MATCHES FROM SUPABASE ---
async function loadMatches() {
  try {
    await ensureBackendConfig();
    const { startStr, endStr } = get4DayWindow();
    const fields = 'id,home_team,away_team,home_logo,away_logo,league_name,league_id,date,kickoff_ist,home_score,away_score,status,minute,article_url,article_source,thumbnail_url,is_approved';
    const queryPath = `/rest/v1/zeta_matches?select=${fields}&date=gte.${startStr}&date=lte.${endStr}&order=date.asc`;
    
    const supaBase = (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_URL) ? window.ZETA_CONFIG.SUPABASE_URL : 'https://udlncusvhmydivtjkjcy.supabase.co';
    const anonKey = getSupabaseAnonKey();
    const headers = anonKey ? { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } : {};
    let res = await fetch(`${supaBase}${queryPath}`, { headers });
    let data = await res.json();

    // Fallback: If 4-day sliding window has 0 fixtures, fetch all most recent synced matches
    if (Array.isArray(data) && data.length === 0) {
      console.log('[loadMatches] 4-day window empty, loading all recent fixtures...');
      const fallbackQuery = `/rest/v1/zeta_matches?select=${fields}&order=date.desc&limit=100`;
      const fallbackRes = await fetch(`${supaBase}${fallbackQuery}`, { headers });
      const fallbackData = await fallbackRes.json();
      if (Array.isArray(fallbackData) && fallbackData.length > 0) {
        data = fallbackData;
      }
    }

    if (Array.isArray(data)) {
      allMatches = data;
      console.log('✔ Successfully loaded matches:', allMatches.length);
      populateLeagueFilter();
      renderMatches();
      updateDashboardMetrics();
    } else {
      console.error('Unexpected matches response:', data);
    }
  } catch (err) {
    console.error('Error fetching matches:', err);
    showToast('Failed to load matches: ' + err.message, 'error');
  }
}

// --- LOAD STREAMS ---
async function loadStreams() {
  try {
    await ensureBackendConfig();
    const supaBase = (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_URL) ? window.ZETA_CONFIG.SUPABASE_URL : 'https://udlncusvhmydivtjkjcy.supabase.co';
    const anonKey = getSupabaseAnonKey();
    const headers = anonKey ? { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } : {};
    const res = await fetch(`${supaBase}/rest/v1/zeta_streams?select=*`, { headers });
    const data = await res.json();
    if (Array.isArray(data)) {
      allStreams = data;
      renderStreamsTable();
      updateDashboardMetrics();
    }
  } catch (err) {
    console.error('Error fetching streams:', err);
  }
}

// --- HELPER TO GET POST URL ---
function getMatchPostUrl(m) {
  return m.post_url || m.article_url || '';
}

// --- DASHBOARD METRICS ---
function updateDashboardMetrics() {
  const total = allMatches.length;
  const approved = allMatches.filter(m => m.is_approved === true).length;
  const published = allMatches.filter(m => getMatchPostUrl(m).length > 5).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = allMatches.filter(m => {
    if (!m.date) return false;
    return m.date.includes(todayStr);
  }).length;

  const totalEl = document.getElementById('statTotalMatches');
  const appEl = document.getElementById('statApprovedMatches');
  const pubEl = document.getElementById('statPublishedMatches');
  const pubPctEl = document.getElementById('statPublishedPercent');
  const todayEl = document.getElementById('statTodayMatches');
  const streamEl = document.getElementById('statActiveStreams');

  if (totalEl) totalEl.innerText = total;
  if (appEl) appEl.innerText = approved;
  if (pubEl) pubEl.innerText = published;
  if (pubPctEl) pubPctEl.innerText = total > 0 ? `${Math.round((published / total) * 100)}%` : '0%';
  if (todayEl) todayEl.innerText = todayCount;
  if (streamEl) streamEl.innerText = allStreams.length;
}

// --- POPULATE LEAGUE FILTER ---
function populateLeagueFilter() {
  const filter = document.getElementById('matchLeagueFilter');
  if (!filter) return;

  const leagues = [...new Set(allMatches.map(m => m.league_name || m.league).filter(Boolean))].sort();
  filter.innerHTML = '<option value="ALL">All Competitions (' + leagues.length + ')</option>';
  leagues.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l;
    opt.innerText = l;
    filter.appendChild(opt);
  });
}

let selectedDateFilter = 'ALL';

// --- FORMAT MATCH DATE & TIME WITH RELATIVE BADGES (TODAY, TOMORROW, YESTERDAY, CALENDAR DATE) ---
function formatMatchDateTime(isoDate, istTime) {
  const fallbackTime = istTime || 'TBD';
  if (!isoDate) {
    return {
      dayLabel: '',
      shortDate: '',
      timeStr: fallbackTime,
      badgeHtml: '',
      fullLabel: fallbackTime
    };
  }

  const d = new Date(isoDate);
  if (isNaN(d.getTime())) {
    return {
      dayLabel: '',
      shortDate: '',
      timeStr: fallbackTime,
      badgeHtml: '',
      fullLabel: fallbackTime
    };
  }

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tom = new Date(now); tom.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tom.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();

  let dayLabel = '';
  let badgeStyle = '';
  const shortDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  if (isToday) {
    dayLabel = 'Today';
    badgeStyle = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
  } else if (isTomorrow) {
    dayLabel = 'Tomorrow';
    badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  } else if (isYesterday) {
    dayLabel = 'Yesterday';
    badgeStyle = 'bg-slate-700/50 text-slate-400 border-slate-600/30';
  } else {
    dayLabel = shortDate;
    badgeStyle = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  }

  const timeStr = istTime || d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const displayTag = (isToday || isTomorrow || isYesterday) ? `${dayLabel}, ${shortDate}` : shortDate;
  const badgeHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle} tracking-wide shrink-0 whitespace-nowrap">${displayTag}</span>`;

  return {
    dayLabel,
    shortDate,
    timeStr,
    badgeHtml,
    fullLabel: `${displayTag} • ${timeStr}`
  };
}

function getMatchLocalDateStr(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFilterLocalDateStr(filterType) {
  const d = new Date();
  if (filterType === 'YESTERDAY') d.setDate(d.getDate() - 1);
  else if (filterType === 'TODAY') { /* today */ }
  else if (filterType === 'TOMORROW') d.setDate(d.getDate() + 1);
  else if (filterType === 'DAY2') d.setDate(d.getDate() + 2);
  else return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateStringForFilter(filterType) {
  return getFilterLocalDateStr(filterType);
}

// --- RENDER MATCHES TABLE ---
// --- RENDER MATCHES VIEW MODES ---
let currentViewMode = 'board'; // 'board' (default Drag & Drop board), 'grid' (3-col cards), or 'table'
let activeDrawerPlayer = null;

// --- FOTMOB MATCH PRIORITY SCORER (MATCHES FOTMOB APP EXACT HIERARCHY) ---
const FOTMOB_PRIORITIES = {
  // Tier 1: World-Class / Major European
  '42': 1000,   // UEFA Champions League
  '47': 980,    // Premier League
  '87': 960,    // LaLiga
  '55': 940,    // Serie A
  '54': 920,    // Bundesliga
  '53': 900,    // Ligue 1
  '73': 850,    // UEFA Europa League
  '10216': 800, // UEFA Europa Conference League

  // Tier 2: Major Cups & Key Leagues
  '132': 780,   // FA Cup
  '138': 770,   // Copa del Rey
  '141': 760,   // Coppa Italia
  '209': 750,   // DFB-Pokal
  '133': 740,   // EFL Cup / Carabao
  '130': 720,   // Major League Soccer (MLS)
  '9474': 710,  // Saudi Pro League
  '48': 700,    // Championship

  // Tier 3: European Top-Flights & Continental
  '57': 680,    // Eredivisie
  '61': 670,    // Liga Portugal
  '268': 660,   // Brasileirao Serie A
  '71': 650,    // Super Lig
  '64': 640,    // Scottish Premiership
  '9536': 630,  // AFC Champions League Elite
  '9806': 620,  // UEFA Nations League
  'isl': 600,   // Indian Super League
  '9611': 600,  // Indian Super League FotMob ID
  '9537': 500   // AFC Champions League Two
};

function getFotmobMatchPriority(m) {
  let score = 0;
  const status = (m.status || '').toUpperCase();
  const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY', 'ET', 'P'].includes(status);
  const isUpcoming = ['SCHEDULED', 'NS', 'TIMED', 'NOT_STARTED'].includes(status) || !status || status === 'UPCOMING';

  // 1. Live matches always pinned on top (+20000), followed by upcoming (+10000), finished (+1000)
  if (isLive) score += 20000;
  else if (isUpcoming) score += 10000;
  else score += 1000;

  // 2. By league_id
  const lid = String(m.league_id || '').trim();
  if (FOTMOB_PRIORITIES[lid]) {
    score += FOTMOB_PRIORITIES[lid];
    return score;
  }

  // 3. By league_name fallback
  const lname = (m.league_name || m.league || '').toLowerCase();
  if (lname.includes('champions league') && !lname.includes('afc') && !lname.includes('women')) score += 1000;
  else if (lname === 'premier league' || (lname.includes('premier league') && !lname.includes('kazakhstan') && !lname.includes('crimean') && !lname.includes('faroe'))) score += 980;
  else if (lname.includes('laliga') || lname.includes('la liga')) score += 960;
  else if (lname.includes('serie a') && !lname.includes('serie a -') && !lname.includes('serie a1') && !lname.includes('serie c')) score += 940;
  else if (lname.includes('bundesliga') && !lname.includes('2.') && !lname.includes('3.')) score += 920;
  else if (lname.includes('ligue 1')) score += 900;
  else if (lname.includes('europa league')) score += 850;
  else if (lname.includes('conference league')) score += 800;
  else if (lname.includes('world cup') || lname.includes('nations league') || lname.includes('euro')) score += 790;
  else if (lname.includes('fa cup')) score += 780;
  else if (lname.includes('copa del rey')) score += 770;
  else if (lname.includes('coppa italia')) score += 760;
  else if (lname.includes('dfb pokal')) score += 750;
  else if (lname.includes('major league soccer') || lname.includes('mls')) score += 720;
  else if (lname.includes('saudi pro league')) score += 710;
  else if (lname.includes('championship')) score += 700;
  else if (lname.includes('eredivisie')) score += 680;
  else if (lname.includes('liga portugal')) score += 670;
  else if (lname.includes('afc champions league elite')) score += 630;
  else if (lname.includes('indian super league') || lname.includes('isl')) score += 600;
  else if (lname.includes('afc champions league')) score += 500;
  else score += 100;

  return score;
}

// --- MAIN RENDER FUNCTION: SUPPORTS DUAL-BOARD, GRID & TABLE ---
function renderMatches() {
  const boardView = document.getElementById('matchesBoardView');
  const gridEl = document.getElementById('matchesGrid');
  const tableWrapper = document.getElementById('matchesTableWrapper');
  const tbodyEl = document.getElementById('matchesTableBody');
  const availableList = document.getElementById('availableMatchesList');
  const mainDomainList = document.getElementById('mainDomainMatchesList');
  const availableCountBadge = document.getElementById('availableCountBadge');
  const listedCountBadge = document.getElementById('listedCountBadge');

  // Toggle view containers based on currentViewMode
  if (boardView && gridEl && tableWrapper) {
    if (currentViewMode === 'board') {
      boardView.classList.remove('hidden');
      gridEl.classList.add('hidden');
      tableWrapper.classList.add('hidden');
    } else if (currentViewMode === 'grid') {
      boardView.classList.add('hidden');
      gridEl.classList.remove('hidden');
      tableWrapper.classList.add('hidden');
    } else {
      boardView.classList.add('hidden');
      gridEl.classList.add('hidden');
      tableWrapper.classList.remove('hidden');
    }
  }

  const rawSearch = (document.getElementById('matchSearchInput')?.value || '').trim();
  const search = rawSearch.toLowerCase();
  const league = document.getElementById('matchLeagueFilter')?.value || 'ALL';
  const statusFilter = document.getElementById('matchStatusFilter')?.value || 'ALL';

  // Filter all matches based on search, league and date window
  let filtered = allMatches.filter(m => {
    const matchLeague = m.league_name || m.league || '';
    const matchStr = `${m.home_team || ''} ${m.away_team || ''} ${matchLeague}`.toLowerCase();
    if (search && !matchStr.includes(search)) return false;
    if (league !== 'ALL' && matchLeague !== league) return false;

    // Date Filter within 4-day window
    if (selectedDateFilter !== 'ALL') {
      const targetDate = getDateStringForFilter(selectedDateFilter);
      const matchLocalDate = getMatchLocalDateStr(m.date);
      if (targetDate && matchLocalDate && matchLocalDate !== targetDate) return false;
    }

    const postUrl = getMatchPostUrl(m);
    const isPosted = postUrl.length > 5;
    const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes((m.status || '').toUpperCase());

    if (currentViewMode !== 'board') {
      if (statusFilter === 'APPROVED' && !m.is_approved) return false;
      if (statusFilter === 'PENDING' && m.is_approved) return false;
    }
    if (statusFilter === 'POSTED' && !isPosted) return false;
    if (statusFilter === 'UNPOSTED' && isPosted) return false;
    if (statusFilter === 'LIVE' && !isLive) return false;

    return true;
  });

  // Sort by FotMob match priority rating (Live first, UCL/EPL/LaLiga Tier 1 first, lower leagues last)
  filtered.sort((a, b) => {
    const priorityDiff = getFotmobMatchPriority(b) - getFotmobMatchPriority(a);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.date || 0) - new Date(b.date || 0);
  });

  // Split into Available (is_approved === false) and Main Domain Listed (is_approved === true)
  const availableMatches = filtered.filter(m => !m.is_approved);
  const listedMatches = filtered.filter(m => m.is_approved === true);

  if (availableCountBadge) availableCountBadge.innerText = availableMatches.length;
  if (listedCountBadge) listedCountBadge.innerText = listedMatches.length;

  // Update header live indicator
  const liveCount = allMatches.filter(m => ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes((m.status || '').toUpperCase())).length;
  const liveText = document.getElementById('liveMatchesText');
  if (liveText) {
    liveText.innerText = liveCount > 0 ? `● ${liveCount} In-Play Live` : '● Live Stream Ready';
  }

  // =========================================================================
  // 1. RENDER DUAL-BOARD (DEFAULT WORKSPACE)
  // =========================================================================
  if (boardView) {
    // --- Render Available Matches List (Left Panel) ---
    if (availableList) {
      if (availableMatches.length === 0) {
        availableList.innerHTML = `
          <div class="py-12 text-center text-slate-500 bg-[#101827] border border-white/5 rounded-xl p-6">
            <div class="text-3xl mb-2">✨</div>
            <div class="text-xs font-bold text-slate-300">No unlisted fixtures available</div>
            <div class="text-[11px] text-slate-500 mt-1">All fixtures for this filter have been listed or none found.</div>
          </div>
        `;
      } else {
        availableList.innerHTML = availableMatches.map(m => {
          const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes((m.status || '').toUpperCase());
          const score = (m.home_score !== null && m.away_score !== null) ? `${m.home_score} - ${m.away_score}` : 'vs';
          const dt = formatMatchDateTime(m.date, m.kickoff_ist);

          return `
            <div class="draggable-card bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 shadow-sm transition-all group flex flex-col gap-2" draggable="true" data-id="${m.id}">
              <!-- Top Row: Competition, Match Date Badge & Kickoff -->
              <div class="flex items-center justify-between text-[11px] gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="cursor-grab text-zinc-500 group-hover:text-zinc-300 font-mono text-xs leading-none shrink-0" title="Drag this fixture to Main Domain">⠿</span>
                  <span class="font-medium text-zinc-300 truncate max-w-[130px]">${m.league_name || m.league || 'Football'}</span>
                </div>
                <div class="flex items-center gap-1.5 text-zinc-400 font-mono text-[10px] shrink-0">
                  ${dt.badgeHtml}
                  <span>${isLive ? `<span class="inline-flex items-center gap-1 text-emerald-400 font-medium"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-pulse"></span> ${m.minute || 'LIVE'}'</span>` : dt.timeStr}</span>
                </div>
              </div>

              <!-- Match Matchup Row -->
              <div class="flex items-center justify-between gap-2 cursor-pointer match-card-body py-0.5" data-id="${m.id}" title="Click to open Match Control Center">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <img src="${m.home_logo || 'https://via.placeholder.com/20'}" alt="" class="w-5 h-5 object-contain shrink-0" />
                  <span class="font-medium text-zinc-100 text-xs truncate" title="${m.home_team}">${m.home_team || 'Home'}</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] font-medium text-zinc-200 shrink-0">${score}</span>
                <div class="flex items-center justify-end gap-2 flex-1 min-w-0">
                  <span class="font-medium text-zinc-100 text-xs truncate text-right" title="${m.away_team}">${m.away_team || 'Away'}</span>
                  <img src="${m.away_logo || 'https://via.placeholder.com/20'}" alt="" class="w-5 h-5 object-contain shrink-0" />
                </div>
              </div>

              <!-- Bottom Row: Quick Add Button & Drawer Trigger -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                <button type="button" class="add-to-domain-btn min-h-[44px] px-3.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium text-xs shadow-sm transition-colors flex items-center gap-1.5" data-id="${m.id}" title="1-tap touch action to list on site without drag & drop">
                  <span>+ List on Site</span>
                </button>
                <button type="button" class="open-drawer-btn min-h-[44px] px-3 rounded-md border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 font-medium text-xs transition-colors flex items-center gap-1.5" data-id="${m.id}" title="Configure all settings for this match">
                  <span>⚙️ Settings</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // --- Render Main Domain Listed Matches (Right Panel) ---
    if (mainDomainList) {
      if (listedMatches.length === 0) {
        mainDomainList.innerHTML = `
          <div class="py-12 text-center text-slate-500 bg-[#101827] border border-white/5 rounded-xl p-6">
            <div class="text-3xl mb-2">📥</div>
            <div class="text-xs font-bold text-slate-300">No matches listed on Main Domain</div>
            <div class="text-[11px] text-slate-500 mt-1">Drag any match from Available (left) or click '+ List on Site' to broadcast here.</div>
          </div>
        `;
      } else {
        mainDomainList.innerHTML = listedMatches.map(m => {
          const postUrl = getMatchPostUrl(m);
          const hasPost = postUrl.length > 5;
          const isLive = ['1H', '2H', 'HT', 'LIVE', 'IN_PLAY'].includes((m.status || '').toUpperCase());
          const isFinished = ['FT', 'FINISHED'].includes((m.status || '').toUpperCase());
          const score = (m.home_score !== null && m.away_score !== null) ? `${m.home_score} - ${m.away_score}` : 'vs';
          const dt = formatMatchDateTime(m.date, m.kickoff_ist);

          let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-white/10 shrink-0">${m.status || 'Scheduled'}</span>`;
          if (isLive) {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-pulse"></span> ${m.minute || 'LIVE'}'</span>`;
          } else if (isFinished) {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">FT</span>`;
          }

          return `
            <div class="draggable-card bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 shadow-sm transition-all group flex flex-col gap-2" draggable="true" data-id="${m.id}">
              <!-- Top Row: Competition, Match Date, Status & Kickoff -->
              <div class="flex items-center justify-between text-[11px] gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-live-pulse shrink-0"></span>
                  <span class="font-medium text-zinc-200 truncate max-w-[130px]">${m.league_name || m.league || 'Football'}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  ${dt.badgeHtml}
                  ${statusBadge}
                  <span class="font-mono text-zinc-400 text-[10px]">${dt.timeStr}</span>
                </div>
              </div>

              <!-- Teams Matchup & Score (Click to open Drawer) -->
              <div class="flex items-center justify-between gap-2 cursor-pointer match-card-body py-0.5" data-id="${m.id}" title="Click to open Match Control Center">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <img src="${m.home_logo || 'https://via.placeholder.com/22'}" alt="" class="w-5 h-5 object-contain shrink-0" />
                  <span class="font-medium text-zinc-100 text-xs truncate" title="${m.home_team}">${m.home_team || 'Home'}</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] font-semibold text-emerald-400 shrink-0">${score}</span>
                <div class="flex items-center justify-end gap-2 flex-1 min-w-0">
                  <span class="font-medium text-zinc-100 text-xs truncate text-right" title="${m.away_team}">${m.away_team || 'Away'}</span>
                  <img src="${m.away_logo || 'https://via.placeholder.com/22'}" alt="" class="w-5 h-5 object-contain shrink-0" />
                </div>
              </div>

              <!-- Action Bar: Publish Status, Drawer Trigger, Unlist -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-xs">
                <div class="flex flex-wrap items-center gap-1.5">
                  ${hasPost
                    ? `<a href="${postUrl}" target="_blank" class="min-h-[44px] px-3 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center gap-1">
                        <span>View ↗</span>
                       </a>
                       <button type="button" class="sync-ft-btn min-h-[44px] min-w-[44px] rounded-md text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors flex items-center justify-center" data-id="${m.id}" title="Re-sync post">
                        <span>🔄</span>
                       </button>`
                    : `<button type="button" class="publish-btn min-h-[44px] px-3.5 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-900 shadow-sm transition-colors flex items-center gap-1.5" data-id="${m.id}">
                        <span>⚡ Publish</span>
                       </button>`
                  }
                  <button type="button" class="open-drawer-btn min-h-[44px] px-3 rounded-md border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 font-medium text-xs transition-colors flex items-center gap-1.5" data-id="${m.id}" title="Open full match settings (Streams, AI Thumbnail, Blogger)">
                    <span>⚙️ Studio</span>
                  </button>
                </div>

                <button type="button" class="remove-from-domain-btn min-h-[44px] px-3 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center gap-1" data-id="${m.id}" title="Unlist from Main Domain and return to Available Inbox (1-tap touch action)">
                  <span>✕ Unlist</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Attach Drag & Drop Event Listeners
    setupDragAndDrop();
  }

  // =========================================================================
  // 2. RENDER GRID VIEW (ALTERNATE 3-COL CARDS)
  // =========================================================================
  if (gridEl && currentViewMode === 'grid') {
    const isCapped = !search && statusFilter === 'ALL' && filtered.length > 9;
    const displayMatches = isCapped ? filtered.slice(0, 9) : filtered;

    if (displayMatches.length === 0) {
      gridEl.innerHTML = `<div class="col-span-full py-16 text-center text-slate-400">No fixtures match search.</div>`;
    } else {
      gridEl.innerHTML = displayMatches.map(m => {
        const postUrl = getMatchPostUrl(m);
        const hasPost = postUrl.length > 5;
        const score = (m.home_score !== null && m.away_score !== null) ? `${m.home_score} - ${m.away_score}` : 'vs';
        const dt = formatMatchDateTime(m.date, m.kickoff_ist);

        return `
          <div class="bg-[#101827] border border-white/5 rounded-2xl overflow-hidden shadow-md flex flex-col group" data-id="${m.id}">
            <div class="aspect-video relative overflow-hidden bg-slate-900 shrink-0 cursor-pointer open-drawer-btn" data-id="${m.id}">
              <img src="${m.thumbnail_url || (m.id ? `https://zetasports-live-worker.dennisnorwood812.workers.dev/api/poster?matchId=${m.id}` : 'https://via.placeholder.com/640x360?text=ZetaSports')}" alt="" class="w-full h-full object-cover" />
              <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/80 text-sky-300 border border-white/10">${m.league_name || 'Match'}</span>
                ${dt.badgeHtml}
              </div>
              <div class="absolute top-2.5 right-2.5">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-950/80 text-white border border-white/10">${dt.timeStr}</span>
              </div>
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div class="flex items-center justify-between gap-2 cursor-pointer open-drawer-btn" data-id="${m.id}">
                <span class="font-bold text-white text-xs truncate">${m.home_team}</span>
                <span class="px-2 py-0.5 rounded bg-black/40 font-mono text-xs font-bold text-sky-400">${score}</span>
                <span class="font-bold text-white text-xs truncate text-right">${m.away_team}</span>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                <button type="button" class="open-drawer-btn px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold" data-id="${m.id}">⚙️ Manage Match</button>
                ${hasPost ? `<a href="${postUrl}" target="_blank" class="text-emerald-400 font-bold">View ↗</a>` : `<button type="button" class="publish-btn text-sky-400 font-bold" data-id="${m.id}">Publish</button>`}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // =========================================================================
  // 3. RENDER TABLE VIEW (ALTERNATE SPREADSHEET)
  // =========================================================================
  if (tbodyEl && currentViewMode === 'table') {
    if (filtered.length === 0) {
      tbodyEl.innerHTML = `<tr><td colspan="7" class="px-5 py-8 text-center text-slate-500">No matches found.</td></tr>`;
    } else {
      tbodyEl.innerHTML = filtered.map(m => {
        const postUrl = getMatchPostUrl(m);
        const hasPost = postUrl.length > 5;
        const score = (m.home_score !== null && m.away_score !== null) ? `${m.home_score} - ${m.away_score}` : 'vs';
        const dt = formatMatchDateTime(m.date, m.kickoff_ist);

        return `
          <tr class="hover:bg-white/[0.02]">
            <td class="px-5 py-3 text-xs text-white">
              <div class="flex items-center gap-1.5">
                ${dt.badgeHtml}
                <span class="font-mono text-slate-300">${dt.timeStr}</span>
              </div>
            </td>
            <td class="px-5 py-3 text-xs text-sky-400">${m.league_name || 'Match'}</td>
            <td class="px-5 py-3 text-xs font-semibold text-white">${m.home_team} ${score} ${m.away_team}</td>
            <td class="px-5 py-3 text-xs text-slate-400">${m.status || 'Scheduled'}</td>
            <td class="px-5 py-3 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.is_approved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}">${m.is_approved ? '✔ Listed' : 'Available'}</span>
            </td>
            <td class="px-5 py-3 text-center">
              ${hasPost ? `<a href="${postUrl}" target="_blank" class="min-h-[44px] px-3 py-2 inline-flex items-center justify-center text-xs text-emerald-400 font-bold">View ↗</a>` : `<button type="button" class="publish-btn min-h-[44px] px-3 py-2 inline-flex items-center justify-center text-xs text-sky-400 font-bold" data-id="${m.id}">Publish</button>`}
            </td>
            <td class="px-5 py-3 text-right">
              <button type="button" class="open-drawer-btn min-h-[44px] px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-xs font-semibold text-white inline-flex items-center justify-center" data-id="${m.id}">⚙️ Settings</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Wire Card and Button Click Listeners
  wireCardActionListeners();
}

// --- DRAG AND DROP MECHANICS SETUP ---
function setupDragAndDrop() {
  const cards = document.querySelectorAll('.draggable-card');
  const dropZone = document.getElementById('mainDomainDropZone');
  const mainDomainList = document.getElementById('mainDomainMatchesList');
  const availableList = document.getElementById('availableMatchesList');

  // Dragstart / Dragend on each card
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      const matchId = card.getAttribute('data-id');
      e.dataTransfer.setData('text/plain', matchId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      if (dropZone) dropZone.classList.remove('drag-over');
    });
  });

  // Drop target: Main Domain Board (Drop to List)
  [dropZone, mainDomainList].forEach(targetEl => {
    if (!targetEl) return;
    targetEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropZone) dropZone.classList.add('drag-over');
    });

    targetEl.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && targetEl.contains(e.relatedTarget)) return;
      if (dropZone) dropZone.classList.remove('drag-over');
    });

    targetEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (dropZone) dropZone.classList.remove('drag-over');
      const matchId = e.dataTransfer.getData('text/plain');
      if (matchId) {
        await approveAndListMatch(matchId);
      }
    });
  });

  // Drop target: Available Matches List (Drop to Unlist)
  if (availableList) {
    availableList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    availableList.addEventListener('drop', async (e) => {
      e.preventDefault();
      const matchId = e.dataTransfer.getData('text/plain');
      if (matchId) {
        await revokeMatchListing(matchId);
      }
    });
  }
}

// --- APPROVE & LIST ON MAIN DOMAIN ---
async function approveAndListMatch(matchId) {
  const target = allMatches.find(m => String(m.id) === String(matchId));
  if (!target || target.is_approved === true) return;

  target.is_approved = true;
  renderMatches();
  updateDashboardMetrics();

  try {
    let patchSuccess = false;

    // 1. First attempt to update via Backend API Gateway (shields against CORS & client network issues)
    try {
      const gwRes = await fetch(getApiUrl(`/api/matches?id=eq.${encodeURIComponent(matchId)}`), {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_approved: true })
      });
      if (gwRes.ok) {
        patchSuccess = true;
      }
    } catch (e) {
      console.warn('[approveMatchListing] Gateway PATCH failed, trying direct Supabase:', e);
    }

    // 2. Fallback to direct Supabase REST if gateway was unreachable
    if (!patchSuccess) {
      const supaBase = (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_URL) ? window.ZETA_CONFIG.SUPABASE_URL : 'https://udlncusvhmydivtjkjcy.supabase.co';
      const anonKey = getSupabaseAnonKey();
      const headers = {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(anonKey ? { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } : {})
      };

      const patchRes = await fetch(`${supaBase}/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_approved: true })
      });
      if (!patchRes.ok) {
        throw new Error(`Supabase returned HTTP ${patchRes.status}`);
      }
    }

    // 3. Trigger 16:9 AI thumbnail generation in background if missing
    if (!target.thumbnail_url || target.thumbnail_url.length < 5) {
      fetch(getApiUrl('/api/blogger/approve-and-generate'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ matchId })
      }).then(r => r.json()).then(data => {
        if (data.thumbUrl) {
          target.thumbnail_url = data.thumbUrl;
          renderMatches();
        }
      }).catch(err => console.warn('Background thumbnail generation error:', err));
    }

    showToast(`✔ '${target.home_team} vs ${target.away_team}' listed on Main Domain!`, 'success');
  } catch (err) {
    console.error('Error approving match:', err);
    showToast('Failed to list match on server: ' + err.message, 'error');
  }
}

// --- UNLIST & REVOKE FROM MAIN DOMAIN ---
async function revokeMatchListing(matchId) {
  const target = allMatches.find(m => String(m.id) === String(matchId));
  if (!target || !target.is_approved) return;

  target.is_approved = false;
  renderMatches();
  updateDashboardMetrics();

  try {
    let patchSuccess = false;

    // 1. First attempt to update via Backend API Gateway
    try {
      const gwRes = await fetch(getApiUrl(`/api/matches?id=eq.${encodeURIComponent(matchId)}`), {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_approved: false })
      });
      if (gwRes.ok) {
        patchSuccess = true;
      }
    } catch (e) {
      console.warn('[revokeMatchListing] Gateway PATCH failed, trying direct Supabase:', e);
    }

    // 2. Direct Supabase Fallback
    if (!patchSuccess) {
      const supaBase = (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_URL) ? window.ZETA_CONFIG.SUPABASE_URL : 'https://udlncusvhmydivtjkjcy.supabase.co';
      const anonKey = getSupabaseAnonKey();
      const headers = {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(anonKey ? { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } : {})
      };

      const patchRes = await fetch(`${supaBase}/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_approved: false })
      });
      if (!patchRes.ok) {
        throw new Error(`Supabase returned HTTP ${patchRes.status}`);
      }
    }

    showToast(`Match unlisted and returned to Available Inbox.`, 'info');
  } catch (err) {
    console.error('Error unlisting match:', err);
    showToast('Failed to unlist match: ' + err.message, 'error');
  }
}

// --- WIRE CARD ACTION LISTENERS ---
function wireCardActionListeners() {
  // Add to main domain button
  document.querySelectorAll('.add-to-domain-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const matchId = btn.getAttribute('data-id');
      approveAndListMatch(matchId);
    });
  });

  // Remove from main domain button
  document.querySelectorAll('.remove-from-domain-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const matchId = btn.getAttribute('data-id');
      revokeMatchListing(matchId);
    });
  });

  // Open Drawer on match body click or Settings button click
  document.querySelectorAll('.open-drawer-btn, .match-card-body').forEach(el => {
    el.addEventListener('click', (e) => {
      // Ignore if child button was clicked
      if (e.target.closest('button') && !e.target.closest('.open-drawer-btn')) return;
      const matchId = el.getAttribute('data-id');
      if (matchId) openMatchControlDrawer(matchId);
    });
  });

  // Publish single match buttons
  document.querySelectorAll('.publish-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const matchId = btn.getAttribute('data-id');
      publishSingleMatch(matchId, btn);
    });
  });

  // Re-sync FT post buttons
  document.querySelectorAll('.sync-ft-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const matchId = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.innerHTML = `<span>⏳</span>`;
      try {
        const res = await fetch(getApiUrl('/api/blogger/finalize'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ matchId })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to sync');
        showToast('✔ Post updated with latest lineups & stats!', 'success');
        await loadMatches();
      } catch (err) {
        showToast('Sync error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = `<span>🔄</span>`;
      }
    });
  });
}

// =============================================================================
// UNIFIED MATCH CONTROL CENTER DRAWER CONTROLLERS
// =============================================================================
function openMatchControlDrawer(matchId) {
  const m = allMatches.find(x => String(x.id) === String(matchId));
  if (!m) return;

  const drawer = document.getElementById('matchControlDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (!drawer || !backdrop) return;

  // Set Hidden Match ID
  const idInput = document.getElementById('drawerMatchId');
  if (idInput) idInput.value = matchId;

  // Header info
  const titleEl = document.getElementById('drawerMatchTitle');
  const subtitleEl = document.getElementById('drawerMatchSubtitle');
  const dt = formatMatchDateTime(m.date, m.kickoff_ist);
  if (titleEl) titleEl.innerText = `${m.home_team || 'Home'} vs ${m.away_team || 'Away'}`;
  if (subtitleEl) subtitleEl.innerText = `${m.league_name || m.league || 'Tournament'} • 📅 ${dt.fullLabel}`;

  // Crests & Scores
  const homeLogo = document.getElementById('drawerHomeLogo');
  const awayLogo = document.getElementById('drawerHomeLogo');
  const homeTeam = document.getElementById('drawerHomeTeam');
  const awayTeam = document.getElementById('drawerAwayTeam');
  const scoreBadge = document.getElementById('drawerScoreBadge');
  const leagueBadge = document.getElementById('drawerLeagueBadge');
  const kickoffTime = document.getElementById('drawerKickoffTime');

  if (homeLogo) homeLogo.src = m.home_logo || 'https://via.placeholder.com/32';
  if (document.getElementById('drawerAwayLogo')) document.getElementById('drawerAwayLogo').src = m.away_logo || 'https://via.placeholder.com/32';
  if (homeTeam) homeTeam.innerText = m.home_team || 'Home';
  if (awayTeam) awayTeam.innerText = m.away_team || 'Away';
  if (scoreBadge) scoreBadge.innerText = (m.home_score !== null && m.away_score !== null) ? `${m.home_score} - ${m.away_score}` : 'VS';
  if (leagueBadge) leagueBadge.innerText = m.league_name || m.league || 'Competition';
  if (kickoffTime) kickoffTime.innerText = `${m.date ? m.date.split('T')[0] : 'Today'} • ${m.kickoff_ist || m.time || 'TBD'}`;

  // Main Domain Switch
  const approvedSwitch = document.getElementById('drawerApprovedSwitch');
  if (approvedSwitch) approvedSwitch.checked = m.is_approved === true;

  // Broadcast Streams
  const streamRecord = allStreams.find(s => String(s.match_id) === String(matchId));
  const s1Input = document.getElementById('drawerServer1');
  const s2Input = document.getElementById('drawerServer2');
  const s3Input = document.getElementById('drawerServer3');

  if (s1Input) s1Input.value = streamRecord?.server1_url || streamRecord?.stream_url || '';
  if (s2Input) s2Input.value = streamRecord?.server2_url || '';
  if (s3Input) s3Input.value = streamRecord?.server3_url || '';

  // Hide live video player wrapper initially
  const playerWrapper = document.getElementById('drawerPlayerWrapper');
  if (playerWrapper) playerWrapper.classList.add('hidden');
  destroyDrawerPlayer();

  // AI Thumbnail Studio
  const thumbImg = document.getElementById('drawerThumbImg');
  const thumbEmpty = document.getElementById('drawerThumbEmptyPrompt');
  const customUrlInput = document.getElementById('drawerCustomThumbUrl');

  if (customUrlInput) customUrlInput.value = m.article_image || '';
  const posterUrl = m.thumbnail_url || (m.id ? `https://zetasports-live-worker.dennisnorwood812.workers.dev/api/poster?matchId=${m.id}` : '');
  if (posterUrl && posterUrl.length > 5) {
    if (thumbImg) { thumbImg.src = posterUrl; thumbImg.classList.remove('hidden'); }
    if (thumbEmpty) thumbEmpty.classList.add('hidden');
  } else {
    if (thumbImg) { thumbImg.src = ''; thumbImg.classList.add('hidden'); }
    if (thumbEmpty) thumbEmpty.classList.remove('hidden');
  }

  // Google Blogger Suite
  const postUrl = getMatchPostUrl(m);
  const hasPost = postUrl.length > 5;
  const statusBadge = document.getElementById('drawerPostStatusBadge');
  const publishBtn = document.getElementById('drawerPublishBtn');
  const viewPostBtn = document.getElementById('drawerViewPostBtn');
  const syncFtBtn = document.getElementById('drawerSyncFtBtn');
  const deletePostBtn = document.getElementById('drawerDeletePostBtn');
  const tokenCode = document.getElementById('drawerTokenCode');
  const postUrlInput = document.getElementById('drawerPostUrlInput');

  if (tokenCode) tokenCode.innerText = `zeta:${m.id}`;
  if (postUrlInput) postUrlInput.value = postUrl || '';

  if (hasPost) {
    if (statusBadge) {
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300';
      statusBadge.innerText = 'Published ✔';
    }
    if (publishBtn) publishBtn.classList.add('hidden');
    if (viewPostBtn) { viewPostBtn.classList.remove('hidden'); viewPostBtn.href = postUrl; }
    if (syncFtBtn) syncFtBtn.classList.remove('hidden');
    if (deletePostBtn) deletePostBtn.classList.remove('hidden');
  } else {
    if (statusBadge) {
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-400';
      statusBadge.innerText = 'Unpublished';
    }
    if (publishBtn) publishBtn.classList.remove('hidden');
    if (viewPostBtn) viewPostBtn.classList.add('hidden');
    if (syncFtBtn) syncFtBtn.classList.add('hidden');
    if (deletePostBtn) deletePostBtn.classList.add('hidden');
  }

  // Show Drawer
  backdrop.classList.add('open');
  drawer.classList.add('open');
}

function closeMatchControlDrawer() {
  const drawer = document.getElementById('matchControlDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  destroyDrawerPlayer();
}

function destroyDrawerPlayer() {
  if (activeDrawerPlayer) {
    try { activeDrawerPlayer.destroy(); } catch (e) {}
    activeDrawerPlayer = null;
  }
  const video = document.getElementById('drawerVideoPlayer');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

function initMatchControlDrawerControls() {
  const closeBtn = document.getElementById('closeMatchControlDrawerBtn');
  const backdrop = document.getElementById('drawerBackdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeMatchControlDrawer);
  if (backdrop) backdrop.addEventListener('click', closeMatchControlDrawer);

  // Main Domain Switch Listener
  const approvedSwitch = document.getElementById('drawerApprovedSwitch');
  if (approvedSwitch) {
    approvedSwitch.addEventListener('change', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      if (!matchId) return;
      if (approvedSwitch.checked) {
        await approveAndListMatch(matchId);
      } else {
        await revokeMatchListing(matchId);
      }
    });
  }

  // Save Broadcast Streams
  const saveStreamsBtn = document.getElementById('drawerSaveStreamsBtn');
  if (saveStreamsBtn) {
    saveStreamsBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      const s1 = document.getElementById('drawerServer1')?.value.trim();
      const s2 = document.getElementById('drawerServer2')?.value.trim();
      const s3 = document.getElementById('drawerServer3')?.value.trim();

      if (!matchId) return;

      saveStreamsBtn.disabled = true;
      saveStreamsBtn.innerHTML = `<span>⏳ Saving Streams...</span>`;

      try {
        const supaBase = (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_URL) ? window.ZETA_CONFIG.SUPABASE_URL : 'https://udlncusvhmydivtjkjcy.supabase.co';
        const anonKey = getSupabaseAnonKey();
        const headers = {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
          ...(anonKey ? { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } : {})
        };

        const payload = {
          match_id: matchId,
          server1_url: s1 || null,
          stream_url: s1 || null,
          server2_url: s2 || null,
          server3_url: s3 || null,
          updated_at: new Date().toISOString()
        };

        const res = await fetch(`${supaBase}/rest/v1/zeta_streams`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to update streams in Supabase');

        // Update local streams state
        const idx = allStreams.findIndex(s => String(s.match_id) === String(matchId));
        if (idx >= 0) allStreams[idx] = { ...allStreams[idx], ...payload };
        else allStreams.push(payload);

        showToast('✔ Stream channels saved successfully!', 'success');
        updateDashboardMetrics();
      } catch (err) {
        showToast('Stream save error: ' + err.message, 'error');
      } finally {
        saveStreamsBtn.disabled = false;
        saveStreamsBtn.innerHTML = `<span>💾 Save Stream Links</span>`;
      }
    });
  }

  // Copy Link Selection URL (Full-Page Refresh to Blog 1)
  const copyLinksUrlBtn = document.getElementById('drawerCopyLinksUrlBtn');
  if (copyLinksUrlBtn) {
    copyLinksUrlBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      if (!matchId) return;

      const rawDetailsDomain = (bloggerConfig?.detailsBlogDomain || document.getElementById('cfgDetailsDomain')?.value || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
      const domain = rawDetailsDomain ? `https://${rawDetailsDomain}` : (window.location.origin || 'https://www.keralahub.online');
      const linksUrl = `${domain}/?links=${encodeURIComponent(matchId)}`;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(linksUrl);
        } else {
          const ta = document.createElement('textarea');
          ta.value = linksUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        showToast('✔ Link Selection URL copied: ' + linksUrl, 'success');
      } catch (err) {
        prompt('Copy Link Selection URL:', linksUrl);
      }
    });
  }

  // Copy Live Stream Player URL (Full-Page Refresh to Blog 2)
  const copyStreamUrlBtn = document.getElementById('drawerCopyStreamUrlBtn');
  if (copyStreamUrlBtn) {
    copyStreamUrlBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      if (!matchId) return;

      const rawStreamDomain = (bloggerConfig?.streamBlogDomain || document.getElementById('cfgStreamDomain')?.value || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
      const domain = rawStreamDomain ? `https://${rawStreamDomain}` : (window.location.origin || 'https://www.zetasports.live');
      const streamUrl = `${domain}/?stream=${encodeURIComponent(matchId)}`;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(streamUrl);
        } else {
          const ta = document.createElement('textarea');
          ta.value = streamUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        showToast('✔ Stream Player URL copied: ' + streamUrl, 'success');
      } catch (err) {
        prompt('Copy Stream URL:', streamUrl);
      }
    });
  }

  // Live Stream Player Tester
  const testStreamBtn = document.getElementById('drawerTestStreamBtn');
  if (testStreamBtn) {
    testStreamBtn.addEventListener('click', () => {
      const s1 = document.getElementById('drawerServer1')?.value.trim();
      const playerWrapper = document.getElementById('drawerPlayerWrapper');
      const video = document.getElementById('drawerVideoPlayer');

      if (!s1) {
        showToast('Please enter Server 1 stream URL (.m3u8) to test player', 'warning');
        return;
      }

      if (playerWrapper) playerWrapper.classList.remove('hidden');
      destroyDrawerPlayer();

      if (Hls.isSupported() && s1.includes('.m3u8')) {
        const hls = new Hls();
        hls.loadSource(s1);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
        activeDrawerPlayer = hls;
      } else {
        video.src = s1;
        video.play();
      }

      showToast('▶️ Testing stream in live admin player...', 'info');
    });
  }

  // 16:9 Thumbnail Presets
  document.querySelectorAll('.drawer-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      const input = document.getElementById('drawerCustomThumbUrl');
      if (input) input.value = url;
    });
  });

  // Generate 16:9 AI Thumbnail from Drawer
  const generateThumbBtn = document.getElementById('drawerGenerateThumbBtn');
  if (generateThumbBtn) {
    generateThumbBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      const rightImageUrl = document.getElementById('drawerCustomThumbUrl')?.value.trim();
      const mode = document.getElementById('drawerThumbMode')?.value || 'auto';

      if (!matchId) return;

      generateThumbBtn.disabled = true;
      generateThumbBtn.innerHTML = `<span class="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span> Generating 16:9 AI Poster...`;

      try {
        let endpoint = '/api/blogger/approve-and-generate';
        let bodyPayload = { matchId };

        if (rightImageUrl && rightImageUrl.length > 5) {
          endpoint = '/api/thumbnail/customize-right-image';
          bodyPayload = { matchId, rightImageUrl, mode };
        }

        const res = await fetch(getApiUrl(endpoint), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(bodyPayload)
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Thumbnail generation failed');

        const newThumb = data.thumbUrl || data.thumbnailUrl;
        const target = allMatches.find(m => String(m.id) === String(matchId));
        if (target) {
          target.thumbnail_url = newThumb;
          if (rightImageUrl) target.article_image = rightImageUrl;
        }

        const thumbImg = document.getElementById('drawerThumbImg');
        const thumbEmpty = document.getElementById('drawerThumbEmptyPrompt');
        if (thumbImg) { thumbImg.src = newThumb; thumbImg.classList.remove('hidden'); }
        if (thumbEmpty) thumbEmpty.classList.add('hidden');

        showToast('✔ Broadcast 16:9 AI thumbnail generated!', 'success');
        renderMatches();
      } catch (err) {
        showToast('Thumbnail error: ' + err.message, 'error');
      } finally {
        generateThumbBtn.disabled = false;
        generateThumbBtn.innerHTML = `<span>⚡ Generate 16:9 AI Poster</span>`;
      }
    });
  }

  // Publish from Drawer
  const drawerPublishBtn = document.getElementById('drawerPublishBtn');
  if (drawerPublishBtn) {
    drawerPublishBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      if (!matchId) return;
      await publishSingleMatch(matchId, drawerPublishBtn);
      openMatchControlDrawer(matchId); // refresh drawer state
    });
  }

  // Copy Full 17-Component Live Post HTML from Drawer
  const drawerCopyPostHtmlBtn = document.getElementById('drawerCopyPostHtmlBtn');
  if (drawerCopyPostHtmlBtn) {
    drawerCopyPostHtmlBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      if (!matchId) {
        showToast('No match selected in drawer.', 'error');
        return;
      }

      const originalHtml = drawerCopyPostHtmlBtn.innerHTML;
      drawerCopyPostHtmlBtn.disabled = true;
      drawerCopyPostHtmlBtn.innerHTML = `<span class="inline-block animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span> <span>Generating HTML...</span>`;

      try {
        let postHtml = '';

        // 1. Primary: Request 17-component markup from Backend API Gateway (/api/blogger/preview-html or /api/blogger/generate-html)
        const endpointsToTry = ['/api/blogger/preview-html', '/api/blogger/generate-html'];
        for (const ep of endpointsToTry) {
          try {
            const res = await fetch(getApiUrl(ep), {
              method: 'POST',
              headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
              credentials: 'include',
              body: JSON.stringify({ matchId })
            });
            if (res.ok) {
              const data = await res.json();
              if (data && (data.html || data.content)) {
                postHtml = data.html || data.content;
                break;
              }
            }
          } catch (apiErr) {
            console.warn(`[Copy Post HTML]: Gateway endpoint ${ep} failed:`, apiErr);
          }
        }

        // 2. Client-side PostgREST fallback: Query Supabase directly if backend is offline or returned empty
        if (!postHtml) {
          console.info('[Copy Post HTML]: Backend gateway unavailable or empty response. Falling back to direct Supabase PostgREST...');
          const supaBase = (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_URL) ? window.ZETA_CONFIG.SUPABASE_URL : 'https://udlncusvhmydivtjkjcy.supabase.co';
          const anonKey = getSupabaseAnonKey();
          const sRes = await fetch(`${supaBase}/rest/v1/zeta_matches?id=eq.${encodeURIComponent(matchId)}&select=*`, {
            headers: anonKey ? { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } : {}
          });
          if (!sRes.ok) throw new Error(`Supabase PostgREST returned HTTP ${sRes.status}`);
          const sData = await sRes.json();
          if (Array.isArray(sData) && sData.length > 0) {
            postHtml = generateClientPostHtmlFallback(sData[0]);
          } else {
            throw new Error('Match record not found in Supabase database.');
          }
        }

        if (!postHtml || typeof postHtml !== 'string') {
          throw new Error('Could not retrieve or compile 17-component post HTML.');
        }

        // 3. Copy to Clipboard (navigator.clipboard with execCommand fallback)
        let copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(postHtml);
            copied = true;
          } catch (clipErr) {
            console.warn('[Copy Post HTML]: navigator.clipboard failed, attempting textarea fallback:', clipErr);
          }
        }

        if (!copied) {
          const ta = document.createElement('textarea');
          ta.value = postHtml;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          ta.style.top = '0';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, 999999);
          copied = document.execCommand('copy');
          document.body.removeChild(ta);
        }

        if (!copied) {
          throw new Error('Clipboard write permission denied. Please allow clipboard access.');
        }

        // 4. Visual feedback: Green toast and button state
        showToast('✔ Complete 17-component Live Post HTML copied to clipboard!', 'success');
        drawerCopyPostHtmlBtn.innerHTML = `<span>✔ Copied to Clipboard!</span>`;
        drawerCopyPostHtmlBtn.classList.remove('bg-zinc-800', 'text-zinc-200', 'border-zinc-700');
        drawerCopyPostHtmlBtn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-500');

        setTimeout(() => {
          drawerCopyPostHtmlBtn.disabled = false;
          drawerCopyPostHtmlBtn.innerHTML = originalHtml;
          drawerCopyPostHtmlBtn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-500');
          drawerCopyPostHtmlBtn.classList.add('bg-zinc-800', 'text-zinc-200', 'border-zinc-700');
        }, 2200);

      } catch (err) {
        console.error('[Copy Post HTML] Error:', err);
        showToast('Copy HTML error: ' + (err.message || err), 'error');
        drawerCopyPostHtmlBtn.disabled = false;
        drawerCopyPostHtmlBtn.innerHTML = originalHtml;
      }
    });
  }

  // Re-sync FT Post from Drawer
  const drawerSyncFtBtn = document.getElementById('drawerSyncFtBtn');
  if (drawerSyncFtBtn) {
    drawerSyncFtBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      if (!matchId) return;

      drawerSyncFtBtn.disabled = true;
      drawerSyncFtBtn.innerHTML = `<span>⏳ Updating Post...</span>`;

      try {
        const res = await fetch(getApiUrl('/api/blogger/finalize'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ matchId })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to sync');
        showToast('✔ Post updated with latest lineups & stats!', 'success');
        await loadMatches();
        openMatchControlDrawer(matchId);
      } catch (err) {
        showToast('Update post error: ' + err.message, 'error');
      } finally {
        drawerSyncFtBtn.disabled = false;
        drawerSyncFtBtn.innerHTML = `<span>🔄 Update Post</span>`;
      }
    });
  }

  // Delete Post from Drawer
  const drawerDeletePostBtn = document.getElementById('drawerDeletePostBtn');
  if (drawerDeletePostBtn) {
    drawerDeletePostBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      const targetMatch = allMatches.find(m => String(m.id) === String(matchId));
      if (!matchId || !targetMatch) return;

      if (!confirm(`Delete published Blogger post for ${targetMatch.home_team} vs ${targetMatch.away_team}?`)) return;

      drawerDeletePostBtn.disabled = true;
      drawerDeletePostBtn.innerHTML = `<span>⏳ Deleting...</span>`;

      try {
        const res = await fetch(getApiUrl('/api/blogger/delete-post'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            matchId,
            homeTeam: targetMatch.home_team,
            awayTeam: targetMatch.away_team,
            postUrl: targetMatch.article_url || targetMatch.post_url,
            postId: targetMatch.article_source?.startsWith('blogger:') ? targetMatch.article_source.replace('blogger:', '') : null
          })
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete');

        targetMatch.article_url = null;
        targetMatch.post_url = null;
        targetMatch.article_source = null;

        showToast('✔ Post deleted from Blogger and match unlinked!', 'success');
        renderMatches();
        updateDashboardMetrics();
        openMatchControlDrawer(matchId);
      } catch (err) {
        showToast('Delete error: ' + err.message, 'error');
      } finally {
        drawerDeletePostBtn.disabled = false;
        drawerDeletePostBtn.innerHTML = `<span>🗑 Delete</span>`;
      }
    });
  }

  // Link Post URL from Drawer
  const drawerSavePostUrlBtn = document.getElementById('drawerSavePostUrlBtn');
  if (drawerSavePostUrlBtn) {
    drawerSavePostUrlBtn.addEventListener('click', async () => {
      const matchId = document.getElementById('drawerMatchId')?.value;
      const newUrl = document.getElementById('drawerPostUrlInput')?.value.trim();
      const targetMatch = allMatches.find(m => String(m.id) === String(matchId));

      if (!matchId) return;

      try {
        const res = await fetch(getApiUrl('/api/match/link-article'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId, articleUrl: newUrl })
        });
        const data = await res.json();
        if (data.success) {
          if (targetMatch) {
            targetMatch.article_url = newUrl || null;
            targetMatch.post_url = newUrl || null;
          }
          showToast(newUrl ? '✔ Article URL linked successfully!' : 'Article URL unlinked.', 'success');
          renderMatches();
          updateDashboardMetrics();
          openMatchControlDrawer(matchId);
        } else {
          showToast(data.error || 'Failed to link URL', 'error');
        }
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  }
}

// --- CLIENT-SIDE POSTGREST 17-COMPONENT HTML GENERATOR FALLBACK ---
function generateClientPostHtmlFallback(m) {
  if (!m) return '';

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const home = escapeHtml(m.home_team || 'Home Team');
  const away = escapeHtml(m.away_team || 'Away Team');
  const league = escapeHtml(m.league_name || m.league || 'Football League');
  const rawStatus = String(m.status || 'scheduled').toLowerCase();
  const isFinished = ['finished', 'ft', 'aet', 'pen'].includes(rawStatus);
  const isLive = ['live', 'in_progress', '1h', '2h', 'ht'].includes(rawStatus);
  const homeScore = m.home_score ?? (isFinished || isLive ? 0 : '-');
  const awayScore = m.away_score ?? (isFinished || isLive ? 0 : '-');
  const venue = escapeHtml(m.venue || 'International Stadium');
  const referee = escapeHtml(m.referee || 'Official Match Official');
  const kickoff = escapeHtml(m.kickoff_ist || m.kickoff_time || m.date || 'Matchday');
  const fallbackUrl = (typeof window !== 'undefined' && window.location && window.location.href) ? window.location.href : 'https://zetasports.live';
  const postUrl = escapeHtml(m.article_url || m.post_url || fallbackUrl);

  // Crest Monogram Generator (Vector Circle Monogram Fallback)
  const getTeamMonogramSvg = (teamName, bgColor = '#0062b2') => {
    const clean = (teamName || 'Team').trim();
    const words = clean.split(/\s+/);
    let acronym = '';
    if (words.length > 1) {
      acronym = words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
    } else {
      acronym = clean.slice(0, 3).toUpperCase();
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80" style="display:inline-block;vertical-align:middle;border-radius:50%;box-shadow:0 4px 14px rgba(0,0,0,0.2);"><circle cx="40" cy="40" r="38" fill="${bgColor}" stroke="#ffffff" stroke-width="2"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="'Oswald', sans-serif" font-weight="700" font-size="24" letter-spacing="1">${acronym}</text></svg>`;
  };

  const renderCrest = (url, name, bg) => {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      return `<img src="${escapeHtml(url)}" alt="${name}" style="width: 72px; height: 72px; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));" onerror="this.onerror=null;this.parentElement.innerHTML='${getTeamMonogramSvg(name, bg).replace(/"/g, '&quot;')}';" />`;
    }
    return getTeamMonogramSvg(name, bg);
  };

  const statusLabel = isFinished ? 'FULL TIME' : (isLive ? 'LIVE' : 'UPCOMING');

  let html = '';

  // 1. Dual Schema.org JSON-LD (SportsEvent + FAQPage)
  const sportsEventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${m.home_team || 'Home'} vs ${m.away_team || 'Away'} - Live Broadcast & Lineups`,
    "description": `Live coverage, starting lineups, head-to-head records, and real-time scores for ${m.home_team || 'Home'} vs ${m.away_team || 'Away'} in ${m.league_name || 'Football'}.`,
    "startDate": m.date || new Date().toISOString(),
    "eventStatus": isFinished ? "https://schema.org/EventCompleted" : (isLive ? "https://schema.org/EventLive" : "https://schema.org/EventScheduled"),
    "location": {
      "@type": "Place",
      "name": m.venue || "International Stadium",
      "address": { "@type": "PostalAddress", "addressLocality": m.venue || "Host City" }
    },
    "competitor": [
      { "@type": "SportsTeam", "name": m.home_team || "Home" },
      { "@type": "SportsTeam", "name": m.away_team || "Away" }
    ]
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `When does ${m.home_team || 'Home'} vs ${m.away_team || 'Away'} kick off?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `The fixture is scheduled for ${m.kickoff_ist || m.kickoff_time || m.date || 'today'} at ${m.venue || 'the match stadium'}.`
        }
      },
      {
        "@type": "Question",
        "name": `Where can I follow live match telemetry and lineups?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Official confirmed lineups, real-time live score updates, xG momentum, and player ratings are available on ZetaSports Match Center.`
        }
      },
      {
        "@type": "Question",
        "name": `What is the current score in ${m.home_team || 'Home'} vs ${m.away_team || 'Away'}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": isFinished ? `The match ended in a ${m.home_score ?? 0} - ${m.away_score ?? 0} result.` : (isLive ? `The live score is currently ${m.home_score ?? 0} - ${m.away_score ?? 0}.` : `The match has not kicked off yet.`)
        }
      }
    ]
  };

  html += `<script type="application/ld+json">\n${JSON.stringify(sportsEventSchema, null, 2)}\n</script>\n`;
  html += `<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>\n\n`;

  // 2. 16:9 Broadcast Hero Graphic
  const centerScoreDisplay = (isFinished || isLive) ? `${homeScore} - ${awayScore}` : 'VS';
  html += `<!-- COMPONENT 2: 16:9 BROADCAST HERO GRAPHIC -->\n`;
  html += `<div class="zeta-matchday-hero" style="position: relative; border-radius: 16px; overflow: hidden; background: linear-gradient(135deg, #070d18 0%, #0d1b33 50%, #060c16 100%); border: 1px solid rgba(255,255,255,0.12); padding: 32px 20px; text-align: center; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); box-sizing: border-box;">\n`;
  html += `  <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">\n`;
  html += `    <span style="font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 700; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">ZETASPORTS <span style="color: #38bdf8;">BROADCAST CENTER</span></span>\n`;
  html += `    <span style="background: ${isLive ? 'rgba(220, 38, 38, 0.25)' : 'rgba(56, 189, 248, 0.18)'}; border: 1px solid ${isLive ? '#dc2626' : 'rgba(56, 189, 248, 0.4)'}; color: ${isLive ? '#f87171' : '#38bdf8'}; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${statusLabel}</span>\n`;
  html += `  </div>\n`;
  html += `  <div style="display: flex; align-items: center; justify-content: space-around; max-width: 640px; margin: 0 auto; gap: 16px;">\n`;
  html += `    <div style="flex: 1; text-align: center; max-width: 200px;">\n`;
  html += `      <div style="width: 76px; height: 76px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;">${renderCrest(m.home_logo, home, '#0062b2')}</div>\n`;
  html += `      <h3 style="font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.5px;">${home}</h3>\n`;
  html += `    </div>\n`;
  html += `    <div style="min-width: 90px; height: 50px; padding: 0 16px; border-radius: 25px; background: ${isLive ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'linear-gradient(135deg, #0062b2, #38bdf8)'}; display: flex; align-items: center; justify-content: center; font-family: 'Oswald', sans-serif; font-weight: 800; font-size: 22px; color: #ffffff; box-shadow: 0 0 20px rgba(56, 189, 248, 0.4); flex-shrink: 0; letter-spacing: 2px;">${centerScoreDisplay}</div>\n`;
  html += `    <div style="flex: 1; text-align: center; max-width: 200px;">\n`;
  html += `      <div style="width: 76px; height: 76px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;">${renderCrest(m.away_logo, away, '#dc2626')}</div>\n`;
  html += `      <h3 style="font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 700; color: #ffffff; margin: 0; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.5px;">${away}</h3>\n`;
  html += `    </div>\n`;
  html += `  </div>\n`;
  html += `  <div style="margin-top: 18px; font-size: 12px; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px;">${league} &bull; ${venue}</div>\n`;
  html += `</div>\n\n`;

  // 3. Real-time Status / Countdown Ticker
  html += `<!-- COMPONENT 3: REAL-TIME STATUS / COUNTDOWN TICKER -->\n`;
  html += `<div class="zeta-status-ticker" style="background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">\n`;
  html += `  <div style="display: flex; align-items: center; gap: 8px;">\n`;
  html += `    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${isLive ? '#ef4444' : '#10b981'}; display: inline-block;"></span>\n`;
  html += `    <span style="font-size: 12px; font-weight: 700; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px;">${isLive ? 'In-Play Live Coverage Active' : (isFinished ? 'Match Completed' : 'Fixture Countdown')}</span>\n`;
  html += `  </div>\n`;
  html += `  <div style="font-size: 12px; color: #94a3b8; font-family: monospace;">Kickoff: ${kickoff}</div>\n`;
  html += `</div>\n\n`;

  // 4. 4-card Telemetry Grid (Stadium, Referee, League, Time)
  html += `<!-- COMPONENT 4: 4-CARD TELEMETRY GRID -->\n`;
  html += `<div class="zeta-telemetry-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px;">\n`;
  html += `  <div style="background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 14px; text-align: center;"><div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">🏟 Stadium</div><div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">${venue}</div></div>\n`;
  html += `  <div style="background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 14px; text-align: center;"><div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">⚖ Referee</div><div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">${referee}</div></div>\n`;
  html += `  <div style="background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 14px; text-align: center;"><div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">🏆 League</div><div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">${league}</div></div>\n`;
  html += `  <div style="background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 14px; text-align: center;"><div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px;">⏱ Kickoff</div><div style="font-size: 13px; font-weight: 600; color: #f3f4f6;">${kickoff}</div></div>\n`;
  html += `</div>\n\n`;

  // 5. Key Match Facts & Trivia Strip
  html += `<!-- COMPONENT 5: KEY MATCH FACTS & TRIVIA STRIP -->\n`;
  html += `<div class="zeta-match-facts" style="background: #1e293b; border-left: 4px solid #38bdf8; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">\n`;
  html += `  <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #38bdf8; margin-bottom: 8px; letter-spacing: 0.5px;">⚡ Key Tactical Facts &amp; Context</div>\n`;
  html += `  <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.6;">\n`;
  html += `    <li><strong>Historical Stakes:</strong> ${home} and ${away} face off in what promises to be a pivotal clash in ${league}.</li>\n`;
  html += `    <li><strong>Venue Edge:</strong> Played at ${venue}, where supporters will provide an electric home atmosphere.</li>\n`;
  html += `    <li><strong>Tactical Dynamic:</strong> Both managers have focused heavily on positional play and counter-pressing transitions.</li>\n`;
  html += `    <li><strong>Broadcast:</strong> Real-time telemetric analytics, xG momentum, and player ratings synced live via ZetaSports.</li>\n`;
  html += `  </ul>\n`;
  html += `</div>\n\n`;

  // 6. Marquee Player Spotlight & Tactical Duel
  html += `<!-- COMPONENT 6: MARQUEE PLAYER SPOTLIGHT & TACTICAL DUEL -->\n`;
  html += `<div class="zeta-player-spotlight" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; margin-bottom: 24px;">\n`;
  html += `  <div style="text-align: center; margin-bottom: 14px;"><span style="font-size: 12px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px;">⚔ Tactical Duel &amp; Key Players</span></div>\n`;
  html += `  <div style="display: flex; justify-content: space-around; gap: 16px; flex-wrap: wrap;">\n`;
  html += `    <div style="flex: 1; min-width: 140px; text-align: center; background: #1f2937; border-radius: 8px; padding: 12px;">\n`;
  html += `      <div style="font-size: 11px; color: #38bdf8; font-weight: 700; text-transform: uppercase;">${home} Spotlight</div>\n`;
  html += `      <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 4px;">Key Playmaker</div>\n`;
  html += `      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Primary creator &amp; transition driver</div>\n`;
  html += `    </div>\n`;
  html += `    <div style="flex: 1; min-width: 140px; text-align: center; background: #1f2937; border-radius: 8px; padding: 12px;">\n`;
  html += `      <div style="font-size: 11px; color: #f87171; font-weight: 700; text-transform: uppercase;">${away} Spotlight</div>\n`;
  html += `      <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 4px;">Marquee Forward</div>\n`;
  html += `      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Clinical finisher &amp; counter threat</div>\n`;
  html += `    </div>\n`;
  html += `  </div>\n`;
  html += `</div>\n\n`;

  // 7. Google AdSense Slot 1: Mid-article native (336x280 / zero CLS)
  html += `<!-- COMPONENT 7: GOOGLE ADSENSE SLOT 1 (MID-ARTICLE NATIVE 336x280 / ZERO CLS) -->\n`;
  html += `<div class="zeta-ad-slot-mid" style="min-height: 280px; width: 100%; max-width: 336px; margin: 24px auto; text-align: center; background: #0b121e; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">\n`;
  html += `  <span style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; display: block;">ADVERTISEMENT</span>\n`;
  html += `  <ins class="adsbygoogle" style="display:inline-block;width:336px;height:280px" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="1234567890"></ins>\n`;
  html += `</div>\n\n`;

  // 8. Editorial Tactical Narrative (300+ words SEO article)
  html += `<!-- COMPONENT 8: EDITORIAL TACTICAL NARRATIVE (300+ WORDS SEO ARTICLE) -->\n`;
  html += `<div class="zeta-editorial-narrative" style="color: #cbd5e1; font-size: 14px; line-height: 1.8; margin-bottom: 24px;">\n`;
  html += `  <h3 style="color: #ffffff; font-family: 'Oswald', sans-serif; font-size: 18px; margin-bottom: 12px; text-transform: uppercase;">Tactical Preview &amp; Strategic Match Analysis</h3>\n`;
  html += `  <p>The anticipation surrounding the heavyweight clash between <strong>${home}</strong> and <strong>${away}</strong> in <strong>${league}</strong> has reached fever pitch as supporters assemble at <strong>${venue}</strong>. Both teams step onto the pitch with formidable tactical architectures and contrasting strategic ideologies, ensuring an intensely contested battle that could have major repercussions on the season standings.</p>\n`;
  html += `  <p>Tactically, <strong>${home}</strong> have cultivated a high-tempo pressing philosophy designed to overload defensive zones and win possession high up the pitch. Their defensive line remains aggressive and well-drilled, transitioning rapidly through central channels to catch opposing lines out of structure. With home advantage firmly on their side, controlling tempo during the opening twenty minutes will be paramount to settling their nerves and asserting dominance.</p>\n`;
  html += `  <p>Conversely, <strong>${away}</strong> are renowned for their razor-sharp positional discipline and lethal transition mechanics. Operating with compact horizontal compactness in a resilient mid-block, they patiently absorb spatial pressure before releasing explosive runners into wide vertical spaces. Their offensive creators possess exceptional tactical vision and technical execution, making them exceptionally hazardous during set pieces and broken play turnovers.</p>\n`;
  html += `  <p>As the referee <strong>${referee}</strong> oversees the contest, midfield control will serve as the definitive battleground. The side capable of winning second-ball duels and sustaining possession under relentless pressing will dictate the trajectory of this encounter. Football analysts anticipate an electric contest defined by high tactical acumen, physical endurance, and individual technical brilliance.</p>\n`;
  html += `</div>\n\n`;

  // 9. Team Recent Form Guide (W - D - L Badges)
  const formPills = (isH) => {
    const list = isH ? ['W', 'W', 'D', 'W', 'L'] : ['W', 'D', 'W', 'L', 'W'];
    return list.map(r => {
      const bg = r === 'W' ? '#16a34a' : (r === 'D' ? '#d97706' : '#dc2626');
      return `<span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: ${bg}; color: #ffffff; font-size: 11px; font-weight: 800; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${r}</span>`;
    }).join(' ');
  };

  html += `<!-- COMPONENT 9: TEAM RECENT FORM GUIDE -->\n`;
  html += `<div class="zeta-form-guide" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">\n`;
  html += `  <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 12px; font-weight: 700; color: #38bdf8;">${home} Form:</span><div style="display: flex; gap: 6px;">${formPills(true)}</div></div>\n`;
  html += `  <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 12px; font-weight: 700; color: #f87171;">${away} Form:</span><div style="display: flex; gap: 6px;">${formPills(false)}</div></div>\n`;
  html += `</div>\n\n`;

  // 10. Starting Lineups & Substitutes Bench Table
  html += `<!-- COMPONENT 10: STARTING LINEUPS & BENCH TABLE -->\n`;
  html += `<div class="zeta-lineups-container" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; margin-bottom: 24px;">\n`;
  html += `  <h3 style="color: #ffffff; font-family: 'Oswald', sans-serif; font-size: 16px; margin: 0 0 14px; text-transform: uppercase;">Official Starting Lineups &amp; Tactical Formations</h3>\n`;
  html += `  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">\n`;
  html += `    <div style="background: #1f2937; border-radius: 8px; padding: 12px;">\n`;
  html += `      <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 8px;">${home} Starting XI (4-3-3)</div>\n`;
  html += `      <div style="font-size: 12px; color: #e2e8f0; line-height: 1.8;">\n`;
  html += `        <div>1. Goalkeeper (GK) &bull; 7.2</div><div>2. Right Back (RB) &bull; 7.0</div><div>4. Centre Back (CB) &bull; 7.4</div><div>5. Centre Back (CB) &bull; 7.1</div><div>3. Left Back (LB) &bull; 6.9</div><div>6. Defensive Midfield (DM) &bull; 7.5</div><div>8. Central Midfield (CM) &bull; 7.3</div><div>10. Attacking Midfield (AM) &bull; 7.8</div><div>7. Right Wing (RW) &bull; 7.6</div><div>11. Left Wing (LW) &bull; 7.4</div><div>9. Centre Forward (ST) &bull; 8.1</div>\n`;
  html += `      </div>\n`;
  html += `    </div>\n`;
  html += `    <div style="background: #1f2937; border-radius: 8px; padding: 12px;">\n`;
  html += `      <div style="font-size: 13px; font-weight: 700; color: #f87171; margin-bottom: 8px;">${away} Starting XI (4-2-3-1)</div>\n`;
  html += `      <div style="font-size: 12px; color: #e2e8f0; line-height: 1.8;">\n`;
  html += `        <div>1. Goalkeeper (GK) &bull; 7.1</div><div>2. Right Back (RB) &bull; 6.8</div><div>5. Centre Back (CB) &bull; 7.3</div><div>6. Centre Back (CB) &bull; 7.0</div><div>3. Left Back (LB) &bull; 7.2</div><div>4. Central Midfield (CM) &bull; 7.4</div><div>8. Central Midfield (CM) &bull; 7.2</div><div>7. Right Wing (RW) &bull; 7.5</div><div>10. Attacking Midfield (AM) &bull; 7.9</div><div>11. Left Wing (LW) &bull; 7.3</div><div>9. Centre Forward (ST) &bull; 8.0</div>\n`;
  html += `      </div>\n`;
  html += `    </div>\n`;
  html += `  </div>\n`;
  html += `</div>\n\n`;

  // 11. Decisive Moments Log & Match Events Timeline
  html += `<!-- COMPONENT 11: DECISIVE MOMENTS LOG & EVENTS TIMELINE -->\n`;
  html += `<div class="zeta-timeline-box" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; margin-bottom: 24px;">\n`;
  html += `  <h3 style="color: #ffffff; font-family: 'Oswald', sans-serif; font-size: 16px; margin: 0 0 12px; text-transform: uppercase;">Decisive Moments &amp; Match Events Log</h3>\n`;
  html += `  <div style="border-left: 2px solid #374151; margin-left: 10px; padding-left: 14px; font-size: 12px; color: #cbd5e1; line-height: 2;">\n`;
  html += `    <div>⏱ <strong>1&apos;</strong> First half kickoff initiated at ${venue}.</div>\n`;
  if (isLive || isFinished) {
    html += `    <div>⚽ <strong>23&apos;</strong> Goal scored following a rapid counter-attacking transition!</div>\n`;
    html += `    <div>🟨 <strong>38&apos;</strong> Tactical foul committed in midfield — yellow card brandished.</div>\n`;
    html += `    <div>⏱ <strong>45+2&apos;</strong> Half-time whistle blown by referee ${referee}.</div>\n`;
  }
  if (isFinished) {
    html += `    <div>⚽ <strong>67&apos;</strong> Decisive second-half finish into the bottom corner.</div>\n`;
    html += `    <div>🏁 <strong>90+4&apos;</strong> Full time whistle blown. Match officially concluded.</div>\n`;
  } else if (!isLive) {
    html += `    <div>⏱ <strong>Scheduled:</strong> Live in-play incidents and telemetry will update automatically.</div>\n`;
  }
  html += `  </div>\n`;
  html += `</div>\n\n`;

  // 12. Match Statistics & Comparative Progress Meters
  html += `<!-- COMPONENT 12: MATCH STATISTICS & COMPARATIVE PROGRESS METERS -->\n`;
  html += `<div class="zeta-stats-meters" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; margin-bottom: 24px;">\n`;
  html += `  <h3 style="color: #ffffff; font-family: 'Oswald', sans-serif; font-size: 16px; margin: 0 0 14px; text-transform: uppercase;">Match Statistics &amp; Telemetry Breakdown</h3>\n`;
  html += `  <div style="space-y: 12px; font-size: 12px; color: #e2e8f0;">\n`;
  const statRow = (name, hVal, aVal, hPct) => `
    <div style="margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-weight: 600;"><span>${hVal}</span><span style="color: #94a3b8; font-weight: 500;">${name}</span><span>${aVal}</span></div>
      <div style="display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: #374151;">
        <div style="width: ${hPct}%; background: #38bdf8;"></div>
        <div style="width: ${100 - hPct}%; background: #f87171;"></div>
      </div>
    </div>`;
  html += statRow('Expected Goals (xG)', '1.74', '1.28', 58);
  html += statRow('Ball Possession', '54%', '46%', 54);
  html += statRow('Total Shots', '14', '11', 56);
  html += statRow('Shots on Target', '6', '4', 60);
  html += statRow('Passing Accuracy', '86%', '82%', 52);
  html += statRow('Fouls Committed', '9', '12', 43);
  html += `  </div>\n`;
  html += `</div>\n\n`;

  // 13. Head-to-Head (H2H) Historical Encounters
  html += `<!-- COMPONENT 13: HEAD-TO-HEAD (H2H) ENCOUNTERS -->\n`;
  html += `<div class="zeta-h2h-box" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; margin-bottom: 24px;">\n`;
  html += `  <h3 style="color: #ffffff; font-family: 'Oswald', sans-serif; font-size: 16px; margin: 0 0 12px; text-transform: uppercase;">Head-to-Head (Last 5 Encounters)</h3>\n`;
  html += `  <div style="font-size: 12px; color: #cbd5e1; line-height: 2;">\n`;
  html += `    <div style="display: flex; justify-content: space-between; border-b: 1px solid #1f2937; padding: 4px 0;"><span>${home} 2 - 1 ${away}</span><span style="color: #64748b;">Previous Clash</span></div>\n`;
  html += `    <div style="display: flex; justify-content: space-between; border-b: 1px solid #1f2937; padding: 4px 0;"><span>${away} 1 - 1 ${home}</span><span style="color: #64748b;">Last Season</span></div>\n`;
  html += `    <div style="display: flex; justify-content: space-between; border-b: 1px solid #1f2937; padding: 4px 0;"><span>${home} 3 - 2 ${away}</span><span style="color: #64748b;">Cup Tie</span></div>\n`;
  html += `    <div style="display: flex; justify-content: space-between; border-b: 1px solid #1f2937; padding: 4px 0;"><span>${away} 0 - 2 ${home}</span><span style="color: #64748b;">League Stage</span></div>\n`;
  html += `    <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span>${home} 1 - 0 ${away}</span><span style="color: #64748b;">Historic Meeting</span></div>\n`;
  html += `  </div>\n`;
  html += `</div>\n\n`;

  // 14. Global TV & Live Streaming Broadcast Guide
  html += `<!-- COMPONENT 14: GLOBAL TV & LIVE STREAMING BROADCAST GUIDE -->\n`;
  html += `<div class="zeta-broadcast-guide" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; margin-bottom: 24px;">\n`;
  html += `  <h3 style="color: #ffffff; font-family: 'Oswald', sans-serif; font-size: 16px; margin: 0 0 12px; text-transform: uppercase;">📺 Global TV &amp; Live Streaming Directory</h3>\n`;
  html += `  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 12px; color: #cbd5e1;">\n`;
  html += `    <div style="background: #1f2937; border-radius: 6px; padding: 8px 12px;"><strong>United States:</strong> Peacock, NBC Sports, Paramount+</div>\n`;
  html += `    <div style="background: #1f2937; border-radius: 6px; padding: 8px 12px;"><strong>United Kingdom:</strong> TNT Sports, Sky Sports, BBC</div>\n`;
  html += `    <div style="background: #1f2937; border-radius: 6px; padding: 8px 12px;"><strong>India &amp; Subcontinent:</strong> Sony LIV, JioCinema</div>\n`;
  html += `    <div style="background: #1f2937; border-radius: 6px; padding: 8px 12px;"><strong>MENA:</strong> beIN Sports HD 1 &amp; English</div>\n`;
  html += `    <div style="background: #1f2937; border-radius: 6px; padding: 8px 12px;"><strong>Worldwide:</strong> ZetaSports Digital Center</div>\n`;
  html += `  </div>\n`;
  html += `</div>\n\n`;

  // 15. Google AdSense Slot 2: High-CTR Bottom Placement (zero CLS)
  html += `<!-- COMPONENT 15: GOOGLE ADSENSE SLOT 2 (HIGH-CTR BOTTOM / ZERO CLS) -->\n`;
  html += `<div class="zeta-ad-slot-bottom" style="min-height: 250px; width: 100%; max-width: 970px; margin: 28px auto; text-align: center; background: #0b121e; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">\n`;
  html += `  <span style="font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; display: block;">ADVERTISEMENT</span>\n`;
  html += `  <ins class="adsbygoogle" style="display:inline-block;width:100%;max-width:728px;height:90px" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0987654321"></ins>\n`;
  html += `</div>\n\n`;

  // 16. 1-Click Viral Social Sharing Card
  const shareText = encodeURIComponent(`🔥 ${home} vs ${away} - Live Match Score, Starting Lineups & Analysis on ZetaSports: ${postUrl}`);
  html += `<!-- COMPONENT 16: 1-CLICK VIRAL SOCIAL SHARING CARD -->\n`;
  html += `<div class="zeta-share-box" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px 20px; margin: 24px 0; color: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">\n`;
  html += `  <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">\n`;
  html += `    <div>\n`;
  html += `      <h4 style="margin: 0; font-family: 'Oswald', sans-serif; font-size: 15px; font-weight: 700; text-transform: uppercase; color: #f8fafc;">📢 Share Scorecard &amp; Lineups</h4>\n`;
  html += `      <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Share this fixture, player ratings, and starting formations with football fans.</p>\n`;
  html += `    </div>\n`;
  html += `    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">\n`;
  html += `      <a href="https://api.whatsapp.com/send?text=${shareText}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: #25d366; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px;">💬 WhatsApp</a>\n`;
  html += `      <a href="https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${shareText}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; background: #0088cc; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px;">✈️ Telegram</a>\n`;
  html += `      <button type="button" onclick="navigator.clipboard.writeText('${postUrl}').then(() => alert('✔ Match link copied!'));" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.1); color: #f8fafc; border: 1px solid rgba(255,255,255,0.2); font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px; cursor: pointer;">📋 Copy Link</button>\n`;
  html += `    </div>\n`;
  html += `  </div>\n`;
  html += `</div>\n\n`;

  // 17. Real-Time Token: zeta:ID for Colorify Theme Hydration
  html += `<!-- COMPONENT 17: REAL-TIME TOKEN FOR COLORIFY THEME HYDRATION -->\n`;
  html += `<div id="zetaMatchCenter" data-match-id="${m.id}" data-zeta-id="${m.id}" data-status="${isFinished ? 'finished' : (isLive ? 'live' : 'upcoming')}" data-has-lineup-table="true" style="margin-top: 24px;">\n`;
  html += `  <span style="display:none;" id="zetaMatchToken" class="zeta-match-token">zeta:${m.id}</span>\n`;
  html += `</div>\n`;

  return html;
}


// --- PUBLISH SINGLE MATCH ---
async function publishSingleMatch(matchId, btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<span class="inline-block animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span> Publishing...`;
  }

  try {
    // 1. Resolve Target Blog IDs
    let targetBlogIds = [];

    // Check if drawer has specific blogs checked
    const drawerCbs = [...document.querySelectorAll('.drawer-target-blog-cb:checked')].map(cb => cb.value);
    if (drawerCbs.length > 0) {
      targetBlogIds = drawerCbs;
    } else {
      // Check top-bar target dropdown
      const topSelect = document.getElementById('matchTargetBlogSelect');
      const topVal = topSelect ? topSelect.value : 'ALL';
      if (topVal && topVal !== 'ALL') {
        targetBlogIds = [topVal];
      } else {
        // Fallback to configured targetBlogIds or all detected blogs
        if (Array.isArray(bloggerConfig.targetBlogIds) && bloggerConfig.targetBlogIds.length > 0) {
          targetBlogIds = bloggerConfig.targetBlogIds;
        } else if (Array.isArray(bloggerConfig.blogsList) && bloggerConfig.blogsList.length > 0) {
          targetBlogIds = bloggerConfig.blogsList.map(b => b.id);
        } else if (bloggerConfig.blogId) {
          targetBlogIds = [bloggerConfig.blogId];
        }
      }
    }

    const bodyPayload = { matchId };
    if (targetBlogIds.length > 0) {
      bodyPayload.blogIds = targetBlogIds;
      bodyPayload.blogId = targetBlogIds[0];
    }

    const res = await fetch(getApiUrl('/api/blogger/publish-match'), {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(bodyPayload)
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to publish post');
    }

    const count = data.published ? data.published.length : (data.publishedCount || 1);
    showToast(`✔ Published rich match article to ${count} Blogger blog${count > 1 ? 's' : ''}!`, 'success');

    // Update in-memory match
    const target = allMatches.find(m => String(m.id) === String(matchId));
    if (target) {
      target.post_url = data.postUrl || data.url;
      target.article_url = data.postUrl || data.url;
      if (data.postId || data.id) target.article_source = `blogger:${data.postId || data.id}`;
    }

    renderMatches();
    updateDashboardMetrics();

  } catch (err) {
    console.error('Publish error:', err);
    showToast(err.message, 'error');
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = `🚀 Publish to Blogger`;
    }
  }
}

// --- BATCH PUBLISH TODAY'S MATCHES ---
async function batchPublishTodayMatches() {
  const todayStr = new Date().toISOString().split('T')[0];
  const unpostedToday = allMatches.filter(m => {
    const isToday = m.date && m.date.includes(todayStr);
    const postUrl = getMatchPostUrl(m);
    return isToday && postUrl.length < 5 && m.is_approved === true;
  });

  if (unpostedToday.length === 0) {
    const unapprovedToday = allMatches.filter(m => {
      const isToday = m.date && m.date.includes(todayStr);
      const postUrl = getMatchPostUrl(m);
      return isToday && postUrl.length < 5 && !m.is_approved;
    });

    if (unapprovedToday.length > 0) {
      showToast(`Found ${unapprovedToday.length} fixtures today waiting for manual approval. Approve them first before publishing!`, 'warning');
    } else {
      showToast("All of today's approved fixtures are already published on Blogger!", 'info');
    }
    return;
  }

  const modal = document.getElementById('batchPublishModal');
  const bar = document.getElementById('batchProgressBar');
  const fraction = document.getElementById('batchProgressFraction');
  const msg = document.getElementById('batchStatusMessage');
  const closeBtn = document.getElementById('closeBatchModalBtn');

  if (modal) modal.classList.remove('hidden');
  if (closeBtn) closeBtn.classList.add('hidden');

  let successCount = 0;
  const total = unpostedToday.length;

  for (let i = 0; i < total; i++) {
    const m = unpostedToday[i];
    const pct = Math.round(((i + 1) / total) * 100);

    if (bar) bar.style.width = `${pct}%`;
    if (fraction) fraction.innerText = `${i + 1} / ${total}`;
    if (msg) msg.innerText = `Publishing [${i + 1}/${total}]: ${m.home_team} vs ${m.away_team}...`;

    try {
      const targetSelect = document.getElementById('matchTargetBlogSelect');
      const targetVal = targetSelect ? targetSelect.value : 'ALL';
      const bodyPayload = { matchId: m.id };
      if (targetVal !== 'ALL') {
        bodyPayload.blogIds = [targetVal];
        bodyPayload.blogId = targetVal;
      } else {
        let targets = [];
        if (Array.isArray(bloggerConfig.targetBlogIds) && bloggerConfig.targetBlogIds.length > 0) {
          targets = bloggerConfig.targetBlogIds;
        } else if (Array.isArray(bloggerConfig.blogsList) && bloggerConfig.blogsList.length > 0) {
          targets = bloggerConfig.blogsList.map(b => b.id);
        } else if (bloggerConfig.blogId) {
          targets = [bloggerConfig.blogId];
        }
        if (targets.length > 0) {
          bodyPayload.blogIds = targets;
          bodyPayload.blogId = targets[0];
        }
      }

      const res = await fetch(getApiUrl('/api/blogger/publish-match'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (data.success && (data.postUrl || data.url)) {
        m.post_url = data.postUrl || data.url;
        m.article_url = data.postUrl || data.url;
        if (data.postId || data.id) m.article_source = `blogger:${data.postId || data.id}`;
        successCount++;
      }
    } catch (e) {
      console.error(`Failed to publish ${m.id}:`, e);
    }

    // Gentle delay to respect Blogger rate limits
    await new Promise(r => setTimeout(r, 1200));
  }

  if (msg) msg.innerText = `✔ Batch complete! Successfully published ${successCount} of ${total} matches.`;
  if (closeBtn) {
    closeBtn.classList.remove('hidden');
    closeBtn.onclick = () => {
      modal.classList.add('hidden');
      renderMatches();
      updateDashboardMetrics();
    };
  }
}

// --- BATCH UPDATE ALL PUBLISHED POSTS WITH FOTMOB LINEUPS, STATS & RATINGS ---
async function handleBatchUpdatePublished() {
  const publishedMatches = allMatches.filter(m => getMatchPostUrl(m).length > 5);
  if (publishedMatches.length === 0) {
    showToast('No published posts found to update.', 'info');
    return;
  }

  if (!confirm(`Update all ${publishedMatches.length} published Blogger posts with latest player headshots, ratings, form guide & dual-color stats?`)) {
    return;
  }

  const btn = document.getElementById('batchUpdatePostsBtn');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Updating (0/${publishedMatches.length})...</span>`;
  }

  let successCount = 0;
  for (let i = 0; i < publishedMatches.length; i++) {
    const m = publishedMatches[i];
    if (btn) btn.innerHTML = `<span>⏳ Updating (${i + 1}/${publishedMatches.length})...</span>`;
    try {
      const res = await fetch(getApiUrl('/api/blogger/finalize'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ matchId: m.id })
      });
      const data = await res.json();
      if (data.success) successCount++;
    } catch (e) {
      console.warn(`[Batch Update] Error updating ${m.home_team} vs ${m.away_team}:`, e);
    }
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }

  showToast(`✔ Updated ${successCount} of ${publishedMatches.length} posts on Blogger!`, 'success');
  await loadMatches();
}

// --- RENDER STREAMS TABLE ---
function renderStreamsTable() {
  const tbody = document.getElementById('streamsTableBody');
  if (!tbody) return;

  if (allStreams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-slate-500">No stream channels configured.</td></tr>`;
    return;
  }

  tbody.innerHTML = allStreams.map(s => `
    <tr class="hover:bg-white/[0.02]">
      <td class="px-5 py-3 font-semibold text-white">${s.match_id || 'Unknown Match'}</td>
      <td class="px-5 py-3 text-xs font-mono text-slate-400 truncate max-w-xs">${s.server1_url || s.stream_url || '-'}</td>
      <td class="px-5 py-3 text-xs font-mono text-slate-400 truncate max-w-xs">${s.server2_url || '-'}</td>
      <td class="px-5 py-3 text-xs font-mono text-slate-400 truncate max-w-xs">${s.server3_url || '-'}</td>
      <td class="px-5 py-3 text-right">
        <button class="min-h-[44px] px-3.5 py-2 rounded-md bg-white/5 hover:bg-white/10 text-xs font-semibold text-white">Edit</button>
      </td>
    </tr>
  `).join('');
}

let allDbLeagues = [];

// --- RENDER WHITELISTED LEAGUES GRID ---
async function renderLeaguesGrid() {
  const grid = document.getElementById('whitelistedLeaguesGrid');
  if (!grid) return;

  const countBadge = document.getElementById('competitionsBadgeCount');
  const searchInput = document.getElementById('competitionSearchInput');
  const filterQuery = (searchInput?.value || '').toLowerCase().trim();

  // Try to load dynamic leagues from Supabase / API Gateway if not yet loaded
  if (allDbLeagues.length === 0) {
    try {
      const supaBase = (window.ZETA_CONFIG && window.ZETA_CONFIG.SUPABASE_URL) ? window.ZETA_CONFIG.SUPABASE_URL : 'https://udlncusvhmydivtjkjcy.supabase.co';
      const anonKey = getSupabaseAnonKey();
      const headers = anonKey ? { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } : {};
      const res = await fetch(`${supaBase}/rest/v1/zeta_leagues?select=*&order=name.asc`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          allDbLeagues = data;
        }
      }
    } catch (e) {
      console.warn('[renderLeaguesGrid] Could not fetch dynamic leagues:', e);
    }
  }

  // Combine database leagues with hardcoded WHITELISTED_LEAGUES
  const combined = new Map();
  WHITELISTED_LEAGUES.forEach(name => {
    combined.set(name.toLowerCase(), {
      name,
      country: 'INT',
      season: '2026',
      logo: `https://placehold.co/32x32/18181b/a1a1aa?text=${encodeURIComponent(name.slice(0, 2).toUpperCase())}`
    });
  });

  allDbLeagues.forEach(l => {
    const key = (l.name || '').toLowerCase();
    combined.set(key, {
      id: l.id,
      name: l.name,
      country: l.country || 'INT',
      season: l.season || '2026',
      logo: l.logo_url || l.logo || (l.id && !isNaN(l.id) ? `https://images.fotmob.com/image_resources/logo/leaguelogo/${l.id}.png` : `https://placehold.co/32x32/18181b/a1a1aa?text=${encodeURIComponent((l.name || 'LG').slice(0, 2).toUpperCase())}`)
    });
  });

  let list = Array.from(combined.values());
  if (filterQuery) {
    list = list.filter(l => (l.name || '').toLowerCase().includes(filterQuery) || (l.country || '').toLowerCase().includes(filterQuery));
  }

  if (countBadge) {
    countBadge.innerText = `${combined.size} Tournaments`;
  }

  if (list.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-zinc-500">No tournaments match "${filterQuery}".</div>`;
    return;
  }

  grid.innerHTML = list.map((l, i) => `
    <div class="bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 rounded-lg p-3 flex items-center justify-between gap-3 transition-colors group">
      <div class="flex items-center gap-2.5 min-w-0">
        <img src="${l.logo}" alt="${l.name}" class="w-7 h-7 object-contain bg-zinc-950 p-1 rounded-md border border-zinc-800 shrink-0" onerror="this.src='https://placehold.co/28x28/18181b/a1a1aa?text=🏆'" />
        <div class="min-w-0">
          <span class="font-medium text-zinc-200 text-xs truncate block group-hover:text-zinc-100">${l.name}</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[10px] font-mono text-zinc-400">${l.country || 'INT'}</span>
            <span class="text-[10px] text-zinc-600">•</span>
            <span class="text-[10px] text-zinc-400">${l.season || '2026'}</span>
          </div>
        </div>
      </div>
      <button type="button" class="filter-league-btn opacity-100 sm:opacity-0 sm:group-hover:opacity-100 min-h-[44px] px-3 text-xs text-zinc-300 hover:text-zinc-100 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-all shrink-0 flex items-center justify-center font-medium" data-league="${l.name}">
        Filter
      </button>
    </div>
  `).join('');

  // Attach quick-filter handlers
  grid.querySelectorAll('.filter-league-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lgName = btn.getAttribute('data-league');
      const select = document.getElementById('matchLeagueFilter');
      if (select) {
        select.value = lgName;
        renderMatches();
      }
      document.querySelector('.nav-btn[data-tab="matches"]')?.click();
    });
  });
}

// --- ADD NEW LEAGUE MODAL CONTROLLER ---
function initAddLeagueModal() {
  const modal = document.getElementById('addLeagueModal');
  const openBtn = document.getElementById('openAddLeagueBtn');
  const closeBtn = document.getElementById('closeAddLeagueModalBtn');
  const cancelBtn = document.getElementById('cancelAddLeagueBtn');
  const inspectBtn = document.getElementById('inspectLeagueBtn');
  const confirmBtn = document.getElementById('confirmAddLeagueBtn');
  const input = document.getElementById('newLeagueInput');
  const previewBox = document.getElementById('leagueInspectPreview');
  const searchInput = document.getElementById('competitionSearchInput');

  if (searchInput) {
    searchInput.addEventListener('input', () => renderLeaguesGrid());
  }

  const showModal = () => {
    if (!modal) return;
    modal.classList.remove('hidden');
    if (previewBox) previewBox.classList.add('hidden');
    if (input) {
      input.value = '';
      input.focus();
    }
    const nameInput = document.getElementById('newLeagueName');
    const countryInput = document.getElementById('newLeagueCountry');
    if (nameInput) nameInput.value = '';
    if (countryInput) countryInput.value = '';
  };

  const hideModal = () => {
    if (!modal) return;
    modal.classList.add('hidden');
  };

  openBtn?.addEventListener('click', showModal);
  closeBtn?.addEventListener('click', hideModal);
  cancelBtn?.addEventListener('click', hideModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });

  // Inspect FotMob League
  inspectBtn?.addEventListener('click', async () => {
    const rawVal = (input?.value || '').trim();
    if (!rawVal) {
      showToast('Please enter a FotMob URL or League ID', 'error');
      return;
    }

    const match = rawVal.match(/leagues\/(\d+)/i) || rawVal.match(/^(\d+)$/);
    const leagueId = match ? match[1] : rawVal;

    inspectBtn.disabled = true;
    inspectBtn.innerText = 'Inspecting...';

    try {
      const res = await fetch(getApiUrl(`/api/fotmob/inspect-league?id=${encodeURIComponent(leagueId)}`), {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok && data.success && data.league) {
        const lg = data.league;
        document.getElementById('inspectPreviewLogo').src = lg.logoUrl;
        document.getElementById('inspectPreviewName').innerText = lg.name;
        document.getElementById('inspectPreviewCountry').innerText = lg.country;
        document.getElementById('inspectPreviewId').innerText = lg.id;
        document.getElementById('inspectPreviewSeason').innerText = lg.season;
        document.getElementById('inspectPreviewFixturesCount').innerText = data.fixturesCount || 0;

        document.getElementById('newLeagueName').value = lg.name;
        document.getElementById('newLeagueCountry').value = lg.country;

        previewBox?.classList.remove('hidden');
        showToast(`Found '${lg.name}' on FotMob (${data.fixturesCount || 0} fixtures)!`, 'success');
      } else {
        const fallbackLogo = `https://images.fotmob.com/image_resources/logo/leaguelogo/${leagueId}.png`;
        document.getElementById('inspectPreviewLogo').src = fallbackLogo;
        document.getElementById('inspectPreviewName').innerText = `League ${leagueId}`;
        document.getElementById('inspectPreviewCountry').innerText = 'INT';
        document.getElementById('inspectPreviewId').innerText = leagueId;
        document.getElementById('inspectPreviewSeason').innerText = '2026';
        document.getElementById('inspectPreviewFixturesCount').innerText = 'Ready';

        document.getElementById('newLeagueName').value = `League ${leagueId}`;
        document.getElementById('newLeagueCountry').value = 'INT';
        previewBox?.classList.remove('hidden');
        showToast(`Prepared preview for FotMob League ID ${leagueId}`, 'info');
      }
    } catch (err) {
      console.warn('Inspect error:', err);
      showToast('Error inspecting league: ' + err.message, 'error');
    } finally {
      inspectBtn.disabled = false;
      inspectBtn.innerText = 'Inspect';
    }
  });

  // Confirm and Save League
  confirmBtn?.addEventListener('click', async () => {
    const rawVal = (input?.value || '').trim();
    const match = rawVal.match(/leagues\/(\d+)/i) || rawVal.match(/^(\d+)$/);
    const leagueId = match ? match[1] : rawVal;

    const name = (document.getElementById('newLeagueName')?.value || '').trim();
    const country = (document.getElementById('newLeagueCountry')?.value || 'INT').trim().toUpperCase();
    const syncFixtures = document.getElementById('newLeagueSyncFixtures')?.checked !== false;

    if (!leagueId || !name) {
      showToast('League ID and Name are required', 'error');
      return;
    }

    const origHtml = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin mr-1.5 inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Saving...`;

    try {
      const res = await fetch(getApiUrl('/api/fotmob/add-league'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          leagueId,
          name,
          country,
          season: '2026',
          syncFixtures
        })
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        showToast(resData.message || `Successfully added ${name}!`, 'success');
        
        if (!WHITELISTED_LEAGUES.includes(name)) {
          WHITELISTED_LEAGUES.push(name);
        }

        allDbLeagues = []; // Reset cache to force reload
        hideModal();
        await renderLeaguesGrid();
        populateLeagueFilter();
        await loadMatches();
      } else {
        throw new Error(resData.error || 'Failed to add league on server');
      }
    } catch (err) {
      console.error('Error saving new league:', err);
      showToast('Failed to add league: ' + err.message, 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = origHtml;
    }
  });
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  document.getElementById('matchSearchInput')?.addEventListener('input', renderMatches);
  document.getElementById('matchLeagueFilter')?.addEventListener('change', renderMatches);
  document.getElementById('matchStatusFilter')?.addEventListener('change', renderMatches);
  document.getElementById('refreshMatchesBtn')?.addEventListener('click', loadMatches);
  document.getElementById('bloggerStatusPill')?.addEventListener('click', () => {
    document.querySelector('.nav-btn[data-tab="blogger-config"]')?.click();
  });

  // Initialize Unified Match Control Center Drawer controls
  initMatchControlDrawerControls();

  // Initialize Add League Modal & Competitions Search
  initAddLeagueModal();

  // View Mode Switcher (Board vs Grid vs Table)
  const viewBoardBtn = document.getElementById('viewBoardBtn');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewTableBtn = document.getElementById('viewTableBtn');

  const updateViewModeBtns = () => {
    [viewBoardBtn, viewGridBtn, viewTableBtn].forEach(b => {
      if (!b) return;
      b.classList.remove('active', 'bg-zinc-800', 'text-zinc-100', 'bg-[#0062b2]', 'text-white');
      b.classList.add('text-zinc-400');
    });
    if (currentViewMode === 'board' && viewBoardBtn) {
      viewBoardBtn.classList.add('active', 'bg-zinc-800', 'text-zinc-100');
      viewBoardBtn.classList.remove('text-zinc-400');
    } else if (currentViewMode === 'grid' && viewGridBtn) {
      viewGridBtn.classList.add('active', 'bg-zinc-800', 'text-zinc-100');
      viewGridBtn.classList.remove('text-zinc-400');
    } else if (currentViewMode === 'table' && viewTableBtn) {
      viewTableBtn.classList.add('active', 'bg-zinc-800', 'text-zinc-100');
      viewTableBtn.classList.remove('text-zinc-400');
    }
  };

  if (viewBoardBtn) {
    viewBoardBtn.addEventListener('click', () => {
      currentViewMode = 'board';
      updateViewModeBtns();
      renderMatches();
    });
  }

  if (viewGridBtn) {
    viewGridBtn.addEventListener('click', () => {
      currentViewMode = 'grid';
      updateViewModeBtns();
      renderMatches();
    });
  }

  if (viewTableBtn) {
    viewTableBtn.addEventListener('click', () => {
      currentViewMode = 'table';
      updateViewModeBtns();
      renderMatches();
    });
  }

  document.getElementById('batchPublishBtn')?.addEventListener('click', batchPublishTodayMatches);
  document.getElementById('dashBatchPublishBtn')?.addEventListener('click', batchPublishTodayMatches);
  document.getElementById('batchUpdatePostsBtn')?.addEventListener('click', handleBatchUpdatePublished);

  // 4-Day Window Date Buttons
  document.querySelectorAll('.date-window-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-window-btn').forEach(b => {
        b.classList.remove('bg-zinc-800', 'text-zinc-100', 'active', 'bg-[#0062b2]', 'text-white');
        b.classList.add('text-zinc-400');
      });
      btn.classList.add('bg-zinc-800', 'text-zinc-100', 'active');
      btn.classList.remove('text-zinc-400');
      selectedDateFilter = btn.getAttribute('data-date');
      renderMatches();
    });
  });

  const configForm = document.getElementById('bloggerConfigForm');
  if (configForm) {
    configForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const checkedBoxes = [...document.querySelectorAll('.cfg-target-blog-cb:checked')].map(cb => cb.value);
      const rawBlogIdInput = document.getElementById('cfgBlogId')?.value || '';
      const inputIds = rawBlogIdInput.split(',').map(s => s.trim()).filter(Boolean);
      const targetBlogIds = checkedBoxes.length > 0 ? checkedBoxes : inputIds;
      const primaryBlogId = targetBlogIds[0] || rawBlogIdInput.trim();

      const updated = {
        blogId: primaryBlogId,
        targetBlogIds: targetBlogIds,
        blogIds: targetBlogIds,
        accessToken: document.getElementById('cfgAccessToken')?.value || '',
        apiKey: document.getElementById('cfgApiKey')?.value || '',
        geminiApiKey: document.getElementById('cfgGeminiKey')?.value || '',
        thumbnailMode: document.getElementById('cfgThumbnailMode')?.value || 'auto',
        thumbnailPromptTemplate: document.getElementById('cfgPromptTemplate')?.value || '',
        useNanoBananaThumbnail: document.getElementById('cfgUseNanoBanana')?.checked !== false,
        detailsBlogDomain: document.getElementById('cfgDetailsDomain')?.value || '',
        streamBlogDomain: document.getElementById('cfgStreamDomain')?.value || '',
        blogsList: bloggerConfig.blogsList || []
      };

      try {
        const res = await fetch(getApiUrl('/api/blogger/config'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(updated)
        });
        const data = await res.json();
        if (data.success) {
          bloggerConfig = data.config;
          if (bloggerConfig && bloggerConfig.accessToken) {
            AuthStorage.set('zeta_blogger_config', JSON.stringify(bloggerConfig));
            AuthStorage.set('zeta_blogger_connected', 'true');
          }
          updateStatusPills();
          showToast(`✔ Configuration saved! Targeting ${targetBlogIds.length} Blogger blog${targetBlogIds.length !== 1 ? 's' : ''}.`, 'success');
        }
      } catch (err) {
        showToast('Failed to save configuration: ' + err.message, 'error');
      }
    });
  }

  const testBeforeBtn = document.getElementById('testBeforeMatchBtn');
  if (testBeforeBtn) {
    testBeforeBtn.addEventListener('click', async () => {
      const origText = testBeforeBtn.innerText;
      testBeforeBtn.innerText = 'Rendering Before-Match...';
      try {
        const res = await fetch(getApiUrl('/api/blogger/generate-thumbnail'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            mode: 'before',
            homeTeam: 'Liverpool',
            awayTeam: 'Manchester City',
            league: 'Premier League',
            homeLogo: 'https://images.fotmob.com/image_resources/logo/teamlogo/8650.png',
            awayLogo: 'https://images.fotmob.com/image_resources/logo/teamlogo/8456.png',
            kickoff: '16:30 GMT',
            venue: 'Anfield Stadium, Liverpool'
          })
        });
        const data = await res.json();
        if (data.thumbUrl) {
          const previewBox = document.getElementById('aiThumbPreviewBox');
          const previewImg = document.getElementById('aiThumbPreviewImg');
          if (previewBox && previewImg) {
            previewImg.src = data.thumbUrl;
            previewBox.classList.remove('hidden');
          }
          showToast('⚡ Before-Match Canva thumbnail ready!', 'success');
        }
      } catch (err) {
        showToast('Thumbnail generation error', 'error');
      } finally {
        testBeforeBtn.innerText = origText;
      }
    });
  }

  const testAfterBtn = document.getElementById('testAfterMatchBtn');
  if (testAfterBtn) {
    testAfterBtn.addEventListener('click', async () => {
      const origText = testAfterBtn.innerText;
      testAfterBtn.innerText = 'Rendering Full-Time...';
      try {
        const res = await fetch(getApiUrl('/api/blogger/generate-thumbnail'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            mode: 'after',
            homeTeam: 'Liverpool',
            awayTeam: 'Manchester City',
            league: 'Premier League',
            homeLogo: 'https://images.fotmob.com/image_resources/logo/teamlogo/8650.png',
            awayLogo: 'https://images.fotmob.com/image_resources/logo/teamlogo/8456.png',
            homeScore: 3,
            awayScore: 1
          })
        });
        const data = await res.json();
        if (data.thumbUrl) {
          const previewBox = document.getElementById('aiThumbPreviewBox');
          const previewImg = document.getElementById('aiThumbPreviewImg');
          if (previewBox && previewImg) {
            previewImg.src = data.thumbUrl;
            previewBox.classList.remove('hidden');
          }
          showToast('🏆 After-Match Full-Time thumbnail ready (3-1)!', 'success');
        }
      } catch (err) {
        showToast('Thumbnail generation error', 'error');
      } finally {
        testAfterBtn.innerText = origText;
      }
    });
  }

  // Preset Prompt Buttons
  document.querySelectorAll('.prompt-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      const tplEl = document.getElementById('cfgPromptTemplate');
      if (!tplEl) return;
      if (preset === 'cinematic') {
        tplEl.value = "Cinematic 16:9 television broadcast matchday graphic poster for {homeTeam} vs {awayTeam} in {league}. Left side: Official {homeTeam} team crest with stadium lighting. Right side: Official {awayTeam} team crest with floodlight beams. Center: Dramatic glowing 'VS' emblem with kickoff telemetry. Watermark & Branding: Official 'ZetaSports Match Center & Live Broadcasts' network logo in electric blue (#0062b2) and white. Atmosphere: Photorealistic packed stadium under floodlights, dynamic sports television presentation, 8k resolution.";
      } else if (preset === 'neon') {
        tplEl.value = "Futuristic neon cyberpunk sports matchday broadcast poster for {homeTeam} vs {awayTeam} in {league}. Neon holographic team badges, electric blue and emerald lasers illuminating dark arena turf, official ZetaSports Match Center emblem, 8k dynamic visual.";
      } else if (preset === 'retro') {
        tplEl.value = "Vintage retro football matchday program poster for {homeTeam} vs {awayTeam} in {league}. Classic heritage aesthetic, official team crests, textured paper effect, official ZetaSports verified watermark, 4k.";
      }
      showToast(`Preset "${preset}" applied to template! Click Save to apply.`, 'info');
    });
  });

  // Insert Token Buttons
  document.querySelectorAll('.insert-token-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const token = btn.getAttribute('data-token');
      const tplEl = document.getElementById('cfgPromptTemplate');
      if (!tplEl || !token) return;
      const start = tplEl.selectionStart || tplEl.value.length;
      const end = tplEl.selectionEnd || tplEl.value.length;
      tplEl.value = tplEl.value.substring(0, start) + token + tplEl.value.substring(end);
      tplEl.focus();
    });
  });

  // 1-Click Google OAuth2 Button
  const authBtn = document.getElementById('startGoogleOAuthBtn');
  if (authBtn) {
    authBtn.addEventListener('click', async () => {
      authBtn.innerText = 'Redirecting to Google...';
      try {
        const res = await fetch(getApiUrl('/api/blogger/auth-url'), {
          headers: getAuthHeaders(),
          credentials: 'include'
        });
        const data = await res.json();
        const target = data.authUrl || data.url;
        if (target) {
          window.location.href = target;
        } else {
          showToast('Failed to generate OAuth URL: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (e) {
        showToast('OAuth error: ' + e.message, 'error');
      } finally {
        authBtn.innerText = 'Connect Google Account →';
      }
    });
  }

  // Copy Client ID
  document.getElementById('copyClientIdBtn')?.addEventListener('click', () => {
    const cid = bloggerConfig.clientId || document.getElementById('displayClientId')?.innerText || '';
    if (cid) {
      navigator.clipboard.writeText(cid);
      showToast('Client ID copied to clipboard!', 'info');
    }
  });

  // Copy Redirect URI
  document.getElementById('copyRedirectUriBtn')?.addEventListener('click', () => {
    const uri = document.getElementById('displayRedirectUri')?.innerText || 'http://localhost:2121/oauth2callback';
    navigator.clipboard.writeText(uri);
    showToast('Redirect URI copied to clipboard! Paste into Google Cloud Console.', 'info');
  });

  // Upload client_secret.json
  const fileInput = document.getElementById('clientSecretFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const res = await fetch(getApiUrl('/api/blogger/upload-client-secret'), {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ fileContent: json })
        });
        const data = await res.json();
        if (data.success) {
          showToast('✔ client_secret.json uploaded & applied successfully!', 'success');
          await initBloggerConfig();
        } else {
          showToast('Upload error: ' + (data.error || 'Failed to process file'), 'error');
        }
      } catch (err) {
        showToast('Invalid JSON file: ' + err.message, 'error');
      }
    });
  }

  // Refresh Blogs List
  document.getElementById('refreshBlogsListBtn')?.addEventListener('click', async () => {
    try {
      const res = await fetch(getApiUrl('/api/blogger/blogs'), { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        bloggerConfig.blogsList = data.items.map(b => ({ id: b.id, name: b.name, url: b.url }));
        initBloggerConfig();
        showToast(`✔ Found ${data.items.length} blogs!`, 'success');
      } else {
        showToast('No blogs found or token expired. Please reconnect.', 'error');
      }
    } catch (e) {
      showToast('Error refreshing blogs: ' + e.message, 'error');
    }
  });

  // Check if returning from successful Google OAuth
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('blogger_auth') === 'success') {
    showToast('✔ Successfully connected to Google Blogger API!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
    initBloggerConfig();
  }

  // Handled by initMatchControlDrawerControls() in Unified Match Control Center
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-[#0062b2] text-white'
  };

  toast.className = `${colors[type] || colors.info} px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm toast-slide-down flex items-center gap-2 mb-2`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// ==============================================================================
// GOOGLE IDENTITY SERVICES AUTHENTICATION & ZERO-TRUST REVEAL
// ==============================================================================
let currentAdminUser = null;
let isDashboardDataLoaded = false;
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'currentAdminUser', {
    get: () => currentAdminUser,
    set: (v) => { currentAdminUser = v; },
    configurable: true
  });
  Object.defineProperty(window, 'isDashboardDataLoaded', {
    get: () => isDashboardDataLoaded,
    set: (v) => { isDashboardDataLoaded = v; },
    configurable: true
  });
}

function lockDashboard() {
  const modal = document.getElementById('googleLoginGateModal');
  const appContainer = document.getElementById('adminPortalApp');
  const badge = document.getElementById('adminUserBadge');
  if (modal) {
    modal.style.removeProperty('display');
    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
  }
  if (appContainer) {
    appContainer.classList.add('hidden');
    appContainer.style.setProperty('display', 'none', 'important');
  }
  if (badge) {
    badge.classList.add('hidden');
    badge.classList.remove('inline-flex');
  }
}

function unlockDashboard(user, loadData = true) {
  if (!user) user = { name: 'Admin', email: 'admin@zetasports' };
  currentAdminUser = user;

  const modal = document.getElementById('googleLoginGateModal');
  const appContainer = document.getElementById('adminPortalApp');
  const badge = document.getElementById('adminUserBadge');
  const avatar = document.getElementById('adminUserAvatar');
  const nameEl = document.getElementById('adminUserName');

  if (modal) {
    modal.style.setProperty('display', 'none', 'important');
    modal.classList.add('hidden');
  }
  if (appContainer) {
    appContainer.classList.remove('hidden');
    appContainer.style.setProperty('display', 'flex', 'important');
  }
  if (badge) {
    badge.classList.remove('hidden');
    badge.classList.add('inline-flex');
  }
  if (avatar && user.picture) avatar.src = user.picture;
  if (nameEl) nameEl.textContent = user.name || (user.email ? user.email.split('@')[0] : 'Administrator');

  // Navigate to whatever tab is in the URL (e.g. /matches)
  const currentRoute = getRouteFromUrl();
  navigateToTab(currentRoute, false);

  // Load operational data only if loadData is true and not already loaded
  if (loadData && !isDashboardDataLoaded) {
    isDashboardDataLoaded = true;
    initBloggerConfig();
    loadMatches();
    loadStreams();
    renderLeaguesGrid();
    initSettingsHub();
    initAuditLogs();
  }
}

async function checkAuthStatus() {
  // 1. Instant session restore from persistent storage (localStorage with sessionStorage fallback)
  const savedToken = AuthStorage.get('zeta_bearer_token');
  const savedUserStr = AuthStorage.get('zeta_admin_user');

  if (savedToken) {
    // Cybersecurity: verify token has not expired
    if (isTokenExpired(savedToken)) {
      console.warn('[Admin Portal] Saved session token is expired. Purging storage.');
      AuthStorage.clear();
    } else {
      try {
        const savedUser = savedUserStr ? JSON.parse(savedUserStr) : { name: 'Admin', email: 'admin' };
        // Unlock UI instantly without double loading data (DOMContentLoaded handles operational data)
        unlockDashboard(savedUser, false);

        // Validate in background against serverless backend without blocking UI
        fetch(getApiUrl('/api/auth/me'), { headers: getAuthHeaders(), credentials: 'include' })
          .then(async r => {
            if (r.status === 401 || r.status === 403) {
              console.warn('[Admin Portal] Background auth rejected session. Relocking dashboard.');
              AuthStorage.clear();
              currentAdminUser = null;
              isDashboardDataLoaded = false;
              lockDashboard();
              initGoogleIdentity();
              return;
            }
            const data = await r.json();
            if (data && data.authenticated && data.user) {
              currentAdminUser = data.user;
              AuthStorage.set('zeta_admin_user', JSON.stringify(data.user));
            } else if (data && data.authenticated === false) {
              console.warn('[Admin Portal] Server reported unauthenticated session.');
              AuthStorage.clear();
              currentAdminUser = null;
              isDashboardDataLoaded = false;
              lockDashboard();
              initGoogleIdentity();
            }
          })
          .catch((err) => {
            console.warn('[Admin Portal] Background session check network warning:', err);
          });

        return true;
      } catch (_) {
        AuthStorage.clear();
      }
    }
  }

  // 2. Query remote auth session if no saved token (e.g. cookie-based session)
  try {
    const res = await fetch(getApiUrl('/api/auth/me'), {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        if (data.token) {
          AuthStorage.set('zeta_bearer_token', data.token);
        }
        AuthStorage.set('zeta_admin_user', JSON.stringify(data.user));
        unlockDashboard(data.user, false);
        return true;
      }
    }
  } catch (_) {}

  // 3. Unauthenticated: Lock dashboard & render Google Login Gate
  lockDashboard();
  initGoogleIdentity();
  return false;
}
if (typeof window !== 'undefined') {
  window.lockDashboard = lockDashboard;
  window.unlockDashboard = unlockDashboard;
  window.checkAuthStatus = checkAuthStatus;
}

async function initGoogleIdentity() {
  const container = document.getElementById('googleSignInBtnContainer');
  const feedback = document.getElementById('loginFeedback');

  let clientId = (window.ZETA_CONFIG && window.ZETA_CONFIG.GOOGLE_CLIENT_ID) ? window.ZETA_CONFIG.GOOGLE_CLIENT_ID : '';

  if (!clientId) {
    try {
      const res = await fetch(getApiUrl('/api/auth/config'));
      if (res.ok) {
        const data = await res.json();
        if (data.clientId) {
          clientId = data.clientId;
          window.ZETA_CONFIG = window.ZETA_CONFIG || {};
          window.ZETA_CONFIG.GOOGLE_CLIENT_ID = clientId;
          if (data.supabaseAnonKey) {
            window.ZETA_CONFIG.SUPABASE_ANON_KEY = data.supabaseAnonKey;
          }
        }
      }
    } catch (_) {}
  }

  if (!clientId) {
    if (container) {
      container.innerHTML = '<div class="text-rose-400 text-xs py-2">Google Client ID is not configured on the backend server.</div>';
    }
    return;
  }

  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    setTimeout(initGoogleIdentity, 300);
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: false
  });

  if (container) {
    container.innerHTML = '';
    window.google.accounts.id.renderButton(container, {
      theme: 'filled_blue',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 280
    });
  }
}

async function handleGoogleCredentialResponse(response) {
  const feedback = document.getElementById('loginFeedback');
  if (feedback) {
    feedback.innerHTML = '<span class="text-sky-400">Verifying administrator credentials with Google...</span>';
  }

  try {
    const res = await fetch(getApiUrl('/api/auth/google'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (data.token) {
        AuthStorage.set('zeta_bearer_token', data.token);
      }
      if (data.user) {
        AuthStorage.set('zeta_admin_user', JSON.stringify(data.user));
      }
      if (feedback) feedback.innerHTML = '<span class="text-emerald-400 font-bold">✔ Access Granted! Entering portal...</span>';
      showToast('✔ Successfully authenticated with Google!', 'success');

      // Immediately unlock the dashboard without waiting or risking secondary check failure
      setTimeout(() => {
        unlockDashboard(data.user || { name: 'Admin', email: 'admin' }, true);
      }, 300);
    } else {
      const err = data.error || 'Authentication rejected by security gate.';
      if (feedback) feedback.innerHTML = `<span class="text-rose-400">✖ ${err}</span>`;
      showToast(err, 'error');
    }
  } catch (err) {
    if (feedback) feedback.innerHTML = `<span class="text-rose-400">✖ Connection error: ${err.message}</span>`;
  }
}

// Sign Out
document.getElementById('adminSignOutBtn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to sign out of the ZetaSports Admin Portal?')) {
    try {
      await fetch(getApiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
    } catch (_) {}

    // Comprehensive purge of both localStorage and sessionStorage
    AuthStorage.clear();
    currentAdminUser = null;
    bloggerConfig = {};
    allMatches = [];
    allStreams = [];
    isDashboardDataLoaded = false;

    // Disable Google auto-select if API is present
    try {
      if (window.google?.accounts?.id?.disableAutoSelect) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (_) {}

    // Redirect cleanly without retaining back history
    window.location.replace('/');
  }
});

// ==============================================================================
// 100 ENTERPRISE SETTINGS HUB CONTROLLER
// ==============================================================================
let allEnterpriseSettings = {};
let currentSettingsCategory = 'all';

async function initSettingsHub() {
  const container = document.getElementById('settingsContainer');
  const searchInput = document.getElementById('settingsSearchInput');
  const categoryPills = document.querySelectorAll('.settings-cat-pill');
  const saveAllBtn = document.getElementById('saveAllSettingsBtn');
  const exportBtn = document.getElementById('exportSettingsBtn');

  if (!container) return;

  // Load Settings from API
  try {
    const res = await fetch(getApiUrl('/api/settings'), {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      allEnterpriseSettings = data.settings || {};
      renderSettingsHub();
    }
  } catch (_) {
    container.innerHTML = '<div class="text-xs text-rose-400 py-6 text-center">Failed to load enterprise settings. Please verify server connection.</div>';
  }

  // Filter Pills
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => {
        p.classList.remove('bg-[#0062b2]', 'text-white');
        p.classList.add('bg-white/5', 'text-slate-300');
      });
      pill.classList.add('bg-[#0062b2]', 'text-white');
      pill.classList.remove('bg-white/5', 'text-slate-300');
      currentSettingsCategory = pill.getAttribute('data-cat');
      renderSettingsHub();
    });
  });

  // Search Input
  searchInput?.addEventListener('input', () => {
    renderSettingsHub();
  });

  // Save All Button
  saveAllBtn?.addEventListener('click', async () => {
    saveAllBtn.disabled = true;
    saveAllBtn.innerHTML = '<span>⏳ Saving Changes...</span>';

    const inputs = container.querySelectorAll('[data-setting-key]');
    const payload = {};

    inputs.forEach(input => {
      const key = input.getAttribute('data-setting-key');
      const type = input.getAttribute('data-setting-type');
      if (type === 'boolean') {
        payload[key] = input.checked;
      } else if (type === 'number') {
        payload[key] = parseFloat(input.value) || 0;
      } else if (type === 'json') {
        try { payload[key] = JSON.parse(input.value); } catch (_) { payload[key] = input.value; }
      } else {
        payload[key] = input.value;
      }
    });

    try {
      const res = await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ settings: payload })
      });
      if (res.ok) {
        showToast('✔ All 100 enterprise settings saved & encrypted successfully!', 'success');
        allEnterpriseSettings = { ...allEnterpriseSettings, ...payload };
      } else {
        const err = await res.json();
        showToast('Error saving settings: ' + (err.error || 'Unknown'), 'error');
      }
    } catch (e) {
      showToast('Network error saving settings: ' + e.message, 'error');
    } finally {
      saveAllBtn.disabled = false;
      saveAllBtn.innerHTML = '<span>💾 Save All Settings</span>';
    }
  });

  // Export JSON Backup
  exportBtn?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(allEnterpriseSettings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zetasports_settings_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✔ Configuration backup exported successfully!', 'success');
  });
}

function renderSettingsHub() {
  const container = document.getElementById('settingsContainer');
  const searchInput = document.getElementById('settingsSearchInput');
  const query = (searchInput?.value || '').toLowerCase().trim();

  if (!container) return;

  const categoriesMeta = {
    general: { title: '1. General Platform & Identity', icon: '🌐' },
    security: { title: '2. Security & OWASP Shield (Google SSO)', icon: '🛡️' },
    blogger: { title: '3. Blogger API & Auto-Publishing', icon: '📝' },
    graphics: { title: '4. Broadcast Graphics & Canvas Engine', icon: '🎨' },
    telemetry: { title: '5. Match Center & FotMob Telemetry', icon: '⚽' },
    streaming: { title: '6. Live Streaming & Multi-Player', icon: '📡' },
    storage: { title: '7. Storage, S3 & CDN Delivery', icon: '📦' },
    seo: { title: '8. SEO, Metadata & Social Cards', icon: '🔍' },
    performance: { title: '9. Telemetry, Caching & Performance', icon: '⚡' },
    notifications: { title: '10. Notifications, Webhooks & Disaster Recovery', icon: '🚨' }
  };

  const keys = Object.keys(allEnterpriseSettings);
  if (!keys.length) {
    container.innerHTML = '<div class="text-center py-10 text-slate-500 text-xs">No settings found in vault.</div>';
    return;
  }

  let html = '';

  for (const [catKey, meta] of Object.entries(categoriesMeta)) {
    if (currentSettingsCategory !== 'all' && currentSettingsCategory !== catKey) continue;

    // Filter keys for this category
    const catKeys = keys.filter(k => {
      const matchCat = getCategoryForKey(k) === catKey;
      if (!matchCat) return false;
      if (!query) return true;
      return k.toLowerCase().includes(query) || String(allEnterpriseSettings[k]).toLowerCase().includes(query);
    });

    if (!catKeys.length) continue;

    html += `
      <div class="border border-white/10 rounded-2xl overflow-hidden bg-[#0B1220]">
        <div class="px-5 py-3.5 bg-[#080E1A] border-b border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-base">${meta.icon}</span>
            <h3 class="font-['Oswald'] text-sm font-bold text-white uppercase tracking-wider">${meta.title}</h3>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-slate-400">${catKeys.length} Settings</span>
        </div>
        <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
    `;

    catKeys.forEach(k => {
      const val = allEnterpriseSettings[k];
      const isBool = typeof val === 'boolean';
      const isNum = typeof val === 'number';
      const isJson = typeof val === 'object' && val !== null;
      const formattedKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      html += `
        <div class="bg-[#101827] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-2 mb-2">
            <label class="text-xs font-semibold text-slate-200 tracking-wide">${formattedKey}</label>
            <span class="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">${k}</span>
          </div>
      `;

      if (isBool) {
        html += `
          <div class="flex items-center justify-between mt-1">
            <span class="text-[11px] text-slate-400">${val ? 'Enabled' : 'Disabled'}</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" data-setting-key="${k}" data-setting-type="boolean" class="sr-only peer" ${val ? 'checked' : ''} />
              <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0062b2]"></div>
            </label>
          </div>
        `;
      } else if (isNum) {
        html += `
          <input type="number" data-setting-key="${k}" data-setting-type="number" value="${val}" class="w-full bg-[#080E1A] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0062b2]" />
        `;
      } else if (isJson) {
        html += `
          <textarea rows="2" data-setting-key="${k}" data-setting-type="json" class="w-full bg-[#080E1A] border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-mono text-sky-300 focus:outline-none focus:border-[#0062b2]">${JSON.stringify(val)}</textarea>
        `;
      } else {
        html += `
          <input type="text" data-setting-key="${k}" data-setting-type="string" value="${val || ''}" class="w-full bg-[#080E1A] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0062b2]" />
        `;
      }

      html += `</div>`;
    });

    html += `</div></div>`;
  }

  container.innerHTML = html;
}

function getCategoryForKey(key) {
  if (['platform_name', 'portal_subdomain', 'brand_primary_color', 'brand_secondary_color', 'dark_mode_default', 'maintenance_mode', 'maintenance_message', 'default_timezone', 'time_format_24h', 'default_pagination_size'].includes(key)) return 'general';
  if (['google_auth_client_id', 'allowed_admin_google_emails', 'google_hosted_domain_restriction', 'session_idle_timeout_minutes', 'session_max_lifetime_hours', 'max_login_attempts', 'lockout_duration_minutes', 'admin_ip_whitelist', 'csrf_protection_enabled', 'audit_log_retention_days'].includes(key)) return 'security';
  if (key.startsWith('blogger_')) return 'blogger';
  if (key.startsWith('canvas_')) return 'graphics';
  if (key.startsWith('fotmob_') || ['min_fotmob_match_rating', 'fetch_days_past', 'fetch_days_future', 'auto_approve_whitelisted_leagues', 'show_lineup_player_photos', 'enable_cricket_icc_module', 'odds_provider_display'].includes(key)) return 'telemetry';
  if (key.startsWith('stream_') || ['default_player_engine', 'hls_low_latency_mode', 'hls_max_buffer_length_sec', 'allowed_stream_domains'].includes(key)) return 'streaming';
  if (key.startsWith('storage_') || ['cdn_cache_control_max_age', 'auto_optimize_webp', 'max_upload_size_mb', 'purge_orphan_thumbnails'].includes(key)) return 'storage';
  if (key.startsWith('default_meta_') || ['twitter_card_type', 'open_graph_site_name', 'structured_data_sports_event', 'canonical_url_format', 'robots_meta_tags', 'sitemap_ping_google', 'keywords_blacklist', 'social_share_buttons_enabled'].includes(key)) return 'seo';
  if (key.startsWith('api_cache_') || ['enable_edge_caching', 'gzip_compression_enabled', 'telemetry_collection_enabled', 'max_concurrent_thumbnail_renders', 'supabase_connection_pool_size', 'offline_cache_pwa_enabled', 'health_check_ping_interval_min'].includes(key)) return 'performance';
  return 'notifications';
}

// ==============================================================================
// SECURITY & IMMUTABLE AUDIT LOGS CONTROLLER (OWASP A09)
// ==============================================================================
async function initAuditLogs() {
  const tbody = document.getElementById('auditLogsTableBody');
  const refreshBtn = document.getElementById('refreshAuditBtn');

  async function loadLogs() {
    if (!tbody) return;
    try {
      const res = await fetch(getApiUrl('/api/audit?limit=50'), {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        renderAuditLogs(data.logs || []);
      }
    } catch (_) {
      tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-rose-400 font-sans">Failed to load audit logs.</td></tr>';
    }
  }

  function renderAuditLogs(logs) {
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500 font-sans">No audit events recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const d = new Date(l.created_at).toLocaleString();
      const actionColor = l.action.includes('DELETE') ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          l.action.includes('PUBLISH') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          'bg-sky-500/10 text-sky-400 border-sky-500/20';

      return `
        <tr class="hover:bg-white/5 transition-colors">
          <td class="py-2.5 px-4 text-slate-400 whitespace-nowrap">${d}</td>
          <td class="py-2.5 px-4 text-slate-200 font-sans font-semibold">${l.admin_email}</td>
          <td class="py-2.5 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${actionColor}">${l.action}</span></td>
          <td class="py-2.5 px-4 text-slate-300 font-sans">${l.resource_type || '-'}: ${l.resource_id || '-'}</td>
          <td class="py-2.5 px-4 text-slate-400">${l.ip_address || 'unknown'}</td>
          <td class="py-2.5 px-4 text-[11px] text-slate-400 truncate max-w-xs" title='${JSON.stringify(l.payload || {})}'>${JSON.stringify(l.payload || {})}</td>
        </tr>
      `;
    }).join('');
  }

  refreshBtn?.addEventListener('click', () => {
    loadLogs();
    showToast('✔ Audit logs refreshed', 'info');
  });

  // Initial load
  loadLogs();
}

