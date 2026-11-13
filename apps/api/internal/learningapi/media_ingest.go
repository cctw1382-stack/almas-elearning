package learningapi

import (
	"context"
	"io"
	"os"
)

type RegisterRendition func(context.Context, string, MediaObject) error

// IngestHLS adapts an upload into a converted rendition. Registration makes
// the playlist visible only after all of its objects have been stored.
func IngestHLS(convert MediaConverter, store StoreUpload, register RegisterRendition) StoreUpload {
	return func(ctx context.Context, key string, source io.Reader) error {
		file, err := os.CreateTemp("", "almas-source-*.mp4")
		if err != nil {
			return err
		}
		defer os.Remove(file.Name())
		_, copyErr := io.Copy(file, source)
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		object, err := PublishHLS(ctx, file.Name(), key, convert, store)
		if err != nil {
			return err
		}
		return register(ctx, key, object)
	}
}
