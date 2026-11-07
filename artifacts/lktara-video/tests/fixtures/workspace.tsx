// Isolated consumer of the optional wrapper, not part of the production entry.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceControlledVideo } from '../../src/lib/video/controls';
import { useSceneTimer, useVideoPlayer } from '../../src/lib/video/hooks';

const durations = { hook: 6000, checklist: 5400 };
let mounts = 0;

function Player() {
  const { currentSceneKey } = useVideoPlayer({ durations });
  const [mount] = useState(() => ++mounts);
  const [fired, setFired] = useState(false);
  useSceneTimer([{ time: 2000, callback: () => setFired(true) }]);
  return (
    <div data-video-aspect-ratio="16:9" data-mount={mount}
      data-scene={currentSceneKey} data-fired={String(fired)}>
      {currentSceneKey}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <WorkspaceControlledVideo><Player /></WorkspaceControlledVideo>,
);
