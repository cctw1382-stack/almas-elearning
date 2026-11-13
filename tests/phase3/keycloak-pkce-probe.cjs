// Run against an isolated Keycloak realm with a synthetic test user.
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

async function run() {
  const issuer = new URL(process.env.ALMAS_OIDC_TEST_ISSUER);
  assert.equal(issuer.hostname, '127.0.0.1');
  const redirect = 'http://127.0.0.1:4174/auth/callback';
  const client = 'almas-web-local';
  const secret = process.env.ALMAS_OIDC_PROBE_PASSWORD;
  assert.ok(secret);
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(24).toString('base64url');
  const authorization = new URL(issuer.href + '/protocol/openid-connect/auth');
  authorization.search = new URLSearchParams({
    client_id: client, redirect_uri: redirect, response_type: 'code', scope: 'openid',
    state, nonce: randomBytes(24).toString('base64url'),
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  });
  const login = await fetch(authorization, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 200, 'expected Keycloak login form');
  const html = await login.text();
  const form = html.match(/<form\b[^>]*\bid="kc-form-login"[^>]*>/i);
  const action = form?.[0].match(/\baction="([^"]+)"/i)?.[1];
  assert.ok(action, 'login form action missing');
  const submit = new URL(action.replaceAll('&amp;', '&'), issuer);
  assert.equal(submit.origin, issuer.origin);
  assert.ok(submit.pathname.startsWith(issuer.pathname + '/login-actions/'));
  const loggedIn = await fetch(submit, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { cookie: login.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ') },
    body: new URLSearchParams({ username: 'almas-pkce-probe', password: secret, credentialId: '' }),
  });
  assert.equal(loggedIn.status, 302, 'synthetic sign-in did not redirect');
  const callback = new URL(loggedIn.headers.get('location'));
  assert.equal(callback.origin + callback.pathname, redirect);
  assert.ok(callback.searchParams.get('state') === state, 'callback state mismatch');
  const code = callback.searchParams.get('code');
  assert.ok(code, 'authorization code missing');
  const tokenResponse = await fetch(issuer.href + '/protocol/openid-connect/token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client, redirect_uri: redirect, code, code_verifier: verifier }),
  });
  assert.equal(tokenResponse.status, 200, 'PKCE exchange failed');
  const tokens = await tokenResponse.json();
  assert.ok(typeof tokens.access_token === 'string' && typeof tokens.id_token === 'string');
  console.log('Keycloak authorization code + PKCE exchange passed.');
  const env = { ...process.env, ALMAS_OIDC_TEST_ACCESS: tokens.access_token, ALMAS_OIDC_TEST_ID: tokens.id_token };
  delete env.ALMAS_OIDC_PROBE_PASSWORD;
  const pattern = env.ALMAS_TEST_DATABASE_URL
    ? '^TestKeycloak(IssuedTokens|PostgresSession)$'
    : '^TestKeycloakIssuedTokens$';
  const result = spawnSync('go', ['test', '-run', pattern, '-count=1', '-v', './...'], {
    cwd: path.resolve(__dirname, '../../apps/api'), env, stdio: 'inherit',
  });
  if (result.status !== 0) process.exitCode = 1;
  if (result.status === 0 && env.ALMAS_TEST_DATABASE_URL && process.env.ALMAS_TEST_BROWSER === '1') {
    const browser = spawnSync('go', ['test', '-run', '^TestKeycloakBrowser$', '-count=1', '-v', './...'], {
      cwd: path.resolve(__dirname, '../../apps/api'), stdio: 'inherit',
      env: { ...process.env, ALMAS_OIDC_PROBE_PASSWORD: secret,
        ALMAS_TEST_DATABASE_URL: process.env.ALMAS_TEST_BROWSER_DATABASE_URL },
    });
    if (browser.status !== 0) process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(error.code === 'ERR_ASSERTION' ? error.message : 'PKCE probe failed before Go verification.');
  process.exitCode = 1;
});
