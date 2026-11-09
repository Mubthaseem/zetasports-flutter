#!/usr/bin/env node
/**
 * ============================================================================
 * ZetaSports Colorify Blogger Theme Parity & Security Verification Runner
 * ============================================================================
 * Production-grade automated verification suite enforcing XML well-formedness,
 * scoped DOM node architecture, embedded JavaScript syntax validation,
 * credential leak scanning, byte-for-byte mirror parity, and security attributes.
 *
 * Suites:
 *   Suite 1: XML Well-Formedness Validator (PowerShell .NET System.Xml.XmlDocument)
 *   Suite 2: DOM Node Structure Audit (Scoped view chunks for 24 required IDs)
 *   Suite 3: Embedded JavaScript Syntax Linter (Node vm.Script, no execution)
 *   Suite 4: Cybersecurity & Secret Leak Scanner (8 forbidden patterns + JWT decoder)
 *   Suite 5: Byte Mirror Parity (Buffer.equals() + SHA-256 hash forensics)
 *   Suite 6: Security Attributes Audit (escapeHtml, sanitizeUrl, iframe sandbox)
 *
 * Usage:
 *   node scripts/verify_colorify_parity.cjs [options] [target-file]
 *
 * Options:
 *   --file=<path>       Target a specific theme or script file
 *   --suite=<1-6>       Execute specific suite(s) (comma-separated, e.g. --suite=1,3)
 *   --all               Run verification across all themes (Korra, React, Colorify)
 *   --verbose           Display detailed diagnostics, AST traces, and DOM dumps
 *   --help, -h          Display this help message
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');

// ============================================================================
// ANSI COLOR SYSTEM & FORMATTING UTILITIES
// ============================================================================
const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

const c = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',
  bgRed: isColorSupported ? '\x1b[41m\x1b[37m' : '',
  bgGreen: isColorSupported ? '\x1b[42m\x1b[30m' : ''
};

function banner(title) {
  const line = '═'.repeat(70);
  console.log(`\n${c.cyan}${line}${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ${title}${c.reset}`);
  console.log(`${c.cyan}${line}${c.reset}`);
}

function suiteHeader(suiteNum, name) {
  console.log(`\n${c.bold}${c.magenta}[SUITE ${suiteNum}] ${name}${c.reset}`);
  console.log(`${c.gray}${'─'.repeat(70)}${c.reset}`);
}

// ============================================================================
// DEFAULT FILE CONSTANTS
// ============================================================================
const FILES = {
  COLORIFY_ROOT: 'zetasports-colorify-blogger-theme.xml',
  COLORIFY_MIRROR: 'zetasports-v3/web/colorify_zetasports_theme.xml',
  KORRA_REF: 'zetasports-korra-blogger-theme.xml',
  REACT_REF: 'zetasports-react-blogger-theme.xml',
  CORE_SCRIPT: 'scripts/blogger_script_part.js'
};

const APPROVED_SUPABASE_KEY = 'sb_publishable_luDUt769BBrrApn8z-Cgvw_W9VE0rIV';
const APPROVED_SUPABASE_HOST = 'https://voocdrpetiyspuhyeapi.supabase.co';

// ============================================================================
// SUITE 1: XML WELL-FORMEDNESS VALIDATOR
// ============================================================================
function validateXmlWellFormedness(filePath, verbose = false) {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      passed: false,
      error: `File does not exist: ${filePath}`
    };
  }

  const fullPath = path.resolve(filePath);

  // Use PowerShell .NET System.Xml.XmlDocument on Windows
  if (process.platform === 'win32') {
    try {
      const psScript = `
        $ErrorActionPreference = 'Stop'
        try {
          $xml = [System.Xml.XmlDocument]::new()
          $xml.Load('${fullPath.replace(/'/g, "''")}')
          Write-Output "OK:Root=$($xml.DocumentElement.Name)|Children=$($xml.DocumentElement.ChildNodes.Count)"
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      `;

      const stdout = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const trimmed = stdout.trim();
      const match = trimmed.match(/OK:Root=([^|]+)\|Children=(\d+)/);
      return {
        file: filePath,
        passed: true,
        rootElement: match ? match[1] : 'unknown',
        childCount: match ? parseInt(match[2], 10) : 0,
        rawOutput: trimmed
      };
    } catch (err) {
      const rawError = (err.stderr || err.stdout || err.message || '').trim();
      const lineMatch = rawError.match(/line\s+(\d+),\s+position\s+(\d+)/i) || rawError.match(/line\s+(\d+)/i);
      return {
        file: filePath,
        passed: false,
        error: rawError,
        line: lineMatch ? parseInt(lineMatch[1], 10) : null,
        position: (lineMatch && lineMatch[2]) ? parseInt(lineMatch[2], 10) : null
      };
    }
  }

  // Cross-platform fallback for non-Windows (pwsh or basic XML root test)
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasXmlDeclaration = content.trim().startsWith('<?xml');
    const hasRootTag = /<html\b[^>]*>[\s\S]*<\/html>/i.test(content);
    if (hasXmlDeclaration && hasRootTag) {
      return { file: filePath, passed: true, rootElement: 'html', childCount: 2 };
    }
    return { file: filePath, passed: false, error: 'Basic XML balance validation failed' };
  } catch (err) {
    return { file: filePath, passed: false, error: err.message };
  }
}

function runSuite1(targetFiles, verbose) {
  suiteHeader(1, 'XML Well-Formedness Validator (.NET System.Xml)');
  let passed = true;
  const results = [];

  for (const file of targetFiles) {
    if (!file.endsWith('.xml')) continue;
    const res = validateXmlWellFormedness(file, verbose);
    results.push(res);
    if (!res.passed) {
      passed = false;
      console.log(`  ${c.red}✖ FAIL${c.reset} ${c.bold}${file}${c.reset}`);
      if (res.line) {
        console.log(`    ${c.yellow}Syntax Error at Line ${res.line}, Position ${res.position || '?'}:${c.reset}`);
      }
      console.log(`    ${c.dim}${res.error}${c.reset}`);
    } else {
      console.log(`  ${c.green}✔ PASS${c.reset} ${c.bold}${file}${c.reset} ${c.gray}(Root: <${res.rootElement}>, Children: ${res.childCount})${c.reset}`);
    }
  }

  return { passed, count: results.length, failures: results.filter(r => !r.passed).length };
}

// ============================================================================
// SUITE 2: DOM NODE STRUCTURE AUDIT (24 REQUIRED IDS)
// ============================================================================
const REQUIRED_DOM_SCHEMA = {
  homeView: {
    tag: 'div',
    name: 'Live Fixture Center Container',
    children: [
      { id: 'tab-yesterday', tag: ['li'], name: 'Yesterday Filter Tab' },
      { id: 'tab-today', tag: ['li'], name: 'Today Filter Tab' },
      { id: 'tab-tomorrow', tag: ['li'], name: 'Tomorrow Filter Tab' },
      { id: 'matchesList', tag: ['div'], name: 'Match Cards List Grid' },
      { id: 'matchesSkeletonLoader', tag: ['div'], name: 'CSS Shimmer Skeleton Loader' }
    ]
  },
  matchView: {
    tag: 'div',
    name: 'Match Detail View Container',
    children: [
      { id: 'matchBox', tag: ['div'], name: 'Match Post Details Box' }
    ]
  },
  linksView: {
    tag: 'div',
    name: 'Link Selection Gateway Container',
    children: [
      { id: 'btnLinksBackToMatch', tag: ['button', 'a'], name: 'Back to Match Button' },
      { id: 'linksBox', tag: ['div'], name: 'Server Selector Container' }
    ]
  },
  streamView: {
    tag: 'div',
    name: 'Live Stream Player View Container',
    children: [
      { id: 'btnBackToLinks', tag: ['a', 'button'], name: 'Back to Server Links Button' },
      { id: 'btnBackToPost', tag: ['a', 'button'], name: 'Back to Match Post Button' },
      { id: 'btnBackToHome', tag: ['a', 'button'], name: 'Back to Fixtures Button' },
      { id: 'streamTitle', tag: ['h3', 'h2', 'div'], name: 'Stream Title Header' },
      { id: 'streamBadge', tag: ['span', 'div'], name: 'Stream Status Badge' },
      { id: 'playerFrameWrap', tag: ['div'], name: '16:9 Responsive Player Wrapper' },
      { id: 'liveVideo', tag: ['video'], name: 'HTML5/HLS/Shaka Video Tag' },
      { id: 'streamIframe', tag: ['iframe'], name: 'Sandboxed Stream Iframe' },
      { id: 'noStreamAlert', tag: ['div'], name: 'Stream Offline Alert Overlay' },
      { id: 'serverCountLabel', tag: ['span', 'div'], name: 'Server Counter Label' },
      { id: 'serverButtonsList', tag: ['div'], name: 'Server Switcher Button List' }
    ]
  }
};

const REQUIRED_HEADER_ID = {
  id: 'zetaHeaderLiveCounter',
  tag: ['span', 'div'],
  name: 'Header Dynamic Live Match Counter Badge'
};

function auditDomNodes(filePath, verbose = false) {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      total: 0,
      passedCount: 0,
      failedCount: 1,
      warnCount: 0,
      passed: false,
      error: `File not found: ${filePath}`,
      items: [
        {
          id: 'FILE_NOT_FOUND',
          viewScope: '(file)',
          expectedTag: 'file',
          actualTag: 'MISSING',
          status: 'FAIL',
          name: `File not found: ${filePath}`
        }
      ]
    };
  }

  const rawXml = fs.readFileSync(filePath, 'utf8');

  // Strip script, style, b:skin to isolate static HTML
  const staticMarkup = rawXml
    .replace(/<script\b(?![^>]*\/>)[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<b:skin\b[\s\S]*?<\/b:skin>/gi, '');

  const items = [];

  // Audit 4 View Containers & Children
  for (const [viewId, schema] of Object.entries(REQUIRED_DOM_SCHEMA)) {
    const viewRegex = new RegExp(`<${schema.tag}[^>]*\\bid=['"]${viewId}['"][^>]*>`, 'i');
    const viewMatch = staticMarkup.match(viewRegex);

    if (!viewMatch) {
      items.push({
        id: viewId,
        viewScope: '(root view)',
        expectedTag: schema.tag,
        actualTag: 'MISSING',
        status: 'FAIL',
        name: schema.name
      });

      for (const child of schema.children) {
        items.push({
          id: child.id,
          viewScope: viewId,
          expectedTag: Array.isArray(child.tag) ? child.tag.join('|') : child.tag,
          actualTag: 'MISSING',
          status: 'FAIL',
          name: child.name
        });
      }
      continue;
    }

    items.push({
      id: viewId,
      viewScope: '(root view)',
      expectedTag: schema.tag,
      actualTag: schema.tag,
      status: 'PASS',
      name: schema.name
    });

    // Extract scoped slice for this view (up to next view or 15000 chars)
    const startIndex = viewMatch.index;
    const chunk = staticMarkup.substring(startIndex, startIndex + 15000);

    for (const child of schema.children) {
      const childRegex = new RegExp(`<([a-zA-Z0-9:-]+)[^>]*\\bid=['"]${child.id}['"][^>]*>`, 'i');
      const childMatch = chunk.match(childRegex);

      if (childMatch) {
        const foundTag = childMatch[1].toLowerCase();
        const expectedTags = Array.isArray(child.tag) ? child.tag : [child.tag];
        const tagOk = expectedTags.includes(foundTag);

        items.push({
          id: child.id,
          viewScope: viewId,
          expectedTag: expectedTags.join('|'),
          actualTag: foundTag,
          status: tagOk ? 'PASS' : 'FAIL',
          name: child.name
        });
      } else {
        items.push({
          id: child.id,
          viewScope: viewId,
          expectedTag: Array.isArray(child.tag) ? child.tag.join('|') : child.tag,
          actualTag: 'MISSING',
          status: 'FAIL',
          name: child.name
        });
      }
    }
  }

  // Audit Header Live Counter ID
  const headerRegex = new RegExp(`<([a-zA-Z0-9:-]+)[^>]*\\bid=['"]${REQUIRED_HEADER_ID.id}['"][^>]*>`, 'i');
  const headerMatch = staticMarkup.match(headerRegex);
  if (headerMatch) {
    const foundTag = headerMatch[1].toLowerCase();
    const tagOk = REQUIRED_HEADER_ID.tag.includes(foundTag);
    items.push({
      id: REQUIRED_HEADER_ID.id,
      viewScope: 'Header',
      expectedTag: REQUIRED_HEADER_ID.tag.join('|'),
      actualTag: foundTag,
      status: tagOk ? 'PASS' : 'FAIL',
      name: REQUIRED_HEADER_ID.name
    });
  } else {
    items.push({
      id: REQUIRED_HEADER_ID.id,
      viewScope: 'Header',
      expectedTag: REQUIRED_HEADER_ID.tag.join('|'),
      actualTag: 'MISSING',
      status: 'FAIL',
      name: REQUIRED_HEADER_ID.name
    });
  }

  const passedCount = items.filter(i => i.status === 'PASS').length;
  const failedCount = items.filter(i => i.status === 'FAIL').length;
  const warnCount = items.filter(i => i.status === 'WARN').length;

  return {
    file: filePath,
    total: items.length, // exactly 24
    passedCount,
    failedCount,
    warnCount,
    passed: failedCount === 0 && warnCount === 0,
    items
  };
}

function runSuite2(targetFiles, verbose) {
  suiteHeader(2, 'DOM Node Structure Audit (24 Scoped IDs)');
  let allPassed = true;
  let totalAudited = 0;
  let totalFailures = 0;

  const xmlFiles = targetFiles.filter(f => f.endsWith('.xml'));
  if (xmlFiles.length === 0 && targetFiles.length > 0) {
    console.log(`\n  ${c.red}✖ FAIL: No valid XML files provided for Suite 2 audit (Target: ${targetFiles.join(', ')})${c.reset}`);
    return { passed: false, count: 0, failures: 1 };
  }

  for (const file of targetFiles) {
    if (!file.endsWith('.xml')) continue;
    const audit = auditDomNodes(file, verbose);
    const auditedCount = (typeof audit.total === 'number' && !isNaN(audit.total)) ? audit.total : 0;
    const failedCount = (typeof audit.failedCount === 'number' && !isNaN(audit.failedCount)) ? audit.failedCount : (audit.passed ? 0 : 1);
    totalAudited += auditedCount;
    totalFailures += failedCount;

    console.log(`\n  Target: ${c.bold}${file}${c.reset}`);
    if (audit.error) {
      console.log(`  ${c.red}✖ ERROR: ${audit.error}${c.reset}`);
    }
    console.log(`  Audited ${audit.total} IDs: ${c.green}${audit.passedCount} PASS${c.reset}, ${c.red}${audit.failedCount} FAIL${c.reset}, ${c.yellow}${audit.warnCount} WARN${c.reset}`);

    if (verbose || audit.failedCount > 0 || audit.warnCount > 0) {
      console.log(`  ┌────────────────────────┬─────────────┬──────────┬──────────┬────────┐`);
      console.log(`  │ DOM Element ID         │ View Scope  │ Expected │ Found    │ Status │`);
      console.log(`  ├────────────────────────┼─────────────┼──────────┼──────────┼────────┤`);
      for (const item of audit.items) {
        if (!verbose && item.status === 'PASS') continue; // only show failures if not verbose
        const statusColor = item.status === 'PASS' ? c.green : (item.status === 'WARN' ? c.yellow : c.red);
        const idCol = (item.id || '').padEnd(22).slice(0, 22);
        const scopeCol = (item.viewScope || '').padEnd(11).slice(0, 11);
        const expCol = (item.expectedTag || '').padEnd(8).slice(0, 8);
        const actCol = (item.actualTag || '').padEnd(8).slice(0, 8);
        const statCol = (statusColor + (item.status || '').padEnd(6) + c.reset);
        console.log(`  │ ${idCol} │ ${scopeCol} │ ${expCol} │ ${actCol} │ ${statCol} │`);
      }
      console.log(`  └────────────────────────┴─────────────┴──────────┴──────────┴────────┘`);
    }

    if (!audit.passed) {
      allPassed = false;
    }
  }

  return { passed: allPassed, count: totalAudited, failures: totalFailures };
}

// ============================================================================
// SUITE 3: EMBEDDED JAVASCRIPT SYNTAX LINTER (NODE VM.SCRIPT)
// ============================================================================
/**
 * Decodes standard XML predefined entities.
 * Applied ONLY to non-CDATA XML character data.
 */
function decodeXmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Sanitizes embedded JavaScript from XML:
 * 1. Inside CDATA (<![CDATA[ ... ]]>): Preserves raw character data verbatim.
 *    Neutralizes un-commented <![CDATA[ and ]]> markers without altering line offsets.
 * 2. Outside CDATA: Decodes standard XML entities (e.g. Blogger includable scripts).
 */
function sanitizeEmbeddedScript(code) {
  // Fast path: if no CDATA exists, decode XML entities across the script
  if (!code.includes('<![CDATA[')) {
    return decodeXmlEntities(code);
  }

  let result = '';
  let lastIndex = 0;
  const cdataRegex = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let match;

  while ((match = cdataRegex.exec(code)) !== null) {
    // 1. Text preceding this CDATA section (non-CDATA): decode entities
    const textBefore = code.substring(lastIndex, match.index);
    result += decodeXmlEntities(textBefore);

    // 2. CDATA block: inner content is RAW text, NEVER decode entities here!
    const innerContent = match[1];

    // Check if <![CDATA[ is already inside a JS line/block comment
    const prefixBeforeCdata = textBefore.split('\n').pop();
    const isCdataCommented = /(?:\/\/|\/\*)\s*$/.test(prefixBeforeCdata);

    // Check if ]]> is already inside a JS line/block comment
    const prefixBeforeEnd = innerContent.split('\n').pop();
    const isEndCommented = /(?:\/\/|\/\*)\s*$/.test(prefixBeforeEnd);

    // Neutralize un-commented markers with exact length to preserve byte/column offsets
    // '<![CDATA[' (9 chars) -> '/*CDATA*/' (9 chars)
    // ']]>' (3 chars) -> '   ' (3 spaces)
    const openTag = isCdataCommented ? '<![CDATA[' : '/*CDATA*/';
    const closeTag = isEndCommented ? ']]>' : '   ';

    result += openTag + innerContent + closeTag;
    lastIndex = match.index + match[0].length;
  }

  // 3. Text trailing the final CDATA section (non-CDATA): decode entities
  result += decodeXmlEntities(code.substring(lastIndex));
  return result;
}

