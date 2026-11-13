import { assert, isObject } from './data-validation.ts';

type Config = { issuer: URL; clientId: string; redirect: URL };
type PendingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function trustedURL(url: URL): boolean {
  return (url.protocol === 'https:' ||
    (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) &&
    !url.username && !url.password && !url.search && !url.hash;
}

export function createStudentSession(config: Config, pending: PendingStorage, transport: typeof fetch) {
  const { issuer, clientId, redirect } = config;
  assert(trustedURL(issuer) && trustedURL(redirect) && clientId.length > 0, 'إعداد جلسة الطالب غير صالح.');
  const issuerURL = issuer.href.replace(/\/$/, '');
  const redirectURI = redirect.href;
  const endpoint = issuerURL + '/protocol/openid-connect/';
  const pendingKey = 'almas:pkce:' + issuerURL + ':' + clientId;
  let token: { access: string; expiresAt: number } | undefined;

  return {
    async authorizationURL(): Promise<URL> {
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      pending.setItem(pendingKey, JSON.stringify({ verifier, state, expiresAt: Date.now() + 300_000 }));
      const url = new URL(endpoint + 'auth');
      url.search = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectURI, response_type: 'code', scope: 'openid',
        state, code_challenge: challenge, code_challenge_method: 'S256',
      }).toString();
      return url;
    },

    async complete(callback: URL): Promise<void> {
      const target = new URL(callback);
      target.search = '';
      assert(target.href === redirectURI, 'عنوان عودة تسجيل الدخول غير صالح.');
      const raw = pending.getItem(pendingKey);
      pending.removeItem(pendingKey);
      assert(raw !== null, 'جلسة تسجيل الدخول غير متاحة.');
      const flow: unknown = JSON.parse(raw);
      const code = callback.searchParams.get('code');
      const responseIssuer = callback.searchParams.get('iss');
      assert(isObject(flow) && typeof flow.verifier === 'string' && typeof flow.state === 'string' &&
        typeof flow.expiresAt === 'number' && flow.expiresAt > Date.now() &&
        callback.searchParams.get('state') === flow.state && code &&
        (responseIssuer === null || responseIssuer === issuerURL) &&
        !callback.searchParams.has('error'), 'تعذر التحقق من جلسة تسجيل الدخول.');
      const response = await transport(new URL(endpoint + 'token'), {
        method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({
          client_id: clientId, redirect_uri: redirectURI, grant_type: 'authorization_code',
          code, code_verifier: flow.verifier,
        }),
      });
      assert(response.ok, 'تعذر إتمام تسجيل الدخول.');
      const payload: unknown = await response.json();
      assert(isObject(payload) && typeof payload.access_token === 'string' &&
        /^[^\s]+$/.test(payload.access_token) && typeof payload.token_type === 'string' &&
        payload.token_type.toLowerCase() === 'bearer' && typeof payload.expires_in === 'number' &&
        Number.isSafeInteger(payload.expires_in) && payload.expires_in > 0, 'استجابة الجلسة غير صالحة.');
      token = { access: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 };
    },

    accessToken(): string {
      assert(token && token.expiresAt > Date.now(), 'انتهت جلسة الطالب.');
      return token.access;
    },
  };
}
