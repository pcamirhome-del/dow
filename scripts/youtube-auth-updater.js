#!/usr/bin/env node
/**
 * Automated YouTube Auth Credential Extractor & Vercel Env Rotator
 *
 * 1. Launches headless Chromium via Playwright, bypasses EU consent walls,
 *    extracts session cookies (including VISITOR_INFO1_LIVE) and visitorData
 *    from ytcfg / ytInitialPlayerResponse.
 * 2. Executes YouTube's BotGuard interpreter directly in the real Chromium
 *    browser context to mint a fresh WebPO PO_TOKEN bound to visitorData
 *    (with bgutils-js / @distube/ytdl-core fallback if inline ytAtN is absent).
 * 3. Updates YOUTUBE_COOKIE, YOUTUBE_PO_TOKEN, and YOUTUBE_VISITOR_DATA in
 *    Vercel via the Vercel REST API (PATCH /v9/projects/{projectId}/env/{id},
 *    with upsert creation fallback and 429 rate-limit backoff).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const YOUTUBE_HOME_URL = 'https://www.youtube.com/';
const YOUTUBE_SEED_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const WAA_REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
const VERCEL_API_BASE = 'https://api.vercel.com';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ENV_TARGETS_DEFAULT = ['production', 'preview', 'development'];
const MAX_HTTP_RETRIES = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskSecret(value) {
  if (!value || typeof value !== 'string') return '(empty)';
  if (value.length <= 12) return `[len=${value.length}]`;
  return `${value.slice(0, 6)}...${value.slice(-4)} [len=${value.length}]`;
}

function emitGitHubSecretMasks(values) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const val of values) {
      if (val && typeof val === 'string' && val.length > 0) {
        console.log(`::add-mask::${val}`);
      }
    }
  }
}

function parseTargetList(rawTargets) {
  if (!rawTargets || !rawTargets.trim()) return ENV_TARGETS_DEFAULT;
  const parsed = rawTargets
    .split(',')
    .map((item) => item.trim())
    .filter((item) => ['production', 'preview', 'development'].includes(item));
  return parsed.length > 0 ? parsed : ENV_TARGETS_DEFAULT;
}

/**
 * Extracts BotGuard PO Token directly inside the live Playwright Chromium
 * page context using Google's loaded BotGuard VM + YouTube's WAA GenerateIT API.
 */
