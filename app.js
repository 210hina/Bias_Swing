import { bootstrapApp } from './main.js';
import { CONTENT } from './content.js';
import {
  buildRuntimeConfig,
  loadPreviewConfig,
  loadStoredConfig,
} from './config-store.js';

const root = document.querySelector('#app');
document.title = CONTENT.browserTitle;

if (root) {
  const parameters = new URLSearchParams(window.location.search);
  const isPreview = parameters.has('preview');
  const configuredStartSceneId = parameters.get('startSceneId') ?? '';
  const previewHost = window.parent !== window ? window.parent : window.opener;
  const messageOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
  let app = null;

  const startApp = (config, startSceneId = '', audioMuted = false) => {
    app?.destroy();
    const runtimeConfig = buildRuntimeConfig(config);
    app = bootstrapApp(root, { ...runtimeConfig, audioMuted });
    if (isPreview && startSceneId) app.manager.startSequenceAt(startSceneId);
    if (isPreview && previewHost) {
      const publishSnapshot = (snapshot) => {
        previewHost.postMessage({ type: 'rocking-train-preview-state', snapshot }, messageOrigin);
      };
      app.manager.subscribe(publishSnapshot);
      publishSnapshot(app.manager.getSnapshot());
    }
  };

  if (!isPreview) {
    startApp(loadStoredConfig());
  } else {
    window.addEventListener('message', (event) => {
      if (event.source !== previewHost) return;
      if (event.data?.type === 'rocking-train-preview-config') {
        startApp(
          event.data.config,
          event.data.startSceneId ?? configuredStartSceneId,
          event.data.muted,
        );
      } else if (event.data?.type === 'rocking-train-preview-audio-mute') {
        app?.manager.setAudioMuted(event.data.muted);
      }
    });
    if (previewHost) {
      previewHost.postMessage({ type: 'rocking-train-preview-ready' }, messageOrigin);
    } else {
      startApp(loadPreviewConfig(), configuredStartSceneId);
    }
  }
}
