import type { components } from '../../../contracts/generated/learning';
import { ApiAttempts } from './api-attempts';
import { createStudentSession } from './student-session';

type Schemas = components['schemas'];
type State = Schemas['ActiveAttempt'] | Schemas['SubmittedAttempt'];
const returnKey = 'almas:student-exam:return';

export async function mountStudentExam(issuer: URL, clientId: string, apiBase: URL): Promise<void> {
  const content = document.querySelector<HTMLElement>('#content');
  if (!content) return;
  content.closest('.layout')?.classList.add('student-exam-layout');
  document.querySelectorAll<HTMLElement>('.public-links, .public-actions, .header-tools, .layout aside, .pwa-panel, footer')
    .forEach(node => { node.hidden = true; });
  const panel = document.createElement('section');
  panel.className = 'card';
  const title = document.createElement('h2');
  title.textContent = 'اختبار الطالب';
  const controls = document.createElement('div');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  panel.append(title, controls, status);
  content.replaceChildren(panel);

  const transport = window.fetch.bind(window);
  const session = createStudentSession({
    issuer, clientId, redirect: new URL('/auth/callback', location.origin),
  }, sessionStorage, transport);
  let url = new URL(location.href);
  let timer: ReturnType<typeof setTimeout>;
  let busy = false;
  let state: State;
  let exam: Schemas['StudentExam'];
  let provider: ApiAttempts;
  const startKey = crypto.randomUUID();
  let submitKey = crypto.randomUUID();
  let saveIntent: { questionId: string; optionId: string; revision: number; key: string } | undefined;

  const action = (label: string, handler: () => Promise<void>) => {
    const button = document.createElement('button');
    button.className = 'btn';
    button.type = 'button';
    button.textContent = label;
    button.onclick = () => { void run(handler); };
    controls.append(button);
  };
  const run = async (handler: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    controls.inert = true;
    try {
      await handler();
    } catch (error) {
      if (state?.status === 'active') render(state);
      status.textContent = error instanceof Error ? error.message : 'تعذر تحديث المحاولة.';
    } finally {
      busy = false;
      controls.inert = false;
    }
  };
  const signIn = async () => {
    sessionStorage.setItem(returnKey, url.pathname + url.search);
    location.assign((await session.authorizationURL()).href);
  };
  const refresh = async () => { render(await provider.get(state.id)); };
  function render(next: State) {
    state = next;
    clearTimeout(timer);
    controls.replaceChildren();
    status.textContent = '';
    if (next.status === 'submitted') {
      const result = document.createElement('p');
      result.textContent = 'النتيجة ' + next.score + ' من ' + next.total;
      controls.append(result);
      status.textContent = next.reason === 'timeout' ? 'انتهى وقت المحاولة' : 'تم تسليم المحاولة';
      return;
    }
    for (const question of exam.questions) {
      const field = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = question.text;
      field.append(legend);
      for (const option of question.options) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = question.id;
        radio.checked = next.answers.some(answer => answer.questionId === question.id && answer.optionId === option.id);
        radio.onchange = () => { void run(async () => {
          if (!saveIntent || saveIntent.questionId !== question.id || saveIntent.optionId !== option.id ||
              saveIntent.revision !== next.revision) {
            saveIntent = { questionId: question.id, optionId: option.id, revision: next.revision, key: crypto.randomUUID() };
          }
          render(await provider.save(next.id, question.id, {
            optionId: option.id, expectedRevision: next.revision,
          }, saveIntent.key));
          saveIntent = undefined;
          submitKey = crypto.randomUUID();
          status.textContent = 'حُفظت الإجابة';
        }); };
        label.append(radio, document.createTextNode(option.text));
        field.append(label);
      }
      controls.append(field);
    }
    action('تسليم المحاولة', async () => {
      render(await provider.submit(next.id, { expectedRevision: next.revision }, submitKey));
    });
    action('تحديث المحاولة', refresh);
    const refreshWhenIdle = () => {
      if (busy) timer = setTimeout(refreshWhenIdle, 250);
      else void run(refresh);
    };
    timer = setTimeout(refreshWhenIdle, Math.max(250, next.deadline - next.serverTime));
  }

  await run(async () => {
    if (url.pathname === '/auth/callback') {
      const stored = sessionStorage.getItem(returnKey);
      sessionStorage.removeItem(returnKey);
      const target = stored && new URL(stored, location.origin);
      if (!target || target.origin !== location.origin || target.pathname !== '/student/exam') {
        throw new Error('تعذرت العودة إلى صفحة الاختبار.');
      }
      const callback = url;
      url = target;
      history.replaceState(null, '', url);
      await session.complete(callback);
    } else {
      action('دخول الطالب', signIn);
      if (url.searchParams.has('attemptId')) await signIn();
      return;
    }
    const schoolId = url.searchParams.get('schoolId') ?? '';
    const examId = url.searchParams.get('examId') ?? '';
    provider = new ApiAttempts(apiBase, schoolId, session.accessToken, transport);
    const id = url.searchParams.get('attemptId');
    if (id) {
      const saved = await provider.get(id);
      if (saved.examId !== examId) throw new Error('المحاولة لا تخص هذا الاختبار.');
      if (saved.status === 'active') {
        if (!saved.exam) throw new Error('نسخة أسئلة المحاولة غير متاحة.');
        exam = saved.exam;
      }
      if (exam) title.textContent = exam.title;
      render(saved);
      return;
    }
    exam = await provider.exam(examId);
    title.textContent = exam.title;
    action('بدء المحاولة', async () => {
      const started = await provider.start(examId, startKey);
      url.searchParams.set('attemptId', started.id);
      history.replaceState(null, '', url);
      const saved = await provider.get(started.id);
      if (saved.status === 'active') {
        if (!saved.exam) throw new Error('نسخة أسئلة المحاولة غير متاحة.');
        exam = saved.exam;
        title.textContent = exam.title;
      }
      render(saved);
    });
  });
}
