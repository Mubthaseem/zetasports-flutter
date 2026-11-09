import fs from 'fs';

console.log('--- Checking Blogger Themes ---');
['zetasports-korra-blogger-theme.xml', 'zetasports-react-blogger-theme.xml'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  console.log(f, {
    hasLinksView: c.includes('id="linksView"'),
    hasLinksBox: c.includes('id="linksBox"'),
    hasStreamView: c.includes('id="streamView"'),
    hasBtnBackToLinks: c.includes('id="btnBackToLinks"'),
    hasCleanDomain: c.includes('cleanDomain'),
    hasGetLinksUrl: c.includes('getLinksUrl'),
    hasGetStreamUrl: c.includes('getStreamUrl'),
    hasOpenLinksPage: c.includes('openLinksPage')
  });
});

console.log('--- Checking Worker Routes ---');
const workerCode = fs.readFileSync('zetasports-v3/cloudflare-worker/worker.js', 'utf8');
console.log('worker.js:', {
  hasLinksRoute: workerCode.includes("url.pathname.startsWith('/links/')"),
  hasStreamRoute: workerCode.includes("url.pathname.startsWith('/stream/')"),
  hasMatchRedirect: workerCode.includes("url.pathname.startsWith('/r/')")
});

console.log('--- Checking serve.js ---');
const serveCode = fs.readFileSync('zetasports-v3/admin_v3/serve.js', 'utf8');
console.log('serve.js:', {
  hasLinksUrlInBroadcastGuide: serveCode.includes('?links=${m.id}'),
  hasCtaButton: serveCode.includes('zeta-live-server-cta')
});

console.log('--- Checking Admin Panel ---');
const htmlCode = fs.readFileSync('zetasports-v3/admin_frontend/index.html', 'utf8');
const appCode = fs.readFileSync('zetasports-v3/admin_frontend/app.js', 'utf8');
console.log('admin_frontend:', {
  hasCfgDetailsDomain: htmlCode.includes('id="cfgDetailsDomain"'),
  hasCfgStreamDomain: htmlCode.includes('id="cfgStreamDomain"'),
  hasDrawerCopyLinksUrlBtn: htmlCode.includes('id="drawerCopyLinksUrlBtn"'),
  hasDrawerCopyStreamUrlBtn: htmlCode.includes('id="drawerCopyStreamUrlBtn"'),
  hasCopyLinksHandler: appCode.includes("getElementById('drawerCopyLinksUrlBtn')"),
  hasCopyStreamHandler: appCode.includes("getElementById('drawerCopyStreamUrlBtn')")
});
