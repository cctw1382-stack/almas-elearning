# Keycloak لاختبار منصة الماس محلياً

يعمل نطاق `almas-local` على عنوان الحاسوب `http://127.0.0.1:8180` في وضع التطوير. يعرّف الأدوار الأربعة وعميلاً عاماً يستخدم تدفق رمز التفويض مع PKCE S256. عنوان الرجوع مخصص لربط الواجهة لاحقاً.

ضع توزيعة Keycloak 26.8.1 وTemurin 25 في مجلد محلي بعد التحقق من SHA-256 لدى المصدر الرسمي. استخدم مساراً بحروف لاتينية إذا تعذر تحميل `java.dll` من مسار المشروع. ترتيب المجلدات داخل جذر التشغيل هو `java/<jdk-directory>` و`keycloak/keycloak-26.8.1`.

شغّل بواسطة PowerShell 7:

```powershell
pwsh -NoProfile -File infra/identity/start-local.ps1 -RuntimeRoot 'C:\path\to\identity-runtime'
```

يولّد المشغّل كلمة مرور إدارة عشوائية ويخزن بياناتها في `admin-credential.clixml` بتشفير Windows المرتبط بالمستخدم والجهاز. احفظ المجلد خارج التحكم بالإصدارات. يتطلب تشغيل الاختبار المتكرر إعادة استخدام المجلد نفسه لأن مخزن Keycloak المحلي محفوظ فيه. الاستيراد عند بدء التشغيل يتخطى النطاق الموجود، لذا راجع التعديلات اللاحقة للنطاق في لوحة الإدارة.

رابط التحقق هو `/realms/almas-local/.well-known/openid-configuration`. لوحة الإدارة على `/admin/`. بيانات الإدارة تخص بيئة Keycloak فقط. ربط الواجهة، خادم Go، وتخزين بيانات المدارس وصلاحياتها في PostgreSQL أعمال متبقية من المرحلة الثالثة.

بعد بدء التشغيل، نفّذ `pwsh -NoProfile -File infra/identity/verify-local.ps1` لفحص بيانات OIDC وصفحة الدخول ورفض عنوان الرجوع غير المسموح ورفض طلب التفويض دون PKCE.

مرجع التوزيعة والتشغيل: https://www.keycloak.org/getting-started/getting-started-zip
