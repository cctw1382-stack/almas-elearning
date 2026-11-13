BEGIN;

CREATE TABLE almas.media_progress (
    school_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES almas.users (id),
    position_ms integer NOT NULL CHECK (position_ms BETWEEN 0 AND 86400000),
    PRIMARY KEY (school_id, asset_id, user_id),
    FOREIGN KEY (school_id, asset_id) REFERENCES almas.media_assets (school_id, id) ON DELETE CASCADE
);

GRANT SELECT, INSERT ON almas.media_progress TO almas_app;
GRANT UPDATE (position_ms) ON almas.media_progress TO almas_app;
ALTER TABLE almas.media_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.media_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY own_media_progress ON almas.media_progress
    USING (
        EXISTS (SELECT 1 FROM almas.users AS u WHERE u.id = media_progress.user_id)
        AND EXISTS (
            SELECT 1 FROM almas.media_assets AS a
            WHERE a.school_id = media_progress.school_id AND a.id = media_progress.asset_id
        )
    );

COMMIT;
