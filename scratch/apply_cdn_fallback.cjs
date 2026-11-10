const fs = require('fs');
const path = require('path');

const target = '<link rel="stylesheet" href="https://udlncusvhmydivtjkjcy.supabase.co/storage/v1/object/public/scripts/zetasports-core.css" id="zetasports-core-css"/>';
const replacement = '<link rel="stylesheet" href="https://udlncusvhmydivtjkjcy.supabase.co/storage/v1/object/public/scripts/zetasports-core.css" id="zetasports-core-css" onerror="this.onerror=null;this.href=\'https://cdn.jsdelivr.net/gh/Mubthaseem/zetasports-flutter@main/web/css/zetasports-core.css\';"/>';

const files = [
  'zetasports-colorify-blogger-theme.xml',
  'zetasports-v3/web/colorify_zetasports_theme.xml',
  'project/src/zetasports-colorify-blogger-theme.xml',
  'zetasports-korra-blogger-theme.xml',
  'project/src/zetasports-korra-blogger-theme.xml'
];

files.forEach(f => {
  const p = path.resolve(f);
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    if (c.includes(target)) {
      c = c.replace(target, replacement);
      fs.writeFileSync(p, c, 'utf8');
      console.log('SUCCESS: Added CDN fallback to', f);
    } else {
      console.warn('Target not found in', f);
    }
  }
});
