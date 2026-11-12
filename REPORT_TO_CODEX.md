> تقرير التسليم الأصلي الذي أرفقه المستخدم. أوصاف الحالة والتقديرات والمراجع ذات المعرّفات الداخلية أدناه تخص وقت إعداد التقرير السابق، ولا تمثل نتائج التحقق الحالية. نتائج هذا التنفيذ وحدوده في [تقرير القبول](docs/PHASE1_ACCEPTANCE_REPORT.md).

# تقرير إلى Codex — منصة الماس للتعليم الإلكتروني

## الملخص التنفيذي

المشروع موجود فعلياً في مستودع GitHub باسم `cctw1382-stack/almas-elearning`، والمستودع عام حالياً. يحتوي الفرع `main` على وثائق التأسيس الأساسية، منها `README.md` و`00_PROJECT_STRUCTURE.md` و`REQUIREMENTS.md` و`SPECKIT.md`، إضافة إلى مجلدات `docs/` و`prompts/` و`prototype/`. النموذج الحالي في `main` هو ملف واحد `prototype/index.html` يجمع HTML وCSS وJavaScript ويقدم تجربة عربية RTL للأدوار الأربعة باستخدام بيانات Mock، من دون خادم أو قاعدة بيانات إنتاجية. citeturn837813view0turn546958view5

توجد حالياً **مسودة Pull Request رقم #1** بعنوان `WIP: Phase 1 Arabic RTL frontend — role UX and technical review`، من الفرع `feat/phase1-complete-ux` إلى `main`. الـPR ما يزال Draft، ويحتوي ستة commits، ويغير ملفين أساسيين هما `prototype/index.html` و`docs/PHASE1_REVIEW.md`. كما تنص ملاحظات الـPR صراحة على أن المرحلة الأولى **غير مكتملة ولا ينبغي دمجها أو الانتقال إلى المرحلة التالية** قبل إغلاق الاختبارات والوظائف الناقصة. citeturn476630view11turn373929view0

النسخة الموجودة في فرع العمل أكثر تقدماً من `main`: أضيفت واجهات وتجارب أوسع للأدوار الأربعة، تسجيل دخول وإنشاء حساب تجريبيان، فيديو HTML5 محلي، حفظ ملاحظات وعلامة مرجعية وتقدم في `localStorage`، مؤقت اختبار، تحسينات وصول واستجابة، واعتماد التصميم المختلط الذي اخترته: تجربة تعليمية بصرية للطالب وولي الأمر، وواجهة رسمية أكثر كثافة للمعلم والإدارة. citeturn129882view0turn129882view1

أنشأت نسخة Markdown كاملة قابلة للحفظ مباشرة في المستودع باسم `REPORT_TO_CODEX.md`:

[تحميل REPORT_TO_CODEX.md](sandbox:/mnt/data/REPORT_TO_CODEX.md)

## فحص المستودع والحالة الحالية