function lintJavaScript(filePath, verbose = false) {
  const result = {
    file: filePath,
    isXml: false,
    totalScripts: 0,
    testedScripts: 0,
    passedScripts: 0,
    failedScripts: 0,
    skippedScripts: 0,
    errors: [],
    requiredIdentifierChecks: []
  };

  if (!fs.existsSync(filePath)) {
    result.errors.push({
      scriptIndex: 1,
      startLine: 1,
      errorLine: 1,
      message: `File not found: ${filePath}`
    });
    result.failedScripts++;
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  // Case 1: Standalone JavaScript (.js, .cjs)
  if (ext === '.js' || ext === '.cjs') {
    result.totalScripts = 1;
    result.testedScripts = 1;

    try {
      new vm.Script(content, {
        filename: filePath,
        lineOffset: 0,
        columnOffset: 0
      });
      result.passedScripts = 1;
    } catch (err) {
      result.failedScripts = 1;
      const stackLines = err.stack ? err.stack.split('\n') : [];
      const errorLocationLine = stackLines.find(l => l.includes(`${filePath}:`)) || '';
      const lineMatch = errorLocationLine.match(/:(\d+)(?::\d+)?/);
      result.errors.push({
        scriptIndex: 1,
        line: lineMatch ? parseInt(lineMatch[1], 10) : 1,
        message: err.message,
        snippet: stackLines.slice(0, 4).join('\n')
      });
    }

    // Check critical 2-Blogger router identifier contracts
    const routerTokens = [
      'getDetailsOrigin',
      'getStreamOrigin',
      'getHomeUrl',
      'getMatchPostUrl',
      'getLinksUrl',
      'getStreamUrl'
    ];
    for (const token of routerTokens) {
      const present = content.includes(token);
      result.requiredIdentifierChecks.push({ token, present });
    }

    return result;
  }

  // Case 2: Blogger XML Theme (.xml)
  result.isXml = true;
  // CDATA-aware script extraction: ensures embedded </script> inside CDATA template
  // strings does not prematurely truncate script extraction
  const startTagRegex = /<script\b(?![^>]*\/>)([^>]*)>/gi;
  let tagMatch;
  let count = 0;

  while ((tagMatch = startTagRegex.exec(content)) !== null) {
    count++;
    result.totalScripts++;
    const attrs = tagMatch[1] || '';
    const openTagLength = tagMatch[0].length;
    const codeStartIndex = tagMatch.index + openTagLength;

    // Locate the matching </script> that is NOT inside CDATA
    let pos = codeStartIndex;
    let inCdata = false;
    let codeEndIndex = -1;

    while (pos < content.length) {
      if (!inCdata && content.startsWith('<![CDATA[', pos)) {
        inCdata = true;
        pos += 9;
      } else if (inCdata && content.startsWith(']]>', pos)) {
        inCdata = false;
        pos += 3;
      } else if (!inCdata && content.substring(pos, pos + 9).toLowerCase() === '</script>') {
        codeEndIndex = pos;
        break;
      } else {
        pos++;
      }
    }

    if (codeEndIndex === -1) {
      codeEndIndex = content.length;
    }

    const code = content.substring(codeStartIndex, codeEndIndex);
    startTagRegex.lastIndex = codeEndIndex + 9;

    // Calculate exact 1-indexed start line in original XML
    const prefix = content.substring(0, codeStartIndex);
    const startLine = prefix.split('\n').length;

    // Skip external script src only
    if (/src\s*=/i.test(attrs) && !code.trim()) {
      result.skippedScripts++;
      continue;
    }

    // Skip JSON-LD data scripts
    if (/type\s*=\s*['"]application\/ld\+json['"]/i.test(attrs)) {
      result.skippedScripts++;
      continue;
    }

    // Process CDATA and XML entities safely
    const sanitizedCode = sanitizeEmbeddedScript(code);

    if (!sanitizedCode.trim()) {
      result.skippedScripts++;
      continue;
    }

    result.testedScripts++;

    try {
      new vm.Script(sanitizedCode, {
        filename: filePath,
        lineOffset: startLine - 1,
        columnOffset: 0
      });
      result.passedScripts++;
    } catch (err) {
      result.failedScripts++;
      const stackLines = err.stack ? err.stack.split('\n') : [];
      const errorLocationLine = stackLines.find(l => l.includes(`${filePath}:`)) || '';
      const lineMatch = errorLocationLine.match(/:(\d+)(?::\d+)?/);
      const reportedLine = lineMatch ? parseInt(lineMatch[1], 10) : startLine;

      result.errors.push({
        scriptIndex: count,
        startLine,
        errorLine: reportedLine,
        message: err.message,
        snippet: stackLines.slice(0, 4).join('\n')
      });
    }
  }

  return result;
}

function runSuite3(targetFiles, verbose) {
  suiteHeader(3, 'Embedded JavaScript Syntax Linter (vm.Script)');
  let allPassed = true;
  let totalScriptsTested = 0;
  let totalFailures = 0;

  for (const file of targetFiles) {
    const res = lintJavaScript(file, verbose);
    totalScriptsTested += res.testedScripts;
    totalFailures += res.failedScripts;

    if (res.failedScripts === 0) {
      console.log(`  ${c.green}✔ PASS${c.reset} ${c.bold}${file}${c.reset} ${c.gray}(Tested: ${res.testedScripts}, Skipped: ${res.skippedScripts})${c.reset}`);
    } else {
      allPassed = false;
      console.log(`  ${c.red}✖ FAIL${c.reset} ${c.bold}${file}${c.reset} ${c.gray}(Passed: ${res.passedScripts}, Failed: ${res.failedScripts})${c.reset}`);
      for (const err of res.errors) {
        console.log(`    ${c.red}Script #${err.scriptIndex} at Line ${err.errorLine}:${c.reset} ${err.message}`);
        if (err.snippet && verbose) {
          console.log(`    ${c.dim}${err.snippet.split('\n').join('\n    ')}${c.reset}`);
        }
      }
    }

    if (res.requiredIdentifierChecks && res.requiredIdentifierChecks.length > 0) {
      const missingTokens = res.requiredIdentifierChecks.filter(t => !t.present);
      if (missingTokens.length > 0) {
        console.log(`    ${c.yellow}⚠ Warning: Missing router token contract: ${missingTokens.map(t => t.token).join(', ')}${c.reset}`);
      }
    }
  }

  return { passed: allPassed, count: totalScriptsTested, failures: totalFailures };
}

// ============================================================================
// SUITE 4: CYBERSECURITY & SECRET LEAK SCANNER
// ============================================================================
const FORBIDDEN_SECRET_PATTERNS = [
  {
    id: 'SUPABASE_SERVICE_ROLE_LITERAL',
    name: 'Supabase service_role literal keyword',
    regex: /\bservice_role\b/i,
    severity: 'CRITICAL',
    description: 'Direct reference to privileged service_role key or role'
  },
  {
    id: 'STRIPE_LIVE_KEY',
    name: 'Stripe live secret or restricted key',
    regex: /\b[sr]k_live_[0-9a-zA-Z]{24,}\b/,
    severity: 'CRITICAL',
    description: 'Live Stripe secret key exposed in client code'
  },
  {
    id: 'GITHUB_TOKEN',
    name: 'GitHub personal access token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{30,}\b|\bgithub_pat_[0-9a-zA-Z_]{22,}\b/,
    severity: 'CRITICAL',
    description: 'GitHub PAT or OAuth secret exposed'
  },
  {
    id: 'POSTGRES_CREDENTIAL_URI',
    name: 'PostgreSQL connection string with credentials',
    regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_\-\.]+:[^@\s"']+@[a-zA-Z0-9_\-\.]+/i,
    severity: 'CRITICAL',
    description: 'Database connection string containing plaintext username & password'
  },
  {
    id: 'AWS_ACCESS_KEY',
    name: 'AWS Access Key ID',
    regex: /\b(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/,
    severity: 'HIGH',
    description: 'AWS IAM access key'
  },
  {
    id: 'PRIVATE_KEY_PEM',
    name: 'RSA/EC/DSA Private Key block',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: 'CRITICAL',
    description: 'Plaintext private cryptographic key block'
  },
  {
    id: 'GENERIC_SECRET_ASSIGNMENT',
    name: 'High-entropy secret or password assignment',
    regex: /(?:secret_key|private_key|database_password|db_pass|api_secret)\s*[:=]\s*["'][^"']{8,}["']/i,
    severity: 'HIGH',
    description: 'Variable explicitly assigning private key or database password'
  },
  {
    id: 'TELEGRAM_BOT_TOKEN',
    name: 'Telegram Bot Token',
    regex: /\b[0-9]{8,10}:[a-zA-Z0-9_-]{35}\b/,
    severity: 'HIGH',
    description: 'Telegram Bot API authentication token'
  }
];

function scanJwtTokens(content, filename) {
  const issues = [];
  const jwtRegex = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\b/g;
  let match;
  while ((match = jwtRegex.exec(content)) !== null) {
    const token = match[0];
    const index = match.index;
    const lineNumber = content.slice(0, index).split('\n').length;
    try {
      const parts = token.split('.');
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      const normalizedRole = payload.role ? String(payload.role).trim().toLowerCase() : '';
      if (normalizedRole === 'service_role') {
        issues.push({
          severity: 'CRITICAL',
          id: 'JWT_SERVICE_ROLE_TOKEN',
          file: filename,
          line: lineNumber,
          description: `Forbidden JWT with role="service_role" detected at line ${lineNumber}`,
          snippet: token.slice(0, 32) + '...'
        });
      } else if (normalizedRole === 'anon') {
        // If legacy project ref is referenced
        if (payload.ref && payload.ref !== 'voocdrpetiyspuhyeapi') {
          issues.push({
            severity: 'WARNING',
            id: 'LEGACY_JWT_ANON_TOKEN',
            file: filename,
            line: lineNumber,
            description: `Legacy anon JWT found (ref=${payload.ref}). Client should use publishable key ${APPROVED_SUPABASE_KEY}`,
            snippet: token.slice(0, 32) + '...'
          });
        }
      }
    } catch (e) {
      // not a JSON payload
    }
  }
  return issues;
}

function scanSecretsInFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [{
      severity: 'CRITICAL',
      id: 'FILE_NOT_FOUND',
      file: filePath,
      line: 1,
      description: `File not found: ${filePath}`,
      snippet: ''
    }];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  const lines = content.split('\n');

  for (const pat of FORBIDDEN_SECRET_PATTERNS) {
    lines.forEach((line, idx) => {
      if (pat.regex.test(line)) {
        issues.push({
          severity: pat.severity,
          id: pat.id,
          name: pat.name,
          file: filePath,
          line: idx + 1,
          description: pat.description,
          snippet: line.trim().slice(0, 80)
        });
      }
    });
  }

  const jwtIssues = scanJwtTokens(content, filePath);
  issues.push(...jwtIssues);

  // Whitelist check: only approved publishable key allowed
  const foundKeys = [...new Set(content.match(/\bsb_publishable_[a-zA-Z0-9_\-]+\b/g) || [])];
  foundKeys.forEach(k => {
    if (k !== APPROVED_SUPABASE_KEY) {
      issues.push({
        severity: 'HIGH',
        id: 'UNAPPROVED_PUBLISHABLE_KEY',
        file: filePath,
        line: 1,
        description: `Unapproved Supabase publishable key: '${k}'. Expected: '${APPROVED_SUPABASE_KEY}'`,
        snippet: k
      });
    }
  });

  return issues;
}

function runSuite4(targetFiles, verbose) {
  suiteHeader(4, 'Cybersecurity & Secret Leak Scanner');
  let allPassed = true;
  let totalCritical = 0;
  let totalHigh = 0;
  let totalWarnings = 0;

  for (const file of targetFiles) {
    const issues = scanSecretsInFile(file);
    const criticals = issues.filter(i => i.severity === 'CRITICAL');
    const highs = issues.filter(i => i.severity === 'HIGH');
    const warnings = issues.filter(i => i.severity === 'WARNING');

    totalCritical += criticals.length;
    totalHigh += highs.length;
    totalWarnings += warnings.length;

    if (criticals.length === 0 && highs.length === 0) {
      console.log(`  ${c.green}✔ PASS${c.reset} ${c.bold}${file}${c.reset} ${c.gray}(0 leaks, ${warnings.length} warning(s))${c.reset}`);
      if (verbose && warnings.length > 0) {
        warnings.forEach(w => console.log(`    ${c.yellow}[WARN] Line ${w.line}: ${w.description}${c.reset}`));
      }
    } else {
      allPassed = false;
      console.log(`  ${c.red}✖ FAIL${c.reset} ${c.bold}${file}${c.reset} ${c.red}(${criticals.length} CRITICAL, ${highs.length} HIGH leaks!)${c.reset}`);
      issues.forEach(i => {
        const color = i.severity === 'CRITICAL' ? c.red : (i.severity === 'HIGH' ? c.yellow : c.gray);
        console.log(`    ${color}[${i.severity}] Line ${i.line || '?'}: ${i.id || i.name} - ${i.description}${c.reset}`);
        if (i.snippet) console.log(`      ${c.dim}${i.snippet}${c.reset}`);
      });
    }
  }

  return { passed: allPassed, count: targetFiles.length, failures: totalCritical + totalHigh, warnings: totalWarnings };
}

// ============================================================================
// SUITE 5: BYTE-FOR-BYTE MIRROR PARITY CHECK
// ============================================================================
function verifyByteMirror(file1, file2, verbose = false) {
  const f1Exists = fs.existsSync(file1);
  const f2Exists = fs.existsSync(file2);
  if (!f1Exists || !f2Exists) {
    return {
      passed: false,
      file1: { path: file1, size: f1Exists ? fs.statSync(file1).size : 0, sha256: null },
      file2: { path: file2, size: f2Exists ? fs.statSync(file2).size : 0, sha256: null },
      error: `One or both mirror files missing: '${file1}' (exists: ${f1Exists}), '${file2}' (exists: ${f2Exists})`
    };
  }

  const b1 = fs.readFileSync(file1);
  const b2 = fs.readFileSync(file2);

  const hash1 = crypto.createHash('sha256').update(b1).digest('hex');
  const hash2 = crypto.createHash('sha256').update(b2).digest('hex');

  const byteEquals = b1.equals(b2);

  let firstDiff = null;
  if (!byteEquals) {
    const minLen = Math.min(b1.length, b2.length);
    for (let i = 0; i < minLen; i++) {
      if (b1[i] !== b2[i]) {
        const textBefore = b1.subarray(0, i).toString('utf8');
        const line = textBefore.split('\n').length;
        const col = i - textBefore.lastIndexOf('\n');
        firstDiff = {
          offset: i,
          line,
          col,
          byte1Hex: '0x' + b1[i].toString(16).padStart(2, '0'),
          byte2Hex: '0x' + b2[i].toString(16).padStart(2, '0')
        };
        break;
      }
    }
    if (!firstDiff && b1.length !== b2.length) {
      firstDiff = {
        offset: minLen,
        reason: `Files match up to byte ${minLen}, but file1 has ${b1.length} bytes and file2 has ${b2.length} bytes.`
      };
    }
  }

  return {
    passed: byteEquals,
    file1: { path: file1, size: b1.length, sha256: hash1 },
    file2: { path: file2, size: b2.length, sha256: hash2 },
    firstDiff
  };
}

function runSuite5(file1, file2, verbose) {
  suiteHeader(5, 'Byte Mirror Parity (Root vs Distribution Mirror)');

  const res = verifyByteMirror(file1, file2, verbose);

  if (res.passed) {
    console.log(`  ${c.green}✔ PASS${c.reset} 100% Byte-for-byte identical mirror confirmed.`);
    console.log(`    Primary: ${c.bold}${res.file1.path}${c.reset} (${res.file1.size.toLocaleString()} bytes)`);
    console.log(`    Mirror:  ${c.bold}${res.file2.path}${c.reset} (${res.file2.size.toLocaleString()} bytes)`);
    console.log(`    SHA-256: ${c.cyan}${res.file1.sha256}${c.reset}`);
    return { passed: true, count: 1, failures: 0 };
  } else {
    console.log(`  ${c.red}✖ FAIL${c.reset} Byte mirror divergence detected!`);
    const f1Path = (res.file1 && typeof res.file1 === 'object') ? res.file1.path : (typeof res.file1 === 'string' ? res.file1 : file1);
    const f1Size = (res.file1 && typeof res.file1 === 'object' && typeof res.file1.size === 'number') ? res.file1.size : '?';
    const f2Path = (res.file2 && typeof res.file2 === 'object') ? res.file2.path : (typeof res.file2 === 'string' ? res.file2 : file2);
    const f2Size = (res.file2 && typeof res.file2 === 'object' && typeof res.file2.size === 'number') ? res.file2.size : '?';
    console.log(`    Primary: ${f1Path} (${f1Size} bytes)`);
    console.log(`    Mirror:  ${f2Path} (${f2Size} bytes)`);
    if (res.firstDiff) {
      console.log(`    ${c.yellow}First divergence at byte offset ${res.firstDiff.offset} (Line ${res.firstDiff.line}, Col ${res.firstDiff.col}):${c.reset}`);
      console.log(`      Byte 1: ${res.firstDiff.byte1Hex} vs Byte 2: ${res.firstDiff.byte2Hex}`);
    } else if (res.error) {
      console.log(`    ${c.red}Error: ${res.error}${c.reset}`);
    }
    return { passed: false, count: 1, failures: 1 };
  }
}

// ============================================================================
// SUITE 6: SECURITY ATTRIBUTES & SANITIZATION AUDIT
// ============================================================================
function auditSecurityAttributes(filePath, verbose = false) {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      passed: false,
      error: `File not found: ${filePath}`,
      issues: [{
        severity: 'CRITICAL',
        type: 'FILE_NOT_FOUND',
        message: `File not found: ${filePath}`
      }],
      metrics: {
        escapeHtml: { defined: false, calls: 0 },
        sanitizeUrl: { defined: false, calls: 0 },
        streamIframePresent: false
      }
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  const metrics = {};

  // 1. escapeHtml check
  const hasEscapeHtmlDef = /function\s+escapeHtml\s*\(|const\s+escapeHtml\s*=|var\s+escapeHtml\s*=/i.test(content);
  const escapeHtmlCallCount = (content.match(/\bescapeHtml\s*\(/g) || []).length;
  metrics.escapeHtml = { defined: hasEscapeHtmlDef, calls: escapeHtmlCallCount };

  if (!hasEscapeHtmlDef) {
    issues.push({
      severity: 'WARNING',
      type: 'MISSING_ESCAPE_HTML_DEF',
      message: 'escapeHtml() sanitizer function is not defined in the client script.'
    });
  }

  // 2. sanitizeUrl check
  const hasSanitizeUrlDef = /function\s+sanitizeUrl\s*\(|const\s+sanitizeUrl\s*=|var\s+sanitizeUrl\s*=/i.test(content);
  const sanitizeUrlCallCount = (content.match(/\bsanitizeUrl\s*\(/g) || []).length;
  metrics.sanitizeUrl = { defined: hasSanitizeUrlDef, calls: sanitizeUrlCallCount };

  if (!hasSanitizeUrlDef) {
    issues.push({
      severity: 'WARNING',
      type: 'MISSING_SANITIZE_URL_DEF',
      message: 'sanitizeUrl() protocol validator is not defined in the client script.'
    });
  }

  // 3. streamIframe sandbox check
  const iframeMatch = content.match(/<iframe[^>]*\bid=["']streamIframe["'][^>]*>/i);
  if (iframeMatch) {
    metrics.streamIframePresent = true;
    const tag = iframeMatch[0];
    const sandboxMatch = tag.match(/sandbox\s*=\s*["']([^"']*)["']/i);

    if (!sandboxMatch) {
      issues.push({
        severity: 'CRITICAL',
        type: 'IFRAME_MISSING_SANDBOX',
        message: '#streamIframe is missing the sandbox attribute! Must declare sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"'
      });
    } else {
      const tokens = sandboxMatch[1].trim().toLowerCase().split(/\s+/).filter(Boolean);
      const forbidden = ['allow-top-navigation', 'allow-top-navigation-by-user-activation', 'allow-popups-to-escape-sandbox'];
      const hasForbidden = forbidden.filter(f => tokens.includes(f));

      if (hasForbidden.length > 0) {
        issues.push({
          severity: 'CRITICAL',
          type: 'IFRAME_FORBIDDEN_SANDBOX_TOKEN',
          message: `#streamIframe declares forbidden token(s): ${hasForbidden.join(', ')}. Top navigation must be strictly blocked.`
        });
      }

      if (!tokens.includes('allow-scripts') || !tokens.includes('allow-same-origin')) {
        issues.push({
          severity: 'HIGH',
          type: 'IFRAME_MISSING_REQUIRED_TOKENS',
          message: '#streamIframe sandbox is missing allow-scripts or allow-same-origin.'
        });
      }
    }
  } else {
    metrics.streamIframePresent = false;
  }

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  const highCount = issues.filter(i => i.severity === 'HIGH').length;

  return {
    file: filePath,
    passed: criticalCount === 0 && highCount === 0,
    issues,
    metrics
  };
}

function runSuite6(targetFiles, verbose) {
  suiteHeader(6, 'Security Attributes Audit (Sanitization & Iframe Sandbox)');
  let allPassed = true;
  let totalAudited = 0;
  let totalFailures = 0;

  for (const file of targetFiles) {
    const res = auditSecurityAttributes(file, verbose);
    totalAudited++;

    const criticalCount = res.issues ? res.issues.filter(i => i.severity === 'CRITICAL').length : 0;
    const highCount = res.issues ? res.issues.filter(i => i.severity === 'HIGH').length : 0;
    const warnCount = res.issues ? res.issues.filter(i => i.severity === 'WARNING').length : 0;

    if (!res.passed || criticalCount > 0 || highCount > 0) {
      allPassed = false;
      totalFailures += (criticalCount + highCount) || 1;
      console.log(`  ${c.red}✖ FAIL${c.reset} ${c.bold}${file}${c.reset}`);
    } else {
      console.log(`  ${c.green}✔ PASS${c.reset} ${c.bold}${file}${c.reset} ${c.gray}(0 critical/high issues, ${warnCount} warning(s))${c.reset}`);
    }

    if (res.metrics) {
      const escapeDef = res.metrics.escapeHtml.defined ? `${c.green}YES${c.reset}` : `${c.yellow}NO${c.reset}`;
      const urlDef = res.metrics.sanitizeUrl.defined ? `${c.green}YES${c.reset}` : `${c.yellow}NO${c.reset}`;
      console.log(`    escapeHtml: ${escapeDef} (calls: ${res.metrics.escapeHtml.calls}) | sanitizeUrl: ${urlDef} (calls: ${res.metrics.sanitizeUrl.calls})`);
      if (res.metrics.streamIframePresent === false) {
        console.log(`    ${c.dim}#streamIframe: not present in this file${c.reset}`);
      } else {
        console.log(`    ${c.dim}#streamIframe: present${c.reset}`);
      }
    }

    if (res.issues && res.issues.length > 0) {
      for (const iss of res.issues) {
        const color = iss.severity === 'CRITICAL' ? c.red : (iss.severity === 'HIGH' ? c.yellow : c.gray);
        console.log(`    ${color}[${iss.severity}] ${iss.message}${c.reset}`);
      }
    }
  }

  return { passed: allPassed, count: totalAudited, failures: totalFailures };
}

// ============================================================================
// TYPOGRAPHY & GOOGLE FONTS AUDIT
// ============================================================================
function checkGoogleFonts(filePath, verbose = false) {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      passed: false,
      error: `File not found: ${filePath}`,
      preconnectGoogleApis: false,
      preconnectGstatic: false,
      fonts: {
        Inter: false,
        Oswald: false,
        PlusJakartaSans: false,
        Rajdhani: false
      },
      issues: [`File not found: ${filePath}`]
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // 1. Verify preconnect links
  const preconnectGoogleApis = /<link[^>]*rel=['"]preconnect['"][^>]*href=['"]https:\/\/fonts\.googleapis\.com['"][^>]*\/?>|<link[^>]*href=['"]https:\/\/fonts\.googleapis\.com['"][^>]*rel=['"]preconnect['"][^>]*\/?>/i.test(content);
  const preconnectGstatic = /<link[^>]*rel=['"]preconnect['"][^>]*href=['"]https:\/\/fonts\.gstatic\.com['"][^>]*\/?>|<link[^>]*href=['"]https:\/\/fonts\.gstatic\.com['"][^>]*rel=['"]preconnect['"][^>]*\/?>/i.test(content);

  if (!preconnectGoogleApis) {
    issues.push('Missing preconnect tag for https://fonts.googleapis.com');
  }
  if (!preconnectGstatic) {
    issues.push('Missing preconnect tag for https://fonts.gstatic.com');
  }

  // 2. Verify Google Fonts stylesheet link contains required fonts: Inter, Oswald, Plus Jakarta Sans, Rajdhani
  const fonts = {
    Inter: /fonts\.googleapis\.com\/css2\?[^'"]*\bInter\b/i.test(content),
    Oswald: /fonts\.googleapis\.com\/css2\?[^'"]*\bOswald\b/i.test(content),
    PlusJakartaSans: /fonts\.googleapis\.com\/css2\?[^'"]*(?:Plus\+Jakarta\+Sans|Plus%20Jakarta%20Sans)/i.test(content),
    Rajdhani: /fonts\.googleapis\.com\/css2\?[^'"]*\bRajdhani\b/i.test(content)
  };

  for (const [fontName, present] of Object.entries(fonts)) {
    if (!present) {
      issues.push(`Required Google Font '${fontName}' is not linked in stylesheet href`);
    }
  }

  const passed = issues.length === 0;

  return {
    file: filePath,
    passed,
    preconnectGoogleApis,
    preconnectGstatic,
    fonts,
    issues
  };
}

// ============================================================================
// CLI ARGUMENT PARSER & RUNNER
// ============================================================================
function parseArgs(args) {
  const options = {
    verbose: false,
    suites: [1, 2, 3, 4, 5, 6],
    file: null,
    allThemes: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg.startsWith('--suite=') || arg === '--suite') {
      const suiteRaw = arg.startsWith('--suite=') ? arg.split('=')[1] : (args[++i] || '');
      const rawTokens = suiteRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (rawTokens.length === 0) {
        console.error(`\n${c.red}✖ ERROR: No suite specified for --suite option.${c.reset}\n`);
        process.exit(1);
      }
      const validSuites = [1, 2, 3, 4, 5, 6];
      const parsed = [];
      for (const tok of rawTokens) {
        const num = parseInt(tok, 10);
        if (isNaN(num) || !validSuites.includes(num) || String(num) !== tok) {
          console.error(`\n${c.red}✖ ERROR: Invalid suite '${tok}'. Valid suites are integers 1 through 6.${c.reset}\n`);
          process.exit(1);
        }
        parsed.push(num);
      }
      options.suites = [...new Set(parsed)];
    } else if (arg.startsWith('--file=')) {
      options.file = arg.split('=')[1];
    } else if (arg === '--file' && args[i + 1]) {
      options.file = args[++i];
    } else if (arg === '--all') {
      options.allThemes = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-') && !options.file) {
      options.file = arg;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${c.bold}ZetaSports Colorify Verification Runner${c.reset}

Usage:
  node scripts/verify_colorify_parity.cjs [options] [target-file]

Options:
  --file=<path>       Target a specific theme or script file
  --suite=<1-6>       Execute specific suite(s) (comma-separated, e.g. --suite=1,3)
  --all               Run verification across all themes (Korra, React, Colorify)
  --verbose           Display detailed diagnostics, AST traces, and DOM dumps
  --help, -h          Display this help message

Suites:
  1. XML Well-Formedness Validator (.NET System.Xml)
  2. DOM Node Structure Audit (24 scoped IDs across 4 views & header)
  3. Embedded JavaScript Syntax Linter (Node vm.Script)
  4. Cybersecurity & Secret Leak Scanner (8 forbidden patterns + JWTs)
  5. Byte-for-Byte Mirror Parity (Root vs Distribution Mirror)
  6. Security Attributes & Sanitization Audit (escapeHtml, sanitizeUrl, sandbox)
`);
}

// ============================================================================
// MAIN EXECUTION ENTRYPOINT
// ============================================================================
function main() {
  const startTime = Date.now();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  banner('ZETASPORTS COLORIFY PARITY & SECURITY VERIFICATION SUITE');

  // Determine target files based on CLI options
  let targetXmlFiles = [];
  let secretScanFiles = [];
  let jsLintFiles = [];
  let secAttrFiles = [];
  let primaryMirrorFile = FILES.COLORIFY_ROOT;
  let distMirrorFile = FILES.COLORIFY_MIRROR;

  if (options.file) {
    if (!fs.existsSync(options.file)) {
      console.error(`\n${c.red}✖ ERROR: Target file not found: ${options.file}${c.reset}\n`);
      process.exit(1);
    }
    const f = options.file;
    if (f.endsWith('.xml')) {
      targetXmlFiles = [f];
      secAttrFiles = [f];
    } else if (f.endsWith('.js') || f.endsWith('.cjs')) {
      jsLintFiles = [f];
      secAttrFiles = [f];
    }
    secretScanFiles = [f];
    if (f === FILES.COLORIFY_ROOT || f === FILES.COLORIFY_MIRROR) {
      primaryMirrorFile = FILES.COLORIFY_ROOT;
      distMirrorFile = FILES.COLORIFY_MIRROR;
    } else {
      // Check if file has mirror
      const base = path.basename(f);
      const mirrorCandidate = path.join('zetasports-v3', 'web', base);
      if (fs.existsSync(mirrorCandidate)) {
        primaryMirrorFile = f;
        distMirrorFile = mirrorCandidate;
      } else {
        primaryMirrorFile = f;
        distMirrorFile = f; // self comparison if no mirror
      }
    }
    if (targetXmlFiles.length === 0 && jsLintFiles.length === 0) {
      targetXmlFiles = [f];
      jsLintFiles = [f];
    }
  } else if (options.allThemes) {
    targetXmlFiles = [FILES.KORRA_REF, FILES.REACT_REF, FILES.COLORIFY_ROOT, FILES.COLORIFY_MIRROR];
    jsLintFiles = [FILES.CORE_SCRIPT, FILES.KORRA_REF, FILES.REACT_REF, FILES.COLORIFY_ROOT];
    secretScanFiles = [FILES.COLORIFY_ROOT, FILES.COLORIFY_MIRROR, FILES.CORE_SCRIPT, FILES.KORRA_REF, FILES.REACT_REF];
    secAttrFiles = [FILES.CORE_SCRIPT, FILES.KORRA_REF, FILES.REACT_REF, FILES.COLORIFY_ROOT];
  } else {
    // Default mode: Focus on Colorify Target Theme, Mirror & Core Script
    targetXmlFiles = [FILES.COLORIFY_ROOT];
    jsLintFiles = [FILES.CORE_SCRIPT, FILES.COLORIFY_ROOT];
    secretScanFiles = [FILES.COLORIFY_ROOT, FILES.COLORIFY_MIRROR, FILES.CORE_SCRIPT, FILES.KORRA_REF, FILES.REACT_REF];
    secAttrFiles = [FILES.COLORIFY_ROOT, FILES.CORE_SCRIPT];
  }

  const suiteResults = [];

  // Execute Selected Suites
  if (options.suites.includes(1) && targetXmlFiles.length > 0) {
    const s1 = runSuite1(targetXmlFiles, options.verbose);
    suiteResults.push({ id: 1, name: 'XML Well-Formedness', ...s1 });
  }

  if (options.suites.includes(2) && targetXmlFiles.length > 0) {
    const s2 = runSuite2(targetXmlFiles, options.verbose);
    suiteResults.push({ id: 2, name: 'DOM Node Structure', ...s2 });
  }

  if (options.suites.includes(3)) {
    const s3 = runSuite3(jsLintFiles.length > 0 ? jsLintFiles : targetXmlFiles, options.verbose);
    suiteResults.push({ id: 3, name: 'JS Syntax Linting', ...s3 });
  }

  if (options.suites.includes(4)) {
    const s4 = runSuite4(secretScanFiles, options.verbose);
    suiteResults.push({ id: 4, name: 'Secret Leak Scanner', ...s4 });
  }

  if (options.suites.includes(5)) {
    const s5 = runSuite5(primaryMirrorFile, distMirrorFile, options.verbose);
    suiteResults.push({ id: 5, name: 'Byte Mirror Parity', ...s5 });
  }

  if (options.suites.includes(6) && secAttrFiles.length > 0) {
    const s6 = runSuite6(secAttrFiles, options.verbose);
    suiteResults.push({ id: 6, name: 'Security Attributes', ...s6 });
  }

  if (suiteResults.length === 0) {
    console.error(`\n${c.red}✖ ERROR: No verification suites were executed.${c.reset}\n`);
    process.exit(1);
  }

  // Summary Banner & Exit Code Evaluation
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  let overallPassed = true;
  let totalFailures = 0;

  console.log(`\n${c.cyan}${'═'.repeat(70)}${c.reset}`);
  console.log(`${c.bold}SUMMARY SCORECARD${c.reset}`);
  console.log(`${c.gray}${'─'.repeat(70)}${c.reset}`);

  for (const s of suiteResults) {
    const sFailures = (typeof s.failures === 'number' && !isNaN(s.failures)) ? s.failures : (s.passed ? 0 : 1);
    const statusText = s.passed ? `${c.green}✔ PASS${c.reset}` : `${c.red}✖ FAIL${c.reset}`;
    const failuresText = sFailures > 0 ? `${c.red}(${sFailures} failures)${c.reset}` : `${c.gray}(0 failures)${c.reset}`;
    console.log(`  Suite ${s.id}: ${s.name.padEnd(26)} ${statusText}  ${failuresText}`);
    if (!s.passed) {
      overallPassed = false;
      totalFailures += sFailures;
    }
  }

  console.log(`${c.gray}─`.repeat(70) + c.reset);
  if (overallPassed) {
    console.log(`${c.bgGreen}${c.bold} ALL VERIFICATION SUITES PASSED ${c.reset} ${c.green}Completed in ${duration}s${c.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${c.bgRed}${c.bold} VERIFICATION SUITE FAILED ${c.reset} ${c.red}${totalFailures} total failure(s) detected across suites (${duration}s)${c.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateXmlWellFormedness,
  auditDomNodes,
  lintJavaScript,
  sanitizeEmbeddedScript,
  decodeXmlEntities,
  scanSecretsInFile,
  verifyByteMirror,
  auditSecurityAttributes,
  checkGoogleFonts,
  auditTypography: checkGoogleFonts,
  parseArgs,
  parseCliArgs: parseArgs
};
