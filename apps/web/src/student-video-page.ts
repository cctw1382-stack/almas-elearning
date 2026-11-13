import { createStudentSession } from './student-session';

const returnKey = 'almas:student-video:return';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export async function mountStudentVideo(issuer: URL, clientId: string, apiBase: URL): Promise<void> {
  const content = document.querySelector('#content');
  if (!content) return;
  content.closest('.layout')?.classList.add('student-exam-layout');
  document.querySelectorAll<HTMLElement>('.public-links, .public-actions, .header-tools, .layout aside, .pwa-panel, footer')
    .forEach(node => { node.hidden = true; });
  const panel = document.createElement('section');
  panel.className = 'card';
  const title = document.createElement('h2');
  title.textContent = 'فيديو الدرس';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  panel.append(title, status);
  content.replaceChildren(panel);
  const transport = window.fetch.bind(window);
  const session = createStudentSession({ issuer, clientId, redirect: new URL('/auth/callback', location.origin) }, sessionStorage, transport);
  let url = new URL(location.href);
  const showError = () => { status.textContent = 'تعذر تحميل الفيديو أو حفظ موضع المشاهدة.'; };
  const signIn = async () => {
    sessionStorage.removeItem('almas:student-exam:return');
    sessionStorage.setItem(returnKey, url.pathname + url.search);
    location.assign((await session.authorizationURL()).href);
  };
  try {
    if (url.pathname !== '/auth/callback') {
      const login = document.createElement('button');
      login.type = 'button';
      login.className = 'btn';
      login.textContent = 'دخول الطالب';
      login.onclick = () => { void signIn().catch(showError); };
      panel.append(login);
      if (url.searchParams.get('resume') === '1') await signIn();
      return;
    }
    const savedReturn = sessionStorage.getItem(returnKey);
    sessionStorage.removeItem(returnKey);
    const target = savedReturn && new URL(savedReturn, location.origin);
    if (!target || target.origin !== location.origin || target.pathname !== '/student/video') throw new Error();
    const callback = url;
    url = target;
    url.searchParams.set('resume', '1');
    history.replaceState(null, '', url);
    await session.complete(callback);

    const school = url.searchParams.get('schoolId') ?? '';
    const asset = url.searchParams.get('assetId') ?? '';
    if (!uuid.test(school) || !uuid.test(asset)) throw new Error();
    const scope = new URL('schools/' + school + '/media/' + asset + '/', apiBase.href.replace(/\/?$/, '/'));
    const request = async (target: URL, method = 'GET', positionMs?: number) => {
      const response = await transport(target, {
        method, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Bearer ' + session.accessToken(), ...(positionMs === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: positionMs === undefined ? undefined : JSON.stringify({ positionMs }),
      });
      if (!response.ok) throw new Error();
      return response;
    };
    const progressURL = new URL('progress', scope);
    const [saved, link] = await Promise.all([
      request(progressURL).then(response => response.json()),
      request(new URL('link', scope), 'POST').then(response => response.json()),
    ]);
    if (!Number.isSafeInteger(saved.positionMs) || saved.positionMs < 0 || typeof link.url !== 'string') throw new Error();
    const playback = new URL(link.url, scope);
    const expected = new URL('play', scope);
    if (playback.origin !== expected.origin || playback.pathname !== expected.pathname) throw new Error();
    const response = await request(playback);
    const kind = response.headers.get('Content-Type') ?? '';
    const video = document.createElement('video');
    video.controls = true;
    video.preload = 'metadata';
    video.style.maxWidth = '100%';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn';
    save.textContent = 'حفظ موضع المشاهدة';
    save.disabled = true;
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.min(video.duration, saved.positionMs / 1000);
      save.disabled = false;
    }, { once: true });
    save.onclick = async () => {
      save.disabled = true;
      try {
        await request(progressURL, 'PUT', Math.round(video.currentTime * 1000));
        status.textContent = 'حُفظ موضع المشاهدة';
      } catch {
        showError();
      } finally {
        save.disabled = false;
      }
    };
    panel.append(video, save);
    if (/^application\/vnd\.apple\.mpegurl(?:;|$)/i.test(kind)) {
      await response.body?.cancel();
      const { default: Hls } = await import('hls.js');
      if (!Hls.isSupported()) throw new Error();
      const hls = new Hls({
        progressive: true,
        fetchSetup: (context, init) => {
          const target = new URL(context.url);
          if (target.origin !== expected.origin || target.pathname !== expected.pathname) throw new Error('Invalid media URL');
          const headers = new Headers(init.headers);
          headers.set('Authorization', 'Bearer ' + session.accessToken());
          return new Request(target, { ...init, headers, cache: 'no-store', credentials: 'omit', redirect: 'error' });
        },
      });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) showError(); });
      window.addEventListener('pagehide', () => hls.destroy(), { once: true });
      hls.loadSource(playback.href);
      hls.attachMedia(video);
    } else {
      if (!/^video\/(mp4|webm)(?:;|$)/i.test(kind)) throw new Error();
      const objectURL = URL.createObjectURL(await response.blob());
      window.addEventListener('pagehide', () => URL.revokeObjectURL(objectURL), { once: true });
      video.src = objectURL;
    }
  } catch {
    showError();
  }
}
