# video-demo clip — procedurally generated (no third-party content)

`clip.mp4` is generated with ffmpeg's built-in `mandelbrot` source (a deep zoom),
then downscaled/compressed:

```
ffmpeg -f lavfi -i "mandelbrot=size=960x540:rate=30:start_scale=3:end_scale=0.3:end_pts=6" \
  -t 5 -vf scale=960:540 -c:v libx264 -crf 34 -pix_fmt yuv420p clip.mp4
```

No third-party footage or rights are involved — it's a synthetic test clip, used
only to demonstrate the `video` source node. Example asset under `examples/`; NOT
bundled into the published `reframe-video` npm package.