async function mintPoTokenInBrowserContext(page, visitorData, capturedChallenge) {
  // Dynamically read Google's public WAA API key from bgutils-js constants if installed,
  // or use the captured/standard YouTube web player WAA key.
  let googApiKey = '';
  try {
    const utilsMod = await import('bgutils-js/utils');
    if (utilsMod.getHeaders) {
      const hdrs = utilsMod.getHeaders();
      googApiKey = hdrs['x-goog-api-key'] || '';
    }
  } catch {
    // Fallback below if bgutils-js is not installed locally
  }

  // Also parse HTML for ytAtN / bgChallenge in case initScript didn't capture it
  const html = await page.content();
  let challenge = capturedChallenge;
  if (!challenge) {
    const atNMatch = html.match(/window\.ytAtN\((\{.*?\})\)/s);
    if (atNMatch && atNMatch[1]) {
      try {
        const utilsMod = await import('bgutils-js/utils');
        const parsed = utilsMod.parseLooseJSON(atNMatch[1]);
        const bg = parsed && parsed.R && parsed.R.bgChallenge;
        if (bg) {
          challenge = {
            interpreterUrl:
              bg.interpreterUrl &&
              (bg.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue ||
                bg.interpreterUrl),
            program: bg.program,
            globalName: bg.globalName,
          };
        }
      } catch {
        // Fallback regex extraction if parseLooseJSON unavailable
        const interpMatch = atNMatch[1].match(
          /(https:\/\/[^"'\s\\]+\/botguard\/[^"'\s\\]+|\/s\/player\/[^"'\s\\]+|https:\/\/www\.google\.com\/js\/bg\/[^"'\s\\]+)/
        );
        const globalMatch = atNMatch[1].match(/globalName\s*:\s*['"]([^'"]+)['"]/);
        const progMatch = atNMatch[1].match(/program\s*:\s*['"]([^'"]+)['"]/);
        if (interpMatch && globalMatch && progMatch) {
          challenge = {
            interpreterUrl: interpMatch[1],
            globalName: globalMatch[1],
            program: progMatch[1],
          };
        }
      }
    }
  }

  if (!challenge || !challenge.interpreterUrl || !challenge.program || !challenge.globalName) {
    return null;
  }

  const normalizedInterpUrl = new URL(challenge.interpreterUrl, YOUTUBE_HOME_URL);
  const trustedDomain =
    normalizedInterpUrl.hostname === 'google.com' ||
    normalizedInterpUrl.hostname.endsWith('.google.com') ||
    normalizedInterpUrl.hostname === 'youtube.com' ||
    normalizedInterpUrl.hostname.endsWith('.youtube.com') ||
    normalizedInterpUrl.hostname === 'gstatic.com' ||
    normalizedInterpUrl.hostname.endsWith('.gstatic.com');

  if (normalizedInterpUrl.protocol !== 'https:' || !trustedDomain) {
    throw new Error(`Untrusted BotGuard interpreter URL rejected: ${normalizedInterpUrl.origin}`);
  }

  // Ensure the BotGuard interpreter script is loaded in Chromium if not already active
  const hasGlobal = await page.evaluate((gName) => Boolean(window[gName] && window[gName].a), challenge.globalName);
  if (!hasGlobal) {
    const interpResponse = await page.request.get(normalizedInterpUrl.href, {
      headers: { Referer: YOUTUBE_HOME_URL },
      timeout: 15000,
    });
    if (!interpResponse.ok()) {
      throw new Error(`Failed to fetch BotGuard interpreter: HTTP ${interpResponse.status()}`);
    }
    const interpScript = await interpResponse.text();
    await page.addScriptTag({ content: interpScript });
  }

  // Execute BotGuard VM inside genuine Chromium context, request GenerateIT, and mint PO Token
  const minted = await page.evaluate(
    async ({ program, globalName, contentBinding, requestKey, apiKey }) => {
      const vm = window[globalName];
      if (!vm || typeof vm.a !== 'function') {
        throw new Error(`BotGuard VM global "${globalName}" not found on window`);
      }

      const webPoSignalOutput = [];
      let asyncSnapshotFn = null;

      await new Promise((resolveSetup, rejectSetup) => {
        const timer = setTimeout(() => rejectSetup(new Error('BotGuard VM setup timed out')), 8000);
        const vmSetupCallback = (asyncSnap) => {
          asyncSnapshotFn = asyncSnap;
          clearTimeout(timer);
          resolveSetup();
        };

        try {
          const noop = () => {};
          const loggerFns = [noop, noop, noop, noop, noop];
          vm.a(
            program,
            vmSetupCallback,
            true,
            undefined,
            noop,
            [[], []],
            undefined,
            false,
            loggerFns
          );
        } catch (err) {
          clearTimeout(timer);
          rejectSetup(err);
        }
      });

      if (typeof asyncSnapshotFn !== 'function') {
        throw new Error('BotGuard asyncSnapshotFunction was not initialized');
      }

      const botguardResponse = await new Promise((resolveSnap, rejectSnap) => {
        const timer = setTimeout(() => rejectSnap(new Error('BotGuard snapshot timed out')), 8000);
        try {
          asyncSnapshotFn(
            (res) => {
              clearTimeout(timer);
              resolveSnap(res);
            },
            [undefined, undefined, webPoSignalOutput, undefined]
          );
        } catch (err) {
          clearTimeout(timer);
          rejectSnap(err);
        }
      });

      const effectiveKey =
        apiKey ||
        (window.ytcfg && typeof window.ytcfg.get === 'function'
          ? window.ytcfg.get('INNERTUBE_API_KEY')
          : '') ||
        '';

      const headers = {
        'content-type': 'application/json+protobuf',
        'x-user-agent': 'grpc-web-javascript/0.1',
      };
      if (effectiveKey) {
        headers['x-goog-api-key'] = effectiveKey;
      }

      const genRes = await fetch('https://www.youtube.com/api/jnn/v1/GenerateIT', {
        method: 'POST',
        headers,
        body: JSON.stringify([requestKey, botguardResponse]),
      });

      if (!genRes.ok) {
        throw new Error(`GenerateIT returned HTTP ${genRes.status}`);
      }

      const genJson = await genRes.json();
      const integrityToken = Array.isArray(genJson) ? genJson[0] : null;
      if (typeof integrityToken !== 'string' || !integrityToken) {
        throw new Error('GenerateIT returned no integrity token');
      }

      const getMinter = webPoSignalOutput[0];
      if (typeof getMinter !== 'function') {
        throw new Error('WebPO minter factory missing in webPoSignalOutput');
      }

      const normalizedB64 = integrityToken.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '=');
      const binary = atob(normalizedB64);
      const tokenBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        tokenBytes[i] = binary.charCodeAt(i);
      }

      const mintCallback = await getMinter(tokenBytes);
      if (typeof mintCallback !== 'function') {
        throw new Error('WebPO mintCallback did not initialize');
      }

      const bindingBytes = new TextEncoder().encode(contentBinding);
      const rawPoBytes = await mintCallback(bindingBytes);
      if (!(rawPoBytes instanceof Uint8Array) || rawPoBytes.length === 0) {
        throw new Error('WebPO minter returned invalid token bytes');
      }

      const b64 = btoa(String.fromCharCode(...rawPoBytes));
      return b64.replace(/\+/g, '-').replace(/\//g, '_');
    },
    {
      program: challenge.program,
      globalName: challenge.globalName,
      contentBinding: visitorData,
      requestKey: WAA_REQUEST_KEY,
      apiKey: googApiKey,
    }
  );

  return minted || null;
}

/**
 * Fallback PO Token generation using @distube/ytdl-core's BotGuard provider
 * bound to the freshly extracted visitorData.
 */
async function mintPoTokenWithFallbackProvider(visitorData) {
  try {
    const ytdl = await import('@distube/ytdl-core');
    if (typeof ytdl.createPoTokenProvider === 'function') {
      const provider = await ytdl.createPoTokenProvider({ timeoutMs: 15000 });
      const token = await provider({
        contentBinding: visitorData,
        client: ytdl.Client ? ytdl.Client.Mweb : undefined,
        signal: AbortSignal.timeout(12000),
      });
      if (token && token.length >= 24) {
        return token;
      }
    }
  } catch (err) {
    console.warn(`[Fallback] @distube/ytdl-core PO provider failed: ${err.message}`);
  }
  return null;
}

/**
 * Launches headless Chromium via Playwright, visits YouTube, extracts session
 * cookies, visitorData, and generates a fresh PO Token.
 */
async function extractYouTubeCredentials() {
  const { chromium } = await import('playwright');

  console.log('[1/4] Launching headless Chromium browser...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: DESKTOP_USER_AGENT,
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    // Pre-seed accept-all SOCS consent cookie so EU IP runners bypass consent.youtube.com
    await context.addCookies([
      {
        name: 'SOCS',
        value: 'CAI',
        domain: '.youtube.com',
        path: '/',
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    // Hide automation markers and intercept window.ytAtN challenge payloads
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      window.__capturedBgChallenge = null;
      const originalYtAtN = window.ytAtN;
      Object.defineProperty(window, 'ytAtN', {
        configurable: true,
        get() {
          return (payload) => {
            try {
              const bg = payload && payload.R && payload.R.bgChallenge;
              if (bg) {
                window.__capturedBgChallenge = {
                  interpreterUrl:
                    bg.interpreterUrl &&
                    (bg.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue ||
                      bg.interpreterUrl),
                  program: bg.program,
                  globalName: bg.globalName,
                };
              }
            } catch {
              // ignore hook errors
            }
            if (typeof originalYtAtN === 'function') {
              return originalYtAtN(payload);
            }
            return undefined;
          };
        },
        set() {
          // keep hook active
        },
      });
    });

    const page = await context.newPage();

    // Capture any PO tokens or GenerateIT responses observed naturally by YouTube's player
    let observedNetworkPoToken = null;
    page.on('request', (req) => {
      try {
        if (req.url().includes('/youtubei/v1/player') && req.method() === 'POST') {
          const postData = req.postData();
          if (postData && postData.includes('poToken')) {
            const parsed = JSON.parse(postData);
            const pot =
              parsed &&
              parsed.serviceIntegrityDimensions &&
              parsed.serviceIntegrityDimensions.poToken;
            if (typeof pot === 'string' && pot.length >= 24) {
              observedNetworkPoToken = pot;
            }
          }
        }
      } catch {
        // ignore parse failure
      }
    });

    console.log('[2/4] Navigating to YouTube to establish session cookies & visitorData...');
    await page.goto(YOUTUBE_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle consent interstitial if it still appears
    if (page.url().includes('consent.youtube.com')) {
      console.log('Detected YouTube consent screen; accepting...');
      const acceptBtn = page.locator(
        'button[aria-label*="Accept"], form[action*="consent"] button[type="submit"]'
      );
      if ((await acceptBtn.count()) > 0) {
        await acceptBtn.first().click();
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      }
    }

    // Visit a public watch page so ytInitialPlayerResponse + VISITOR_INFO1_LIVE + BotGuard initialize
    await page.goto(YOUTUBE_SEED_VIDEO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);

    // Extract cookies from browser context
    const cookieList = await context.cookies(['https://www.youtube.com', 'https://youtube.com']);
    if (!cookieList || cookieList.length === 0) {
      throw new Error('No YouTube cookies were captured by Chromium.');
    }

    const cookieMap = new Map();
    for (const c of cookieList) {
      cookieMap.set(c.name, c.value);
    }
    const rawCookieString = Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    if (!cookieMap.has('VISITOR_INFO1_LIVE')) {
      console.warn(
        'Warning: VISITOR_INFO1_LIVE cookie was not explicitly set; proceeding with extracted session cookies.'
      );
    }

    // Extract visitorData and captured BotGuard challenge from DOM/window globals
    const pageMeta = await page.evaluate(() => {
      let visitorData = '';
      try {
        if (window.ytcfg && typeof window.ytcfg.get === 'function') {
          visitorData = window.ytcfg.get('VISITOR_DATA') || '';
        }
      } catch {
        // ignore
      }

      if (!visitorData) {
        try {
          visitorData =
            (window.ytInitialPlayerResponse &&
              window.ytInitialPlayerResponse.responseContext &&
              window.ytInitialPlayerResponse.responseContext.visitorData) ||
            (window.ytInitialData &&
              window.ytInitialData.responseContext &&
              window.ytInitialData.responseContext.visitorData) ||
            '';
        } catch {
          // ignore
        }
      }

      if (!visitorData) {
        const html = document.documentElement ? document.documentElement.innerHTML : '';
        const match =
          html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/) ||
          html.match(/"visitorData"\s*:\s*"([^"]+)"/);
        if (match && match[1]) {
          visitorData = match[1];
        }
      }

      return {
        visitorData,
        capturedBgChallenge: window.__capturedBgChallenge || null,
      };
    });

    if (!pageMeta.visitorData) {
      throw new Error('Failed to extract visitorData from ytcfg or ytInitialPlayerResponse.');
    }

    console.log('[3/4] Generating BotGuard PO Token bound to visitorData...');
    let poToken = null;

    try {
      poToken = await mintPoTokenInBrowserContext(
        page,
        pageMeta.visitorData,
        pageMeta.capturedBgChallenge
      );
      if (poToken) {
        console.log('Minted PO Token via live Chromium BotGuard context.');
      }
    } catch (err) {
      console.warn(`Browser BotGuard hook skipped (${err.message}); trying fallback...`);
    }

    if (!poToken && observedNetworkPoToken) {
      poToken = observedNetworkPoToken;
      console.log('Captured PO Token directly from YouTube player network request.');
    }

    if (!poToken) {
      poToken = await mintPoTokenWithFallbackProvider(pageMeta.visitorData);
      if (poToken) {
        console.log('Minted PO Token via @distube/ytdl-core BotGuard provider fallback.');
      }
    }

    if (!poToken) {
      throw new Error('All PO Token generation strategies failed.');
    }

    emitGitHubSecretMasks([rawCookieString, poToken, pageMeta.visitorData]);

    return {
      cookie: rawCookieString,
      poToken,
      visitorData: pageMeta.visitorData,
      cookieNames: Array.from(cookieMap.keys()),
    };
  } finally {
    await browser.close();
  }
}

/**
 * Executes a Vercel REST API request with automatic rate-limit (HTTP 429)
 * backoff and transient 5xx retry handling.
 */
async function vercelApiFetch(endpointPath, { token, method = 'GET', body } = {}) {
  const url = `${VERCEL_API_BASE}${endpointPath}`;
  let attempt = 0;

  while (true) {
    attempt += 1;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });

    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      if (attempt >= MAX_HTTP_RETRIES) {
        const errBody = await response.text().catch(() => '');
        throw new Error(
          `Vercel API ${method} ${endpointPath} failed after ${attempt} attempts (HTTP ${response.status}): ${errBody}`
        );
      }

      const retryAfterSec = Number(response.headers.get('retry-after') || '0');
      const resetEpoch = Number(response.headers.get('x-ratelimit-reset') || '0');
      let waitMs = Math.min(30000, 1500 * 2 ** (attempt - 1));

      if (retryAfterSec > 0) {
        waitMs = Math.min(60000, retryAfterSec * 1000);
      } else if (resetEpoch > 0) {
        const delta = resetEpoch * 1000 - Date.now();
        if (delta > 0) waitMs = Math.min(60000, delta + 500);
      }

      // Add small jitter
      waitMs += Math.floor(Math.random() * 400);
      console.warn(
        `Vercel API returned HTTP ${response.status}; backing off ${waitMs}ms (attempt ${attempt}/${MAX_HTTP_RETRIES})...`
      );
      await sleep(waitMs);
      continue;
    }

    const rawText = await response.text().catch(() => '');
    let parsedJson = null;
    try {
      parsedJson = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedJson = null;
    }

    if (!response.ok) {
      const apiMsg =
        (parsedJson && parsedJson.error && parsedJson.error.message) ||
        rawText ||
        `HTTP ${response.status}`;
      throw new Error(`Vercel API ${method} ${endpointPath} failed (${response.status}): ${apiMsg}`);
    }

    return parsedJson;
  }
}

