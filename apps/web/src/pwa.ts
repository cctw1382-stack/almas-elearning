export async function registerOfflineApp(): Promise<void> {
  const connection = document.querySelector<HTMLElement>('#pwaConnection');
  const prompt = document.querySelector<HTMLElement>('#pwaUpdate');
  const apply = document.querySelector<HTMLButtonElement>('#pwaApply');
  const later = document.querySelector<HTMLButtonElement>('#pwaLater');
  const reopen = document.querySelector<HTMLButtonElement>('#pwaReopen');
  if (!connection || !prompt || !apply || !later || !reopen) return;
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    connection.textContent = 'للتثبيت والعمل دون إنترنت، افتح النسخة عبر رابط آمن.';
    return;
  }
  let prepared = false;
  let approved = false;
  let controlled = Boolean(navigator.serviceWorker.controller);
  let registration: ServiceWorkerRegistration | undefined;
  const showConnection = () => {
    connection.textContent = !navigator.onLine
      ? (prepared ? 'أنت دون اتصال — يمكنك استخدام الواجهة والبيانات المحفوظة.' : 'أنت دون اتصال — افتح المنصة مرة وأنت متصل لتجهيزها.')
      : (prepared ? 'الواجهة جاهزة للعمل دون إنترنت. الفيديو من جهازك يحتاج اختياره مجدداً.' : 'جارٍ تجهيز الواجهة للعمل دون إنترنت…');
  };
  const showUpdate = () => { prompt.hidden = false; reopen.hidden = true; };
  later.addEventListener('click', () => {
    prompt.hidden = true;
    reopen.hidden = false;
    reopen.focus();
  });
  reopen.addEventListener('click', () => { showUpdate(); apply.focus(); });
  apply.addEventListener('click', () => {
    approved = true;
    apply.disabled = true;
    if (registration?.waiting) registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    else window.location.reload();
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (approved) { window.location.reload(); return; }
    // Another tab may approve a release. This tab keeps its unfinished work.
    if (controlled) showUpdate();
    controlled = true;
  });
  window.addEventListener('online', showConnection);
  window.addEventListener('offline', showConnection);
  showConnection();
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    if (registration.waiting) showUpdate();
    registration.addEventListener('updatefound', () => {
      const installing = registration?.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
        if (installing.state === 'redundant' && !prepared) {
          connection.textContent = 'لم يكتمل تجهيز العمل دون إنترنت. أعد فتح الصفحة وأنت متصل للمحاولة مجدداً.';
        }
      });
    });
    await navigator.serviceWorker.ready;
    prepared = true;
    showConnection();
  } catch {
    connection.textContent = 'تعذر تجهيز العمل دون إنترنت. يمكنك متابعة استخدام المنصة وأنت متصل.';
  }
}
