package learningapi

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// MediaConverter writes a VOD playlist and numbered MPEG-TS segments to dir.
type MediaConverter func(ctx context.Context, source, dir string) error

func FFmpegConverter(binary string) MediaConverter {
	return func(ctx context.Context, source, dir string) error {
		cmd := exec.CommandContext(ctx, binary, "-nostdin", "-loglevel", "error",
			"-protocol_whitelist", "file", "-f", "mov", "-i", source, "-map", "0:v:0",
			"-map", "0:a:0?", "-c:v", "libx264", "-c:a", "aac", "-f", "hls",
			"-hls_time", "4", "-hls_playlist_type", "vod",
			"-hls_segment_filename", "segment-%06d.ts", "index.m3u8")
		cmd.Dir = dir
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("convert HLS: %w: %s", err, output)
		}
		return nil
	}
}

// PublishHLS writes an immutable rendition to a new key prefix. Register the
// returned playlist key only after every write succeeds.
func PublishHLS(ctx context.Context, source, prefix string, convert MediaConverter, store StoreUpload) (MediaObject, error) {
	dir, err := os.MkdirTemp("", "almas-hls-")
	if err != nil {
		return MediaObject{}, err
	}
	defer os.RemoveAll(dir)
	source, err = filepath.Abs(source)
	if err != nil {
		return MediaObject{}, err
	}
	if err := convert(ctx, source, dir); err != nil {
		return MediaObject{}, err
	}
	playlist, err := os.ReadFile(filepath.Join(dir, "index.m3u8"))
	if err != nil {
		return MediaObject{}, err
	}
	if _, err := signMediaPlaylist(playlist, "/play?sig=placeholder"); err != nil {
		return MediaObject{}, err
	}
	key := prefix + "/index.m3u8"
	segments := 0
	for _, name := range strings.Fields(string(playlist)) {
		if !mediaSegment.MatchString(name) {
			continue
		}
		file, err := os.Open(filepath.Join(dir, name))
		if err != nil {
			return MediaObject{}, err
		}
		err = store(ctx, prefix+"/"+name, file)
		_ = file.Close()
		if err != nil {
			return MediaObject{}, err
		}
		segments++
	}
	if segments == 0 {
		return MediaObject{}, errors.New("HLS rendition has no segments")
	}
	if err := store(ctx, key, strings.NewReader(string(playlist))); err != nil {
		return MediaObject{}, err
	}
	return MediaObject{Key: key, ContentType: "application/vnd.apple.mpegurl"}, nil
}
