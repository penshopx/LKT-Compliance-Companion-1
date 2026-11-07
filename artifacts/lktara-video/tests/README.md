# Video playback regression

Run from the workspace root while the managed `artifacts/lktara-video: web`
workflow is running:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/repl/tools/bin/chromium \
  pnpm --filter @workspace/lktara-video run test:controls
```

For another machine, install Playwright's browser once and omit the executable
override:

```sh
pnpm --filter @workspace/lktara-video exec playwright install --with-deps chromium
pnpm --filter @workspace/lktara-video run test:controls
```

Local tests use the shared proxy at `http://localhost/lktara-video/`.
`VIDEO_TEST_BASE_URL` overrides the origin (not the artifact path).
CI alone starts its own Vite server on port 5173; no application secrets are
required. The `Video playback regression` GitHub job runs on pushes, pull
requests and the merge queue. Require that status in branch rules if merges
must be blocked by failures.

## Coverage

- **Real app in a real iframe:** pause/resume freezes the scene clock, progress,
  WAAPI animations and audio; resuming uses remaining scene time.
- Jump to every scene (including backwards and from paused), verify original
  duration, audio seek, automatic advancement and source-selection messages.
- Lock/replay across multiple boundaries; jump while locked; unlock resumes the
  original sequence.
- Mute/unmute checks the actual audio element, including remount, pause and
  repeat.
- **Real standalone app:** no controls, audio enabled, all six original scene
  boundaries, 30-second recording stop and restart from the first scene.
- **Optional workspace wrapper:** an isolated test-only entry exercises the real
  `WorkspaceControlledVideo`, bridge and timer hooks via parent `postMessage`.
  It covers iframe pause/resume, jump, repeated locking/unlocking and the
  standalone no-wrapper/no-listener path. This entry is not part of the
  production build and does not replace the film or its scenes.

Playwright controls the browser clock, not the production durations. React,
scene hooks, Framer Motion and the actual music file remain real. Chromium's
autoplay flag makes audio state assertions independent of browser gesture
policy; these tests do **not** verify audible speaker output, autoplay denial,
or exported MP4 encoding.

Failure traces are written only to the ignored
`generated-artifacts/video-controls/` directory.
