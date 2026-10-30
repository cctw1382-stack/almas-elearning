# نموذج البيانات
## الكيانات المقترحة
users, roles, user_roles, schools, academic_years, grades, classrooms, subjects, courses, enrollments, guardian_student_links, lessons, video_assets, video_checkpoints, questions, question_options, exams, exam_attempts, answers, assignments, submissions, progress_events, bookmarks, notifications, messages, subscriptions, payment_transactions, ai_requests, audit_events.
## قواعد البيانات
PostgreSQL للإنتاج، UUID للمفاتيح، foreign keys وunique/check constraints، timestamps UTC، فهارس على علاقات المدرسة والتسجيل والنتائج، معاملات atomic للمدفوعات والاختبارات، idempotency keys.
SQLite مسموح للتجارب المحلية فقط؛ يجب فصل DataProvider بحيث لا تعتمد الشاشات على محرك DB. أنشئ SQL migrations مرقمة واختبر upgrade/rollback على staging؛ لا تشغّل migrations تدميرية آلياً على الإنتاج.
