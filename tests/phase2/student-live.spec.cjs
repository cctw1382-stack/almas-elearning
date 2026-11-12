const { test, expect } = require('@playwright/test');
const id = n => '00000000-0000-4000-8000-0000000000' + n;
const [school, exam, attempt, question, option] = ['11', '21', '31', '41', '51'].map(id);

for (const reason of ['manual', 'timeout']) {
test('connected student resumes answers after refresh and sees the ' + reason + ' result', async ({ page }) => {
  let revision = 0;
  let answers = [];
  let expired = false;
  let submitted = false;
  let reads = 0;
  const states = new Map();
  await page.route('**/fixture/realm/protocol/openid-connect/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth')) {
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      const callback = new URL(url.searchParams.get('redirect_uri'));
      const code = 'fixture-' + states.size;
      states.set(code, url.searchParams.get('code_challenge'));
      callback.searchParams.set('state', url.searchParams.get('state'));
      callback.searchParams.set('code', code);
      return route.fulfill({ status: 302, headers: { location: callback.href } });
    }
    const body = new URLSearchParams(route.request().postData());
    const challenge = require('node:crypto').createHash('sha256').update(body.get('code_verifier')).digest('base64url');
    expect(challenge).toBe(states.get(body.get('code')));
    return route.fulfill({ json: { access_token: 'fixture-access', token_type: 'Bearer', expires_in: 300 } });
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer fixture-access');
    const path = new URL(request.url()).pathname;
    expect(path).toContain('/schools/' + school + '/');
    if (path.endsWith('/exams/' + exam)) return route.fulfill({ json: {
      id: exam, title: 'اختبار متصل', durationSeconds: 60,
      questions: [{ id: question, text: 'اختر الإجابة', options: [{ id: option, text: 'الخيار الأول' }] }],
    } });
    if (request.method() === 'PUT') {
      expect(request.postDataJSON()).toEqual({ optionId: option, expectedRevision: revision });
      revision++;
      answers = [{ questionId: question, optionId: option }];
    }
    if (request.method() === 'GET') reads++;
    if (path.endsWith('/submit')) {
      expect(request.postDataJSON()).toEqual({ expectedRevision: revision });
      expect(request.headers()['idempotency-key']).toBeTruthy();
      submitted = true;
    }
    const base = { id: attempt, examId: exam, revision, answers, deadline: 2000, serverTime: expired ? 2000 : 1000 };
    return route.fulfill({ json: expired || submitted
      ? { ...base, status: 'submitted', reason, submittedAt: 2000, score: 1, total: 1 }
      : { ...base, status: 'active', exam: {
        id: exam, title: 'اختبار متصل', durationSeconds: 60,
        questions: [{ id: question, text: 'السؤال المحفوظ', options: [{ id: option, text: 'الخيار الأول' }] }],
      } } });
  });
  await page.goto('/student/exam?schoolId=' + school + '&examId=' + exam);
  await page.getByRole('button', { name: 'دخول الطالب' }).click({ timeout: 4000 });
  await page.getByRole('button', { name: 'بدء المحاولة' }).click();
  await expect(page.getByText('السؤال المحفوظ')).toBeVisible();
  await page.getByRole('radio', { name: 'الخيار الأول' }).check();
  await expect(page.getByRole('status')).toHaveText('حُفظت الإجابة');
  await page.reload();
  await expect(page.getByText('السؤال المحفوظ')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'الخيار الأول' })).toBeChecked();
  expect(reads).toBeGreaterThan(0);
  if (reason === 'manual') await page.getByRole('button', { name: 'تسليم المحاولة' }).click();
  else expired = true;
  await expect(page.getByText('النتيجة 1 من 1')).toBeVisible();
  await expect(page.getByText(reason === 'timeout' ? 'انتهى وقت المحاولة' : 'تم تسليم المحاولة')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain('fixture-access');
});
}
