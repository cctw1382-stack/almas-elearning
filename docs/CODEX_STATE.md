# CODEX STATE — 2026-11-12

## طلبات المراجعة وتشغيل GitHub Actions

تستهدف الطلبات الأربعة `feat/phase1-complete-ux`. استُخدم موصل GitHub لأن `gh` غير متاح في الطرفية.

| المرحلة | SHA المدفوع | PR | حالة CI بعد فتح الطلب |
| --- | --- | --- | --- |
| G0 | `a216f6a26e370c20d5ed08a636a3604c672d7b14` | [#4](https://github.com/cctw1382-stack/almas-elearning/pull/4) | [43299351418](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299351418) قيد التشغيل، [43299351414](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299351414) قيد التشغيل |
| P1 | `c607e997c16484bcf6f49eb9e3df6161741d7a78` | [#5](https://github.com/cctw1382-stack/almas-elearning/pull/5) | [43299363094](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299363094) قيد التشغيل، [43299363029](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299363029) قيد التشغيل |
| P2 | `2d2b33f90a8abde53ceb3a089cc66101c4509620` | [#6](https://github.com/cctw1382-stack/almas-elearning/pull/6) | [43299376500](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299376500) قيد التشغيل، [43299376501](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299376501) قيد التشغيل |
| P3 | `0b035453abda4e85da0615b5a3f62fd828b51aca` | [#7](https://github.com/cctw1382-stack/almas-elearning/pull/7) | [43299389193](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299389193) قيد التشغيل، [43299389122](https://github.com/cctw1382-stack/almas-elearning/actions/runs/43299389122) في الطابور |

رأس PR #7 يحمل أدلة العمل. مجلد `apps/api` ما زال محلياً خارج الملفات المتتبعة، لذلك لا يُستدل من تشغيلات هذا الرأس على اختبار Go أو PostgreSQL.

فرع التقرير المحلي `feat/g0-state`. بدأ التدقيق على `feat/phase2-pwa-foundation` عند `b8ad5d340bd1271873c1bd9c0bf3e07fecf563fb` مع تغييرات محلية تخص P2 وP3.
إعادة رفع فرع G0 تعذرت لأن Git لم يجد اسم مستخدم HTTPS في جلسة الطرفية.
SHA رأس `main` بحسب GitHub هو `dd44d09d399f3884f2d6c5cdd3e8041e5e4b373e`.
رأس PR #1 المفتوح هو `b0f84d157b371ccb357bdeae68a5abc630fefe72`. أعاد GitHub حالة `mergeable: false` ونتيجة ناجحة لأحدث تشغيل معروض لرأسه. أعادت بيانات PR قيمة base SHA مختلفة عن رأس main الحالي، لذا تُحفظ النقطتان منفصلتين. [الطلب](https://github.com/cctw1382-stack/almas-elearning/pull/1) · [التشغيل](https://github.com/cctw1382-stack/almas-elearning/actions/runs/41222006796).
لم يظهر ملف Handover في المستودع أو المرفقات المحلية التي فُحصت، والمطابقة أدناه تتبع جدول المالك.

## مطابقة الترقيم وحالة المراحل

| Handover | سجل التسليم | حالة الاستئناف |
| --- | --- | --- |
| G0 | تدقيق قبل إغلاق المراحل | تحقق محلي من الحالات الـ62 بعد الإعادة، PR وCI للالتزام المحلي غير مثبتين |
| P1 | المرحلة الأولى، نموذج HTML | تحقق محلي موزع بين التشغيل الأول والإعادة، قبول الأجهزة وPR المتابعة مفتوحان |
| P2 | المرحلة الثانية، Vite وPWA | جزئي، فحوص البناء و30 وحدة و6 حالات PWA و167 حالة متصفح ناجحة، وقبول Android مؤجل |
| P3 | المرحلة الثالثة، الهوية وAPI وعزل المدارس | جزئي، Go وKeycloak محلي وحفظ إجابات، وربط ولي الأمر مفتوح |
| P4 | المرحلة الرابعة، الوسائط والامتحانات والاستعادة | جزئي، بدأ مسار المحاولة في سجل الثالثة |
| P5 | المرحلة الخامسة، الدفع والذكاء الاصطناعي | غير مثبت |
| P6 | المرحلة السادسة، النشر وقياس الحمل | غير مثبت |

## بوابات القبول

G0 يتطلب تحديد SHA المحلي وSHA الرئيسي وحالة PR #1، والتحقق من آخر تشغيل CI، وتشغيل `npm test` مع تسجيل الشجرة التي اختُبرت، وتسجيل مطابقة المراحل.
أذن المالك بمتابعة P1 بعد محاولة رفع G0. بدأ تدقيق P1 بمقارنة `prototype/index.html` بين رأس PR #1 ورأس G0. تطابق الملف في الالتزامين، مع وجود تغييرات في مساعد الاختبارات واختبارات الفيديو. نتيجة CI لرأس PR #1 تخص ذلك الالتزام وحده. أعاد GitHub قائمة خالية من تشغيلات PR للالتزام المحلي `f2a5867`.

## pending-human

Android فعلي (مؤجل)، Smart TV والريموت، الصوت المسموع، قارئ الشاشة، وقرار دمج PR #1.

## needs-owner

اعتماد مزوّد الهوية للإنتاج، وبنية الإنتاج والتخزين ومزوّدو الدفع والذكاء الاصطناعي عند بلوغ بواباتها.

## قرارات ثابتة

Go وPostgreSQL وKeycloak محلياً، وهوية الماس بمكعبين، وواجهة عربية RTL، ونموذج HTML مستقل.

## آخر نتائج الاختبار

`npm run test:unit` نجح 20/20 على شجرة العمل. سُجل التشغيل الكامل في `.work/g0-full.log`. تأكد تطابق ملفات الاختبار والنموذج وإعداد Playwright مع HEAD بفحص الفرق الخاص بها.
نتيجة `npm test` النهائية 20 وحدة ناجحة، و105 متصفح ناجحة، و62 فاشلة، وواحدة متخطاة في WebKit لترميز الفيديو على Windows. الدليل `.work/g0-full.log`.
انهار Firefox داخل عزل الأوامر برمز 3221225477 قبل فتح التطبيق. خارج العزل نجحت حالة الوصول الموجهة 1/1 ثم نجحت 50/51 في مجموعة Firefox. حالة استمرار تعديل المادة بعد إعادة التحميل فشلت في المجموعة ونجحت منفردة 1/1. الأدلة `.work/g0-firefox-host-full.log` و`.work/g0-firefox-subjects.log`. يبقى التحقق من إخفاقات WebKit وتذبذب حفظ السجلات مفتوحاً.

## المهمة التالية الوحيدة

تنفيذ `SubmitAttempt` بمعاملة واحدة ومفتاح إعادة ونسخة تصحيح ثابتة، ثم إعادة اختبار PostgreSQL للوصول إلى GREEN.

## إعادة G0

نجح `npx playwright test --last-failed` خارج العزل 62/62 على شجرة اختبار `f2a5867`. إخفاقات إقلاع Firefox مرتبطة بالعزل. إخفاقات WebKit في حفظ السجلات لم تتكرر، وسببها غير محسوم. تخطي ترميز الفيديو في WebKit على Windows قيد منفصل. الدليل `.work/g0-last-failed.log`.

## قبول P1

فرع المراجعة المحلي `feat/p1-acceptance-evidence`. جمعت المصفوفة 167 حالة ناجحة عبر تشغيلين، وحالة ترميز واحدة متخطاة. يبقى دليل Linux التاريخي على رأس PR #1. مراجعة مطابقة BUG-01 إلى BUG-25 تحتاج جدول المعرّفات من Handover.

## قبول P2

الفرع المحلي `feat/p2-pwa-acceptance`. نجح `npm run build:web` وبُنيت 7 ملفات عامة للعمل دون اتصال. نجح `npm run test:web:unit` في 30/30 خارج العزل بعد فشل اتصال HTTP محلي في حالتين داخله. نجح `npm run test:web:pwa` في 6/6، بما يشمل التحديث وموافقة المستخدم وحفظ المسودة والإجابات والرجوع إلى النسخة المتاحة. الأدلة `.work/p2-resume-build.log` و`.work/p2-resume-unit-host.log` و`.work/p2-resume-pwa-host.log`.
نجح `npm run test:web:e2e` على النسخة المبنية من شجرة P2 المحلية، 167 نجاحاً وحالة ترميز واحدة متخطاة، دون إخفاق. الدليل `.work/p2-resume-e2e.log`. تبقى تغييرات P2 الموجودة مسبقاً في شجرة العمل، ويبقى PR المرحلة مفتوحاً كمتطلب.

## تحقق P3

أضيفت حالة RED محلية إلى `TestPostgresSaveAnswer` تقارن نتيجة التسليم الأولى بإعادته بالمفتاح نفسه ثم بمفتاح جديد. فشلت على PostgreSQL المعزول عند غياب `SubmitAttempt`. الدليل `.work/p3-submit-fixture-red.log`. ما زال يلزم إثبات صحة الدرجة بعد تغيير تعريف الامتحان الحي.

الفرع المحلي `feat/p3-api-acceptance`. نجح فحص تطابق الأنواع و6/6 من اختبارات العقد. نجح `infra/test-postgres-memberships.ps1` مع `-IdentityRuntimeRoot` على قاعدة PostgreSQL المؤقتة وبعد الاستعادة، ونجح PKCE وحفظ الإجابة وإعادة الطلب عبر HTTP برمز Keycloak. الأدلة `.work/p3-resume-contracts.log` و`.work/p3-resume-integration.log`. يغطي التحقق الشجرة المحلية الحالية. تسليم المحاولة والتصحيح وربط ولي الأمر والواجهة باقية.
