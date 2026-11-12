const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudentSession } = require('../../apps/web/src/student-session.ts');

test('PKCE consumes its state once and keeps the access token in memory', async () => {
  const stored = new Map();
  const config = {
    issuer: new URL('http://127.0.0.1:8182/realms/almas-local'),
    clientId: 'almas-web-local',
    redirect: new URL('http://127.0.0.1:4174/auth/callback'),
  };
  const storage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  };
  let exchanges = 0;
  const fetch = async (url, init) => {
    exchanges++;
    assert.match(url.pathname, /\/protocol\/openid-connect\/token$/);
    assert.equal(init.body.get('client_secret'), null);
    assert.equal(init.body.get('code'), 'fixture-code');
    assert.ok(init.body.get('code_verifier'));
    return Response.json({ access_token: 'fixture-access-token', token_type: 'Bearer', expires_in: 300 });
  };
  const session = createStudentSession(config, storage, fetch);
  const authorization = await session.authorizationURL();
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  const callback = new URL(config.redirect);
  callback.searchParams.set('state', 'wrong');
  callback.searchParams.set('code', 'fixture-code');
  await assert.rejects(session.complete(callback));
  assert.equal(exchanges, 0);
  const next = await session.authorizationURL();
  callback.searchParams.set('state', next.searchParams.get('state'));
  await session.complete(callback);
  assert.equal(session.accessToken(), 'fixture-access-token');
  assert.equal(stored.size, 0);
  assert.throws(() => createStudentSession(config, storage, fetch).accessToken());
  await assert.rejects(session.complete(callback));
  assert.equal(exchanges, 1);
});
