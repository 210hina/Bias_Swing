# PNG insertion points

Place scene and character PNG files in this directory using the exact names
below. No JavaScript change is needed after replacing a file.

| File | Screen / state |
| --- | --- |
| bg_train_loop.png | ATTRACT waiting screen |
| 01_train_Far_Full.png | SCENE_INTRO first frame (crowded train) |
| 02_train_Far_Empty.png | SCENE_INTRO second frame (emptier train) |
| 03_train_Close_Full.png | STAGE_WAIT_INPUT through STAGE_REVEAL background |
| char_20f.png | Stage 2, left passenger |
| char_70m.png | Stage 2, right passenger |

Recommended settings:

- Use PNG with transparency for char_20f.png and char_70m.png.
- Use a 4:3 or 16:9 landscape PNG for both bg_train images.
- Keep each file reasonably small for browser playback (roughly 2 MB or less).
- If a file is absent or cannot load, MediaAsset automatically shows the
  colored fallback placeholder.

hesitation_effect.gif is separate from the PNG scene illustrations and is
used by STAGE_HESITATION.
