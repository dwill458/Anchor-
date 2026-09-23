const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ARTIFACT_DIR = 'C:\\Users\\dwill\\.gemini\\antigravity\\brain\\ce10e7b0-ac4f-4546-9e83-afde73b64f84';

function getBase64(relPath) {
  const full = path.resolve(__dirname, '..', relPath);
  if (fs.existsSync(full)) {
    return `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
  }
  return '';
}

const focusImg = getBase64('src/assets/practice/today/focus.png');
const gridFocusImg = getBase64('src/assets/practice/grid/focus.png');
const gridDeepPrimeImg = getBase64('src/assets/practice/grid/deep-prime.png');
const gridVisualizeImg = getBase64('src/assets/practice/grid/visualize.png');
const gridReleaseImg = getBase64('src/assets/practice/grid/release.png');

function sigilSvg(color = '#D94F8A') {
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="46" stroke="${color}" stroke-width="4" stroke-opacity="0.3" fill="${color}" fill-opacity="0.08"/>
    <path d="M50 20 L50 80 M20 50 L80 50 M30 30 L70 70 M70 30 L30 70" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="14" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="3"/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}`;
}

const desireSigil = sigilSvg('#D94F8A');
const careerSigil = sigilSvg('#3157D8');
const healthSigil = sigilSvg('#2FA879');

function renderHTML(state = 'before') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    body {
      background-color: #F4F1E9;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #171717;
      display: flex;
      justify-content: center;
      min-height: 100vh;
    }
    .phone {
      width: 390px;
      height: 844px;
      background-color: #F4F1E9;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    /* Status bar */
    .status-bar {
      height: 47px;
      padding: 14px 24px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
      color: #171717;
      z-index: 20;
    }
    /* Nav bar */
    .nav-bar {
      padding: 6px 20px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
    }
    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #171717;
      cursor: pointer;
    }
    /* Scroll content */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 0 20px 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* 1. Active Anchor Inline Selector */
    .anchor-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 4px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .anchor-art {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #FAF8FE;
      border: 1px solid rgba(0,0,0,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .anchor-art img {
      width: 32px;
      height: 32px;
    }
    .anchor-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .anchor-intention {
      font-size: 15px;
      font-weight: 700;
      line-height: 19px;
      color: #171717;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .anchor-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12.5px;
      color: #6C6861;
    }
    .category-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #D94F8A;
      flex-shrink: 0;
    }
    .meta-category {
      font-weight: 500;
    }
    .meta-sep {
      color: #858B93;
    }
    .meta-status {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chevron-icon {
      color: #6C6861;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-left: 4px;
    }

    /* 2. Today Card */
    .today-card {
      background: #FBF9F4;
      border-radius: 20px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      position: relative;
      flex-shrink: 0;
    }
    .hero-artwork {
      position: relative;
      width: 100%;
      height: 190px;
      background: #FBF9F4;
      overflow: hidden;
    }
    .hero-artwork img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .completed-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(244, 241, 233, 0.22);
      pointer-events: none;
    }
    .hero-badges {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
    }
    .badge-today {
      background: #4C1D95;
      color: #FFFFFF;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      padding: 4px 9px;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    .badge-completed {
      background: rgba(251, 249, 244, 0.94);
      color: #287D57;
      border: 1px solid rgba(40, 125, 87, 0.22);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      padding: 4px 9px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .badge-duration {
      background: rgba(255, 255, 255, 0.94);
      color: #374151;
      font-size: 11.5px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .today-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .mode-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.9px;
      color: #7C3AED;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .headline {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 22px;
      line-height: 27px;
      letter-spacing: -0.4px;
      color: #171717;
      font-weight: 700;
    }
    .subcopy {
      font-size: 13.5px;
      line-height: 19px;
      color: #6C6861;
    }
    .cta-btn {
      background-color: #8B5CF6;
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 700;
      padding: 10px 18px;
      border-radius: 8px;
      border: none;
      align-self: flex-start;
      cursor: pointer;
      margin-top: 4px;
    }
    .practice-again-btn {
      background-color: #FBF9F4;
      color: #171717;
      font-size: 13.5px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #D8D2C8;
      align-self: flex-start;
      cursor: pointer;
      margin-top: 4px;
    }

    /* 3. All Practices 2x2 Grid */
    .grid-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex-shrink: 0;
    }
    .grid-title {
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #6C6861;
      text-transform: uppercase;
    }
    .grid-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .grid-card {
      background: #FBF9F4;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .grid-card-art {
      width: 100%;
      height: 95px;
      background: #FAF8FE;
      overflow: hidden;
    }
    .grid-card-art img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .grid-card-content {
      padding: 10px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .grid-mode-tag {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #7C3AED;
      text-transform: uppercase;
    }
    .grid-card-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #171717;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .grid-card-duration {
      font-size: 11.5px;
      color: #6C6861;
      font-weight: 500;
    }
    .grid-card-desc {
      font-size: 11.5px;
      line-height: 15px;
      color: #6C6861;
      margin-top: 2px;
    }

    /* Bottom Sheet Modal */
    .sheet-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(23, 23, 20, 0.42);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      z-index: 100;
    }
    .bottom-sheet {
      background: #FBF9F4;
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      padding: 12px 20px 32px;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.14);
      display: flex;
      flex-direction: column;
      max-height: 80%;
    }
    .sheet-handle {
      width: 38px;
      height: 4px;
      border-radius: 99px;
      background: #D8D2C8;
      align-self: center;
      margin-bottom: 14px;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 1px solid #E5E0D7;
    }
    .sheet-title {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 19px;
      font-weight: 700;
      color: #171717;
    }
    .sheet-subtitle {
      font-size: 12.5px;
      color: #6C6861;
      margin-top: 2px;
    }
    .sheet-close {
      color: #6C6861;
      cursor: pointer;
      padding: 4px;
    }
    .sheet-list {
      display: flex;
      flex-direction: column;
      margin-top: 8px;
    }
    .sheet-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 6px;
      border-bottom: 1px solid #E5E0D7;
      cursor: pointer;
      border-radius: 8px;
    }
    .sheet-row:last-child {
      border-bottom: none;
    }
    .sheet-row.selected {
      background-color: rgba(0, 0, 0, 0.035);
    }
    .sheet-row-art {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #FAF8FE;
      border: 1px solid rgba(0,0,0,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sheet-row-art img {
      width: 32px;
      height: 32px;
    }
    .sheet-row-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .sheet-row-intention {
      font-size: 15px;
      font-weight: 600;
      color: #171717;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-row-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12.5px;
      color: #6C6861;
    }
    .check-box {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #171717;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="phone">
    <!-- Status Bar -->
    <div class="status-bar">
      <span>9:41</span>
      <div style="display:flex; gap:6px; align-items:center;">
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M1 9.5C1 8.67 1.67 8 2.5 8H3.5C4.33 8 5 8.67 5 9.5V11.5C5 12.33 4.33 13 3.5 13H2.5C1.67 13 1 12.33 1 11.5V9.5Z"/><path d="M6 6.5C6 5.67 6.67 5 7.5 5H8.5C9.33 5 10 5.67 10 6.5V11.5C10 12.33 9.33 13 8.5 13H7.5C6.67 13 6 12.33 6 11.5V6.5Z"/><path d="M11 2.5C11 1.67 11.67 1 12.5 1H13.5C14.33 1 15 1.67 15 2.5V11.5C15 12.33 14.33 13 13.5 13H12.5C11.67 13 11 12.33 11 11.5V2.5Z"/></svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="18" height="10" rx="3"/><rect x="2" y="2" width="14" height="7" fill="currentColor" rx="1.5"/><path d="M20 3.5V7.5" stroke-linecap="round"/></svg>
      </div>
    </div>

    <!-- Nav Bar -->
    <div class="nav-bar">
      <div class="back-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        <span>Practice</span>
      </div>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- 1. Active Anchor Inline Selector -->
      <div class="anchor-selector">
        <div class="anchor-art">
          <img src="${desireSigil}" alt="Sigil"/>
        </div>
        <div class="anchor-info">
          <div class="anchor-intention">Anchor has 10k users</div>
          <div class="anchor-meta">
            <span class="category-dot" style="background-color:#D94F8A;"></span>
            <span class="meta-category">Desire</span>
            <span class="meta-sep">·</span>
            <span class="meta-status">Baseline not established</span>
          </div>
        </div>
        <div class="chevron-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>

      <!-- 2. Today Card -->
      ${state === 'completed' ? `
      <!-- Completed State -->
      <div class="today-card">
        <div class="hero-artwork">
          <img src="${focusImg}" alt="Focus Hero"/>
          <div class="completed-overlay"></div>
          <div class="hero-badges">
            <div class="badge-completed">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#287D57" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>TODAY COMPLETE ✓</span>
            </div>
            <div class="badge-duration">30 sec</div>
          </div>
        </div>
        <div class="today-body">
          <div class="headline">You reinforced your Anchor today.</div>
          <div class="subcopy">Your intention is holding strong.</div>
          <button class="practice-again-btn">Practice again</button>
        </div>
      </div>
      ` : `
      <!-- Pre-practice State -->
      <div class="today-card">
        <div class="hero-artwork">
          <img src="${focusImg}" alt="Focus Hero"/>
          <div class="hero-badges">
            <div class="badge-today">TODAY</div>
            <div class="badge-duration">30 sec</div>
          </div>
        </div>
        <div class="today-body">
          <div class="mode-label">Focus</div>
          <div class="headline">Build the thread today.</div>
          <div class="subcopy">Daily reinforcement for your Anchor</div>
          <button class="cta-btn">Begin Focus</button>
        </div>
      </div>
      `}

      <!-- 3. All Practices Grid -->
      <div class="grid-section">
        <div class="grid-title">Choose another practice</div>
        <div class="grid-cards">
          <!-- Focus -->
          <div class="grid-card">
            <div class="grid-card-art"><img src="${gridFocusImg}"/></div>
            <div class="grid-card-content">
              <div class="grid-mode-tag" style="color:#7C3AED;">Focus</div>
              <div class="grid-card-title">Focus <span style="font-size:13px; color:#858B93;">→</span></div>
              <div class="grid-card-duration">10 sec · 30 sec · 60 sec</div>
              <div class="grid-card-desc">Return to your Anchor with one clear breath.</div>
            </div>
          </div>
          <!-- Deep Prime -->
          <div class="grid-card">
            <div class="grid-card-art"><img src="${gridDeepPrimeImg}"/></div>
            <div class="grid-card-content">
              <div class="grid-mode-tag" style="color:#B45309;">Deep Prime</div>
              <div class="grid-card-title">Deep Prime <span style="font-size:13px; color:#858B93;">→</span></div>
              <div class="grid-card-duration">2 min · 5 min · 10 min</div>
              <div class="grid-card-desc">Settle into a longer, guided return.</div>
            </div>
          </div>
          <!-- Visualize -->
          <div class="grid-card">
            <div class="grid-card-art"><img src="${gridVisualizeImg}"/></div>
            <div class="grid-card-content">
              <div class="grid-mode-tag" style="color:#2563EB;">Visualize</div>
              <div class="grid-card-title">Visualize <span style="font-size:13px; color:#858B93;">→</span></div>
              <div class="grid-card-duration">1 min · 3 min · 5 min</div>
              <div class="grid-card-desc">Rehearse the future held in your Vision.</div>
            </div>
          </div>
          <!-- Release -->
          <div class="grid-card">
            <div class="grid-card-art"><img src="${gridReleaseImg}"/></div>
            <div class="grid-card-content">
              <div class="grid-mode-tag" style="color:#C2410C;">Release</div>
              <div class="grid-card-title">Release <span style="font-size:13px; color:#858B93;">→</span></div>
              <div class="grid-card-duration">When ready</div>
              <div class="grid-card-desc">Close an intention when its work is complete.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${state === 'picker_open' ? `
    <!-- Anchor Picker Bottom Sheet -->
    <div class="sheet-backdrop">
      <div class="bottom-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div>
            <div class="sheet-title">Switch Anchor</div>
            <div class="sheet-subtitle">Select the Anchor to focus your practices on</div>
          </div>
          <div class="sheet-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
        <div class="sheet-list">
          <!-- Item 1: Selected -->
          <div class="sheet-row selected">
            <div class="sheet-row-art"><img src="${desireSigil}"/></div>
            <div class="sheet-row-details">
              <div class="sheet-row-intention">Anchor has 10k users</div>
              <div class="sheet-row-meta">
                <span class="category-dot" style="background-color:#D94F8A;"></span>
                <span class="meta-category">Desire</span>
                <span class="meta-sep">·</span>
                <span class="meta-status">Baseline not established</span>
              </div>
            </div>
            <div class="check-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#171717" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          <!-- Item 2 -->
          <div class="sheet-row">
            <div class="sheet-row-art"><img src="${careerSigil}"/></div>
            <div class="sheet-row-details">
              <div class="sheet-row-intention">Lead engineering team with pride</div>
              <div class="sheet-row-meta">
                <span class="category-dot" style="background-color:#3157D8;"></span>
                <span class="meta-category">Career</span>
                <span class="meta-sep">·</span>
                <span class="meta-status">Thread Strength <b style="font-weight:600; color:#3157D8;">74%</b></span>
              </div>
            </div>
            <div class="check-box"></div>
          </div>

          <!-- Item 3 -->
          <div class="sheet-row">
            <div class="sheet-row-art"><img src="${healthSigil}"/></div>
            <div class="sheet-row-details">
              <div class="sheet-row-intention">Complete marathon in sub-4hr</div>
              <div class="sheet-row-meta">
                <span class="category-dot" style="background-color:#2FA879;"></span>
                <span class="meta-category">Health</span>
                <span class="meta-sep">·</span>
                <span class="meta-status">Thread Strength <b style="font-weight:600; color:#2FA879;">42%</b></span>
              </div>
            </div>
            <div class="check-box"></div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

async function captureScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // 1. Practice before completion
  const html1 = renderHTML('before');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'before.html'), html1);
  await page.setContent(html1);
  await page.waitForTimeout(600);
  const path1 = path.join(ARTIFACT_DIR, 'practice_before_completion.png');
  await page.screenshot({ path: path1 });
  console.log('Saved screenshot 1:', path1);

  // 2. Focus Today completed
  await page.setContent(renderHTML('completed'));
  await page.waitForTimeout(600);
  const path2 = path.join(ARTIFACT_DIR, 'focus_today_completed.png');
  await page.screenshot({ path: path2 });
  console.log('Saved screenshot 2:', path2);

  // 3. Anchor picker open
  await page.setContent(renderHTML('picker_open'));
  await page.waitForTimeout(600);
  const path3 = path.join(ARTIFACT_DIR, 'anchor_picker_open.png');
  await page.screenshot({ path: path3 });
  console.log('Saved screenshot 3:', path3);

  await browser.close();
}

captureScreenshots().catch((err) => {
  console.error('Screenshot generation failed:', err);
  process.exit(1);
});
