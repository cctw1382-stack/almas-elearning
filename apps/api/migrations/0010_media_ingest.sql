BEGIN;
GRANT INSERT ON almas.media_assets TO almas_app;
CREATE POLICY owner_publish_media ON almas.media_assets FOR INSERT TO almas_app
    WITH CHECK (EXISTS (
        SELECT 1 FROM almas.lesson_owners AS o
        WHERE o.school_id = media_assets.school_id AND o.lesson_id = media_assets.lesson_id
    ));
COMMIT;
