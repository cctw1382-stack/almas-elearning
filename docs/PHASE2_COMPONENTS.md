# مكونات دفعة المرحلة الثانية — 2026-11-02

| المكون | المصدر الأصلي | الإصدار المعتمد | الترخيص | الاستخدام |
| --- | --- | --- | --- | --- |
| Vite | https://github.com/vitejs/vite | 8.3.5 | MIT | بناء ملفات الواجهة |
| TypeScript | https://github.com/microsoft/TypeScript | 7.0.2 | Apache-2.0 | فحص الكود الجديد وترجمة Service Worker |

الإصدارات مقفلة في apps/web/package-lock.json مع روابط سجل npm الرسمي وintegrity. بيئة التحقق Node 22.23.2؛ تطابق شرط Vite: Node ^20.19.0 أو >=22.12.0، وشرط TypeScript >=16.20.0. تبقى الحزم أدوات تطوير؛ المعاينة تقدم ملفات البناء فقط.

نسخ الرخص والإشعارات الأصلية في [licenses](licenses/)، وإشعارات Vite مرفقة أيضاً داخل التوزيع في third-party-notices.txt. الشعار من أصول الماس السابقة؛ أعيد تحويله إلى PNG محلياً، دون أصول من منصة أخرى.

## قرار استبعاد إضافة PWA

فُحص vite-plugin-pwa 2.0.0، وترخيصه MIT ومتوافق مع Vite 8، لكن npm audit كشف 10 تنبيهات متسلسلة: 2 منخفضة و8 متوسطة. مصادرها في أدوات workbox-build، ومنها:

- https://github.com/advisories/GHSA-gcqx-w48m-w2h4 — deepmerge.
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 — glob.
- https://github.com/advisories/GHSA-g3hv-75wg-m249 — minimatch.

لم تُخفَ التنبيهات ولم تُفرض overrides كبيرة ولم يُستخدم audit fix --force. أزيلت الإضافة وتبعياتها، واستُخدم Service Worker محدود ومراجع داخل المشروع. بعد الإزالة وتحديث القفل، سجل npm أعاد صفر تنبيهات معروفة. هذا فحص في تاريخ محدد وليس ضمان خلو من الثغرات؛ يعاد قبل النشر.

تنبيهات Vite التي روجعت وأصلحت في 8.3.3 (أقل من إصدارنا):

- https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22
- https://github.com/vitejs/vite/security/advisories/GHSA-vfpm-58rq-9qcg
- https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw

لا توجد دعوى «أفضل براءات» أو اعتماد رسمي أو عدم وجود أخطاء. الاختيار على أساس المصدر، الترخيص، توافق الإصدار، وفحوص فعلية في هذا التطبيق. تبقى pgx وgoose وغيرهما مرشحين للمراحل اللاحقة فقط.
