import { bootstrapApp } from './main.js';
import { CONTENT } from './content.js';
import { loadPreviewConfig, loadStoredConfig } from './config-store.js';

const root = document.querySelector('#app');
document.title = CONTENT.browserTitle;

if (root) {
  const isPreview = new URLSearchParams(window.location.search).has('preview');
  const config = isPreview ? loadPreviewConfig() : loadStoredConfig();
  const app = bootstrapApp(root, {
    sceneSequence: config.sceneSequence,
    questionSets: config.questionSets,
    choiceHoldDurationMs: config.choiceHoldDurationMs,
  });

  if (isPreview && window.parent !== window) {
    app.manager.subscribe((snapshot) => {
      window.parent.postMessage({
        type: 'rocking-train-preview-state',
        snapshot,
      }, window.location.origin === 'null' ? '*' : window.location.origin);
    });
  }
}