/**
 * Updates YOUTUBE_COOKIE, YOUTUBE_PO_TOKEN, and YOUTUBE_VISITOR_DATA on the
 * target Vercel project using PATCH /v9/projects/{projectId}/env/{envId}
 * (creating missing keys via POST /v10/projects/{projectId}/env?upsert=true).
 */
async function syncCredentialsToVercel(creds) {
  const token = process.env.VERCEL_TOKEN && process.env.VERCEL_TOKEN.trim();
  const projectId = process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID.trim();
  const teamId = process.env.VERCEL_TEAM_ID && process.env.VERCEL_TEAM_ID.trim();
  const targets = parseTargetList(process.env.VERCEL_ENV_TARGETS);
  const deployHookUrl =
    process.env.VERCEL_DEPLOY_HOOK_URL && process.env.VERCEL_DEPLOY_HOOK_URL.trim();

  if (!token || !projectId) {
    throw new Error(
      'Missing required environment variables: VERCEL_TOKEN and VERCEL_PROJECT_ID must be set.'
    );
  }

  const teamQuery = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const desiredVars = {
    YOUTUBE_COOKIE: creds.cookie,
    YOUTUBE_PO_TOKEN: creds.poToken,
    YOUTUBE_VISITOR_DATA: creds.visitorData,
  };

  console.log(`[4/4] Fetching existing environment variables for Vercel project ${projectId}...`);
  const listResult = await vercelApiFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/env${teamQuery}`,
    { token, method: 'GET' }
  );

  const existingEnvs = Array.isArray(listResult && listResult.envs) ? listResult.envs : [];

  for (const [key, value] of Object.entries(desiredVars)) {
    const matchingRecords = existingEnvs.filter((env) => env && env.key === key);

    if (matchingRecords.length > 0) {
      // Update each matching record via PATCH /v9/projects/{projectId}/env/{id}
      for (const record of matchingRecords) {
        const recordTarget =
          Array.isArray(record.target) && record.target.length > 0 ? record.target : targets;

        await vercelApiFetch(
          `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(record.id)}${teamQuery}`,
          {
            token,
            method: 'PATCH',
            body: {
              value,
              type: 'encrypted',
              target: recordTarget,
            },
          }
        );
        console.log(
          `Updated ${key} (${record.id}) for targets [${recordTarget.join(', ')}]: ${maskSecret(value)}`
        );
      }
    } else {
      // Create initial variable if it does not yet exist on the Vercel project
      const upsertQuery = teamId
        ? `?teamId=${encodeURIComponent(teamId)}&upsert=true`
        : '?upsert=true';
      await vercelApiFetch(
        `/v10/projects/${encodeURIComponent(projectId)}/env${upsertQuery}`,
        {
          token,
          method: 'POST',
          body: {
            key,
            value,
            type: 'encrypted',
            target: targets,
          },
        }
      );
      console.log(
        `Created ${key} for targets [${targets.join(', ')}]: ${maskSecret(value)}`
      );
    }

    // Small pause between sequential Vercel env mutations to stay well under rate limits
    await sleep(300);
  }

  // Trigger optional Deploy Hook so serverless functions immediately load the rotated secrets
  if (deployHookUrl) {
    console.log('Triggering Vercel Deploy Hook so production picks up rotated credentials...');
    const hookRes = await fetch(deployHookUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    });
    if (!hookRes.ok) {
      console.warn(`Vercel Deploy Hook returned HTTP ${hookRes.status}`);
    } else {
      console.log('Vercel production redeploy triggered successfully.');
    }
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const startedAt = Date.now();

  const creds = await extractYouTubeCredentials();
  console.log(
    `Extracted cookies (${creds.cookieNames.length} keys; VISITOR_INFO1_LIVE=${creds.cookieNames.includes('VISITOR_INFO1_LIVE')}), visitorData=${maskSecret(creds.visitorData)}, poToken=${maskSecret(creds.poToken)}`
  );

  if (isDryRun) {
    console.log('Dry-run mode enabled (--dry-run); skipping Vercel API sync.');
  } else {
    await syncCredentialsToVercel(creds);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`YouTube credential rotation completed in ${elapsedSec}s.`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      '### YouTube Auth Rotation Summary',
      `- **Status:** Success (${elapsedSec}s)`,
      `- **Cookies Extracted:** ${creds.cookieNames.length} keys (\`VISITOR_INFO1_LIVE\`: ${creds.cookieNames.includes('VISITOR_INFO1_LIVE')})`,
      `- **Visitor Data:** \`${maskSecret(creds.visitorData)}\``,
      `- **PO Token:** \`${maskSecret(creds.poToken)}\``,
      `- **Vercel Sync:** ${isDryRun ? 'Skipped (`--dry-run`)' : 'Updated via Vercel REST API'}`,
    ];
    fs.appendFileSync(
      path.resolve(process.env.GITHUB_STEP_SUMMARY),
      `${summaryLines.join('\n')}\n`
    );
  }
}

main().catch((err) => {
  console.error('YouTube auth updater failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