| الملف أو المجلد | الوظيفة | الحالة |
|---|---|---|
| `README.md` | تعريف المشروع وطريقة تشغيل النموذج والتقنيات المستقبلية | مكتمل كأساس |
| `00_PROJECT_STRUCTURE.md` | خريطة مختصرة لهيكل المشروع | مكتمل كأساس |
| `REQUIREMENTS.md` | متطلبات المنصة والأدوار والأجهزة المستهدفة | مكتمل كأساس |
| `SPECKIT.md` | قواعد المسموح والممنوع أثناء التطوير | مكتمل كأساس |
| `prototype/index.html` على `main` | النموذج الأولي الأساسي | قيد العمل |
| `prototype/index.html` على فرع PR | أحدث نسخة من المرحلة الأولى | قيد العمل |
| `prompts/MASTER_IMPLEMENTATION_PROMPT.md` | تعليمات وكيل البرمجة | مكتمل كأساس |
| `docs/ARCHITECTURE.md` | اتجاه المعمارية المستقبلية | مكتمل كأساس |
| `docs/DATA_MODEL.md` | كيانات قاعدة البيانات المقترحة | قيد التطوير |
| `docs/SECURITY.md` | قواعد الأمان والخصوصية | مكتمل كأساس |
| `docs/BACKUP_RESTORE.md` | النسخ الاحتياطي والاستعادة | مكتمل كأساس |
| `docs/ROADMAP.md` | مراحل تطوير المشروع | مكتمل كأساس |
| `docs/ACCEPTANCE_TESTS.md` | شروط قبول المرحلة الأولى | قيد العمل |
| `docs/GITHUB_RESEARCH.md` | مستودعات LMS مرجعية | قيد التطوير |
| `docs/PHASE1_REVIEW.md` | مراجعة Senior لحالة المرحلة الأولى | قيد العمل، موجود على فرع PR |
| `REPORT_TO_CODEX.md` | التقرير الحالي | جاهز للإضافة |
| `.github/workflows/ci.yml` | CI آلي | مفقود |
| اختبارات Playwright | اختبار المتصفحات والأجهزة | مفقود |
| `docs/PHASE1_ACCEPTANCE_REPORT.md` | شهادة إغلاق المرحلة الأولى | مفقود |

المتطلبات الحالية تنص على أن الإصدار الأول يعمل من المتصفح على Android وWindows والشاشات الذكية التي تدعم متصفحاً حديثاً، وأنه يبقى ملف HTML واحداً بلا Backend أو بيانات حقيقية. citeturn669750view0 قواعد `SPECKIT.md` تسمح في هذه المرحلة فقط بـHTML/CSS/JS وMock Data مع فصل العرض عن مصدر البيانات، وتشدد على تغييرات Git صغيرة وترحيلات قاعدة بيانات مدروسة مستقبلاً. citeturn669750view1

وثيقة خارطة الطريق نفسها تفرض عدم الانتقال بين المراحل قبل تحقيق اختبارات القبول. المرحلة الحالية هي HTML أحادي الملف، ثم لاحقاً TypeScript/Vite/PWA، ثم API وقاعدة PostgreSQL، ثم الفيديو والتقارير، ثم AI والدفع واختبار 1,000 مستخدم، وأخيراً التوسع إلى 10,000 مستخدم. citeturn669750view7

روابط المشروع المهمة:

[المستودع الرئيسي](https://github.com/cctw1382-stack/almas-elearning)

[Pull Request رقم 1](https://github.com/cctw1382-stack/almas-elearning/pull/1)

[ملفات التغييرات في PR](https://github.com/cctw1382-stack/almas-elearning/pull/1/files)

[prototype/index.html على main](https://github.com/cctw1382-stack/almas-elearning/blob/main/prototype/index.html)

[prototype/index.html على فرع المرحلة الأولى](https://github.com/cctw1382-stack/almas-elearning/blob/feat/phase1-complete-ux/prototype/index.html)

[README.md](https://github.com/cctw1382-stack/almas-elearning/blob/main/README.md)

[00_PROJECT_STRUCTURE.md](https://github.com/cctw1382-stack/almas-elearning/blob/main/00_PROJECT_STRUCTURE.md)

[REQUIREMENTS.md](https://github.com/cctw1382-stack/almas-elearning/blob/main/REQUIREMENTS.md)

[SPECKIT.md](https://github.com/cctw1382-stack/almas-elearning/blob/main/SPECKIT.md)

[MASTER_IMPLEMENTATION_PROMPT.md](https://github.com/cctw1382-stack/almas-elearning/blob/main/prompts/MASTER_IMPLEMENTATION_PROMPT.md)

## التحليل التقني للواجهة الحالية

الملف `prototype/index.html` في فرع العمل أصبح نحو 33.6 KB ويحتوي قرابة 188 سطراً من الكود الفعلي، مقابل نحو 18.1 KB للنسخة الحالية في `main`. بنيته تبدأ بـ`<html lang="ar" dir="rtl">`، ثم Header يحتوي اسم المنصة ومبدل الدور والمظهر، وقائمة جانبية ديناميكية، ومنطقة محتوى يعاد توليدها حسب الدور والصفحة. citeturn129882view0turn669750view10

CSS يستخدم Variables مركزية للألوان والخلفيات والنصوص، ويدعم Dark Mode وMedia Queries للشاشات الصغيرة. الفرع الحالي أضاف نمطين مختلفين عبر `data-experience`: نمط `learning` للطالب وولي الأمر، ونمط `formal` للمعلم والإدارة، وهو تطبيق مباشر للتصميم المختلط المعتمد. citeturn373929view0

JavaScript مبني على `state` مركزي و`render()` ديناميكي، مع قوائم تنقل منفصلة للطالب والمعلم وولي الأمر والإدارة. بيانات النموذج مخزنة داخل `MOCK`، ويوجد `DataProvider` أولي لقراءة المواد والدروس والطلاب والأبناء والإشعارات والرسائل. لكن مراجعة المرحلة الأولى تذكر أن بعض الشاشات ما تزال تقرأ Mock Data مباشرة، ولذلك فصل البيانات لم يكتمل. citeturn129882view0turn129882view1

النسخة الجديدة أضافت مشغل HTML5 لاختيار فيديو محلي، وتخزين الملاحظات والعلامة المرجعية وتقدم المشاهدة في `localStorage`، وcheckpoint عند منتصف الفيديو تقريباً، إضافة إلى مؤقت اختبار لخمس دقائق. المراجعة الحالية تحذر من أن CRUD ما يزال في مواضع كثيرة مجرد رسائل محاكاة، وأن المؤقت قد يعاد ضبطه عند Refresh، وأن تفاعل الفيديو/checkpoint يحتاج اختباراً حقيقياً في المتصفح. citeturn373929view0turn129882view1

القرار الهندسي الصحيح هو جعل جميع الشاشات تعتمد على Repository موحد بدلاً من `MOCK` مباشرة:

```js
class MockRepository {
  async listSubjects() {
    return structuredClone(MOCK.subjects);
  }

  async saveProgress({ lessonId, percent }) {
    localStorage.setItem(`progress:${lessonId}`, String(percent));
    return { lessonId, percent };
  }
}

const repo = new MockRepository();
```

لاحقاً يمكن استبدال `MockRepository` بـ`SQLiteRepository` أو `ApiRepository` دون إعادة كتابة الشاشات.

SQLite يوفر رسمياً JavaScript/WebAssembly APIs للعمل داخل المتصفحات الحديثة، ولذلك يمكن استخدامه كقاعدة محلية أو Offline Store، لكنه ليس الخيار المناسب كقاعدة مركزية مباشرة لمنصة بها آلاف المستخدمين المتزامنين. citeturn828614search2turn828614search15

مثال مختصر لـSQLite WebAssembly:

```js
import sqlite3InitModule from './sqlite3.mjs';

const sqlite3 = await sqlite3InitModule();
const db = new sqlite3.oo1.DB('/almas.sqlite3', 'ct');

db.exec(`CREATE TABLE IF NOT EXISTS progress(
  lesson_id INTEGER PRIMARY KEY,
  percent INTEGER NOT NULL
)`);

function saveProgress(id, percent) {
  db.exec({
    sql: `INSERT INTO progress VALUES (?, ?)
          ON CONFLICT(lesson_id)
          DO UPDATE SET percent=excluded.percent`,
    bind: [id, percent]
  });
}
```

أما عند الحاجة إلى API محلي بسيط، فـNode.js يوفر حالياً `node:sqlite` ضمن التوزيعة الرسمية. citeturn828614search13turn828614search16

```js
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('almas.db');
db.exec(`CREATE TABLE IF NOT EXISTS subjects(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL
)`);

http.createServer((req, res) => {
  if (req.url === '/api/subjects') {
    const rows = db.prepare('SELECT * FROM subjects').all();
    res.writeHead(200, {'content-type':'application/json'});
    return res.end(JSON.stringify(rows));
  }
  res.writeHead(404).end();
}).listen(3000);
```

Endpoints محلية مقترحة: `GET /api/subjects`، `GET /api/lessons`، `PUT /api/progress/:lessonId`، `POST /api/bookmarks`، `POST /api/exams/:id/attempts`، و`POST /api/exam-attempts/:id/submit`.

## Backlog وتعليمات التنفيذ إلى Codex

| المهمة | الأولوية | التقدير |
|---|---|---:|
| إكمال Repository/DataProvider الموحد | عالية | 4–6 ساعات |
| إكمال CRUD التجريبي للمعلم والإدارة | عالية | 8–12 ساعة |
| إنهاء دورة الاختبار كاملة | عالية | 5–7 ساعات |
| تثبيت الفيديو والـcheckpoints | عالية | 5–8 ساعات |
| حالات Loading/Empty/Error/Success | عالية | 3–5 ساعات |
| Accessibility شاملة | عالية | 4–6 ساعات |
| Playwright للمتصفحات | عالية | 6–10 ساعات |
| فحص Console/runtime | عالية | 2–3 ساعات |
| GitHub Actions CI | عالية | 3–5 ساعات |
| تقرير قبول نهائي | عالية | 2–3 ساعات |
| البحث والفلاتر | متوسطة | 3–4 ساعات |
| حفظ Theme/Role بشكل غير حساس | متوسطة | 2–3 ساعات |
| تحديث README | متوسطة | 1–2 ساعة |
| Polish بصري أخير | منخفضة | 3–5 ساعات |

الإجمالي التقريبي لإغلاق المرحلة الأولى هو **48–79 ساعة عمل هندسي واختبار**؛ الرقم تقدير نطاق عمل وليس وعداً بمدة تنفيذ.

على Codex الالتزام بالفرع الحالي وعدم بدء المرحلة الثانية. أوامر Git المقترحة:

```bash
git fetch origin
git switch feat/phase1-complete-ux
git pull --ff-only origin feat/phase1-complete-ux

git switch -c fix/phase1-acceptance
git add prototype docs tests .github
git commit -m "fix: complete phase-one acceptance flows"
git push -u origin fix/phase1-acceptance
```

يفضل دمج فرع الإصلاح الصغير داخل `feat/phase1-complete-ux` أولاً، ثم تحديث PR #1. بعد نجاح كل الاختبارات فقط:

```bash
git switch feat/phase1-complete-ux
git pull --ff-only origin feat/phase1-complete-ux
git tag phase1-rc1
git push origin phase1-rc1
```

الملفات التي يجب أن ينشئها Codex أو يعدلها الآن هي: `prototype/index.html`، `docs/PHASE1_REVIEW.md`، `docs/ACCEPTANCE_TESTS.md`، `README.md`، وإنشاء `REPORT_TO_CODEX.md` و`docs/PHASE1_ACCEPTANCE_REPORT.md` و`.github/workflows/ci.yml` واختبارات Playwright.

## المعمارية المستقبلية والاختبار والنشر

المعمارية المكتوبة حالياً تقترح Browser/PWA أمام HTTPS Reverse Proxy ثم Go modular monolith API ثم PostgreSQL، مع Object Storage للفيديو، وRedis فقط إذا أثبتت القياسات الحاجة، وتجنب Microservices وKubernetes في البداية. هذا اتجاه مناسب لمشروع يبدأ عند 1,000 مستخدم ويراد نقله لاحقاً إلى 10,000 مع المحافظة على بساطة النشر والاستعادة. citeturn669750view3

التوصية التقنية بعد إغلاق المرحلة الأولى:

| الطبقة | الاختيار المقترح |
|---|---|
| Frontend | TypeScript + Vite + PWA |
| واجهة المرحلة الحالية | Vanilla HTML/CSS/JS |
| Unit testing | Vitest |
| Browser testing | Playwright |
| Backend | Go modular monolith أو NestJS |
| Local DB | SQLite |
| Production DB | PostgreSQL |
| Cache لاحقاً | Redis |
| Video/files | S3-compatible Object Storage |
| Reverse Proxy | Nginx |
| Deployment | Docker Compose على Ubuntu VPS |

Go خيار قوي إذا كانت الأولوية تقليل استهلاك الخادم وبناء API بسيط وسهل النشر، بينما NestJS قد يسرع التطوير إذا تم توحيد المشروع حول TypeScript. القرار النهائي يجب أن يتبع Load Testing وليس فكرة وجود «أسرع لغة» بشكل مطلق.

خطة القبول يجب أن تشمل Unit وIntegration وPlaywright وManual QA. وثيقة القبول الموجودة تشترط بالفعل عمل الأدوار الأربعة، البحث، الاختبارات، الفيديو، الإشعارات، Dark Mode، RTL، حالات الفراغ والأخطاء، keyboard access، واختبار مقاسات 360 و768 و1366 بكسل دون أخطاء JavaScript. citeturn669750view8

سيناريوهات الاختبار الأساسية هي تشغيل كل دور، فتح كل صفحة، البحث، تشغيل الفيديو، حفظ التقدم والملاحظات، اختبار checkpoint، بدء الامتحان وتسليمه، CRUD للمعلم والإدارة، متابعة الأبناء، Dark Mode، keyboard navigation، Refresh، وعدم تخزين كلمات مرور أو أسرار.

بالنسبة للنشر، Docker يوفر تعليمات رسمية مباشرة لتثبيت Docker Engine على Ubuntu، وNginx يوفر reverse proxy وload balancing ويمكن استخدامه أمام الواجهة والـAPI. citeturn828614search14turn828614search48turn828614search55

النشر الأولي يكون: Ubuntu LTS → Docker/Compose → Nginx → Web/API → PostgreSQL، مع Object Storage منفصل للفيديو، TLS، Health Checks، Monitoring، ونسخ احتياطي خارج الخادم.

خطة النسخ الاحتياطي الموجودة في المشروع تقترح `pg_dump -Fc` بالإضافة إلى WAL archiving/PITR، وتشفير النسخ، وتخزينها خارج الخادم، واختبار الاستعادة شهرياً على Staging. citeturn669750view6

## الأمان والمشاريع المرجعية وملاحظات المطور

وثيقة الأمان الحالية تسير في الاتجاه الصحيح: مصادقة إنتاجية بواسطة Session أو OIDC، Argon2id لكلمات المرور، Cookies من نوع `HttpOnly/Secure/SameSite`، RBAC وفحص ملكية الموارد في كل API، الحماية من CSRF/XSS/SQL Injection، Rate Limiting، Audit Logs، وعدم وضع مفاتيح AI أو الدفع أو الأسرار في GitHub أو الواجهة. citeturn669750view5

يجب إضافة CSP قوية عند الانتقال إلى خادم حقيقي؛ MDN يوضح أن Content Security Policy تسمح بتحديد الموارد التي يمكن للمتصفح تحميلها وتساعد في تقليل مخاطر مثل XSS وحقن البيانات. citeturn828614search5turn828614search11

حماية الفيديو لا تعني DRM مطلقاً. المطلوب إنتاجياً هو Authorization، روابط Signed قصيرة العمر، Object Storage، HLS/DASH عند الحاجة، وCDN لاحقاً؛ ويجب تجنب الادعاء بأن أي نظام ويب يمنع النسخ بصورة مطلقة.

المشاريع المرجعية المهمة:

| المشروع | الملاحظة |
|---|---|
| Moodle | LMS متكامل ومفتوح المصدر، مفيد جداً كمرجع للميزات والأدوار؛ مبني أساساً بـPHP ويعمل تحت GPLv3. citeturn551718search0 |
| Moodle App | تطبيق Moodle الرسمي، ويستخدم Angular/Ionic/Cordova ويحتوي SQLite وVideo.js وأدوات Offline؛ مفيد جداً لدراسة تجربة Android، لكنه ثقيل كأساس مباشر لمنصة الماس. citeturn883784search7 |
| Kolibri | منصة تعليم Offline-first مفتوحة المصدر، وهي من أفضل المراجع للعمل في بيئات اتصال ضعيفة والمزامنة المحلية. citeturn551718search2turn551718search3 |
| Canvas LMS | LMS مفتوح المصدر تحت AGPLv3؛ لدى Instructure أيضاً تطبيق Android رسمي، لكنه نظام كبير وليس نقطة بداية خفيفة. citeturn551718search4turn551718search5 |
| Open edX | منصة LMS وتأليف مقررات واسعة، تعتمد Django وReact/MFEs، ووثائقها نفسها توضح أن تشغيلها الكامل منظومة معقدة متعددة الخدمات. citeturn883784search0turn828614search0 |

### ملاحظات للمطور Dev Notes

القرار الأهم هو عدم تحويل المشروع إلى Framework الآن؛ يجب إغلاق المرحلة الأولى بالشروط الحالية أولاً. بعد ذلك يكون الانتقال إلى TypeScript/Vite مشروعاً منفصلاً ومقيساً.

`DataProvider/Repository` هو أهم حاجز تقني في الوقت الحالي. إذا بقيت الشاشات مرتبطة بـMock Data مباشرة، فسوف تصبح إضافة SQLite أو API لاحقاً عملية إعادة كتابة وليست مجرد استبدال Adapter.

SQLite يجب استخدامه للتطوير المحلي، Offline Cache، أو سيناريو جهاز واحد. قاعدة الإنتاج المركزية المستهدفة يجب أن تكون PostgreSQL.

لتحقيق Vibe Coding آمن، يجب أن تكون كل Migration مرقمة وقابلة للرجوع، وكل تعديل schema مرتبطاً باختبار، وكل PR صغيراً، ولا يسمح للوكيل بتنفيذ أوامر حذف أو migrations destructive دون Backup واضح.

الفيديو سيكون غالباً أكبر عنصر في تكلفة البنية التحتية، ولذلك لا ينبغي تمرير تدفق الفيديو عبر الـAPI الرئيسي؛ الملفات يجب أن تكون في Object Storage/CDN.

## خطة التنفيذ خلال سبعة أيام

| اليوم | الهدف |
|---|---|
| الأول | تثبيت الفرع، جرد الصفحات، إضافة التقرير وتحويل مراجعة المرحلة الأولى إلى Checklist |
| الثاني | توحيد Repository وإغلاق الوصول المباشر إلى Mock وإكمال CRUD المحلي |
| الثالث | إنهاء تجربة الطالب: الفيديو، checkpoint، notes، bookmarks، الامتحان والنتيجة |
| الرابع | إنهاء واجهات المعلم وولي الأمر |
| الخامس | إنهاء CRUD الإدارة والسجلات والصلاحيات والاشتراكات |
| السادس | Playwright، Accessibility، المقاسات الثلاثة، Console Errors، CI |
| السابع | إنشاء `PHASE1_ACCEPTANCE_REPORT.md`، مراجعة Senior، وتحويل PR إلى Ready فقط إذا كل الاختبارات Passed |

الخطوة التنفيذية الأولى لـCodex هي **إضافة `REPORT_TO_CODEX.md` إلى جذر المستودع، ثم إنشاء فرع إصلاح مشتق من `feat/phase1-complete-ux` وإغلاق DataProvider وCRUD والاختبارات الآلية قبل أي تحسينات شكلية إضافية**. لا يبدأ Backend الإنتاجي، ولا TypeScript migration، ولا المرحلة الثانية طالما PR #1 ما يزال Draft أو يوجد أي Blocker مفتوح.

[تحميل ملف التقرير الكامل الجاهز للإضافة إلى GitHub باسم REPORT_TO_CODEX.md](sandbox:/mnt/data/REPORT_TO_CODEX.md)
