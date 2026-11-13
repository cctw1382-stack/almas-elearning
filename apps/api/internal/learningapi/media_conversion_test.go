package learningapi

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestPublishHLS(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	source := filepath.Join(t.TempDir(), "source.mp4")
	var convert MediaConverter = func(_ context.Context, _, dir string) error {
		if err := os.WriteFile(filepath.Join(dir, "segment-0.ts"), []byte("fixture"), 0600); err != nil {
			return err
		}
		return os.WriteFile(filepath.Join(dir, "index.m3u8"), []byte("#EXTM3U\n#EXTINF:1,\nsegment-0.ts\n#EXT-X-ENDLIST\n"), 0600)
	}
	if binary := os.Getenv("ALMAS_TEST_FFMPEG"); binary != "" {
		cmd := exec.CommandContext(ctx, binary, "-nostdin", "-loglevel", "error", "-f", "lavfi", "-i", "color=blue:s=160x90:r=10", "-t", "5", "-c:v", "libx264", source)
		if output, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("generate source: %v %s", err, output)
		}
		convert = FFmpegConverter(binary)
	}
	var keys []string
	object, err := PublishHLS(ctx, source, "fixture", convert, func(_ context.Context, key string, source io.Reader) error {
		size, err := io.Copy(io.Discard, source)
		if err == nil && size == 0 {
			t.Fatal("empty published file")
		}
		keys = append(keys, key)
		return err
	})
	if err != nil || len(keys) < 2 || object.Key != "fixture/index.m3u8" || keys[len(keys)-1] != object.Key {
		t.Fatalf("playlist must publish after its segments: %v %v", keys, err)
	}
}
