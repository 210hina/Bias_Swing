import {
  getDefaultConfig,
  loadStoredConfig,
  normalizeAppConfig,
  savePreviewConfig,
  saveStoredConfig,
} from './config-store.js';
import { ASSET_MANIFEST } from './main.js';

const BACKGROUND_ASSET_KEYS = Object.entries(ASSET_MANIFEST)
  .filter(([key, asset]) =>
    asset.type === 'image' && (key.startsWith('bg_') || key.startsWith('train_')),
  )
  .map(([key]) => key);

const SCENE_BEHAVIOR_OPTIONS = [
  ['timed', '通常演出（時間で次へ）'],
  ['stage_input', '次の設問を表示'],
  ['summary', '総合結果を表示'],
  ['end', '終了画面'],
];

const timingEditor = document.querySelector('#timing-editor');
const sequenceEditor = document.querySelector('#sequence-editor');
const timeline = document.querySelector('#timeline');
const previewFrame = document.querySelector('#preview-frame');
const previewPlaceholder = document.querySelector('#preview-placeholder');
const status = document.querySelector('#status');
let config = loadStoredConfig();
let statusTimer = null;
let selectedSceneIndex = 0;

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.type = options.type;
  return node;
}

function announce(message, isError = false) {
  clearTimeout(statusTimer);
  status.textContent = message;
  status.style.color = isError ? 'var(--danger)' : 'var(--accent)';
  statusTimer = setTimeout(() => { status.textContent = ''; }, 4500);
}

function formatSeconds(milliseconds) {
  return `${(milliseconds / 1000).toFixed(milliseconds % 1000 ? 1 : 0)}秒`;
}

function renderTimings() {
  timingEditor.replaceChildren();
  const holdRow = element('div', { className: 'timing-row timing-row--hold' });
  const holdLabel = element('label', { text: '選択ホールド時間' });
  holdLabel.append(element('small', { text: '左右を確定するまでの長押し' }));
  const holdRange = element('input');
  holdRange.type = 'range';
  holdRange.min = '100';
  holdRange.max = '10000';
  holdRange.step = '100';
  holdRange.value = config.choiceHoldDurationMs;
  holdRange.dataset.holdDuration = 'true';
  const holdNumber = element('input');
  holdNumber.type = 'number';
  holdNumber.min = '100';
  holdNumber.max = '30000';
  holdNumber.step = '100';
  holdNumber.value = config.choiceHoldDurationMs;
  holdNumber.dataset.holdDuration = 'true';
  const holdSeconds = element('span', {
    className: 'seconds',
    text: formatSeconds(config.choiceHoldDurationMs),
  });
  holdSeconds.dataset.holdSeconds = 'true';
  holdRow.append(holdLabel, holdRange, holdNumber, holdSeconds);
  timingEditor.append(holdRow);

  config.sceneSequence.forEach((scene, sceneIndex) => {
    const card = element('article', {
      className: `scene-config-card${sceneIndex === selectedSceneIndex ? ' is-selected' : ''}`,
    });
    card.dataset.sceneIndex = sceneIndex;
    card.setAttribute('aria-selected', String(sceneIndex === selectedSceneIndex));
    const header = element('header', { className: 'scene-config-card__header' });
    const nameEditor = element('div', { className: 'scene-config-card__name' });
    nameEditor.append(element('strong', { text: `${sceneIndex + 1}.` }));
    const nameInput = element('input');
    nameInput.type = 'text';
    nameInput.value = scene.label;
    nameInput.placeholder = 'シーン名を入力';
    nameInput.setAttribute('aria-label', `${sceneIndex + 1}番目のシーン名`);
    nameInput.dataset.sceneField = 'label';
    nameInput.dataset.sceneIndex = sceneIndex;
    nameEditor.append(nameInput);
    header.append(nameEditor);
    const actions = element('div', { className: 'scene-config-card__actions' });
    [
      ['▲ 上へ', 'scene-up'],
      ['▼ 下へ', 'scene-down'],
      ['削除', 'scene-delete'],
    ].forEach(([label, action]) => {
      const button = element('button', {
        className: `button button--small${action === 'scene-delete' ? ' button--danger' : ''}`,
        text: label,
        type: 'button',
      });
      button.dataset.sceneAction = action;
      button.dataset.sceneIndex = sceneIndex;
      if (action === 'scene-up') button.disabled = sceneIndex === 0;
      if (action === 'scene-down') button.disabled = sceneIndex === config.sceneSequence.length - 1;
      actions.append(button);
    });
    header.append(actions);

    const fields = element('div', { className: 'scene-config-card__fields' });
    const addTextField = (label, field, value, wide = false) => {
      const wrapper = element('div', { className: `field${wide ? ' field--wide' : ''}` });
      wrapper.append(element('label', { text: label }));
      const input = element('input');
      input.type = 'text';
      input.value = value;
      input.dataset.sceneField = field;
      input.dataset.sceneIndex = sceneIndex;
      wrapper.append(input);
      fields.append(wrapper);
    };
    addTextField('シーンID / ステート名', 'id', scene.id);

    const behaviorField = element('div', { className: 'field' });
    behaviorField.append(element('label', { text: '動作種別' }));
    const behaviorSelect = element('select');
    behaviorSelect.dataset.sceneField = 'behavior';
    behaviorSelect.dataset.sceneIndex = sceneIndex;
    SCENE_BEHAVIOR_OPTIONS.forEach(([value, label]) => {
      const option = element('option', { text: label });
      option.value = value;
      option.selected = scene.behavior === value;
      behaviorSelect.append(option);
    });
    behaviorField.append(behaviorSelect);
    fields.append(behaviorField);

    const backgroundField = element('div', { className: 'field' });
    backgroundField.append(element('label', { text: '背景画像（ファイル名）' }));
    const backgroundSelect = element('select');
    backgroundSelect.dataset.sceneField = 'backgroundAssetKey';
    backgroundSelect.dataset.sceneIndex = sceneIndex;
    BACKGROUND_ASSET_KEYS.forEach((key) => {
      const filename = ASSET_MANIFEST[key].src.split('/').pop();
      const option = element('option', { text: filename });
      option.value = key;
      option.selected = scene.backgroundAssetKey === key;
      backgroundSelect.append(option);
    });
    backgroundField.append(backgroundSelect);
    fields.append(backgroundField);

    const uploadField = element('div', { className: 'field scene-upload' });
    uploadField.append(element('label', { text: 'ローカル画像をアップロード' }));
    const uploadInput = element('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
    uploadInput.dataset.sceneUpload = 'true';
    uploadInput.dataset.sceneIndex = sceneIndex;
    uploadField.append(uploadInput);
    const uploadStatus = element('small', {
      className: 'scene-upload__status',
      text: scene.backgroundImageName
        ? `選択中: ${scene.backgroundImageName}`
        : '未選択（上の登録済み画像を使用）',
    });
    uploadField.append(uploadStatus);
    if (scene.backgroundImageSrc) {
      const removeUpload = element('button', {
        className: 'button button--small button--danger',
        text: 'アップロード画像を解除',
        type: 'button',
      });
      removeUpload.dataset.sceneAction = 'scene-upload-remove';
      removeUpload.dataset.sceneIndex = sceneIndex;
      uploadField.append(removeUpload);
    }
    fields.append(uploadField);

    const durationField = element('div', { className: 'field field--wide scene-duration' });
    durationField.append(element('label', { text: '表示時間（ms / 秒）' }));
    const durationControls = element('div', { className: 'scene-duration__controls' });
    const range = element('input');
    range.type = 'range';
    range.min = '0';
    range.max = '30000';
    range.step = '100';
    range.value = scene.durationMs;
    range.dataset.sceneField = 'durationMs';
    range.dataset.sceneIndex = sceneIndex;
    const number = element('input');
    number.type = 'number';
    number.min = '0';
    number.max = '300000';
    number.step = '100';
    number.value = scene.durationMs;
    number.dataset.sceneField = 'durationMs';
    number.dataset.sceneIndex = sceneIndex;
    const seconds = element('span', { className: 'seconds', text: formatSeconds(scene.durationMs) });
    seconds.dataset.sceneSeconds = sceneIndex;
    durationControls.append(range, number, seconds);
    durationField.append(durationControls);
    fields.append(durationField);
    addTextField('表示タイトル（任意）', 'title', scene.title, true);
    addTextField('メッセージ本文（任意）', 'message', scene.message, true);
    card.append(header, fields);
    timingEditor.append(card);
  });
}

function createField(label, value, field, setIndex, stageIndex = null, variantIndex = null) {
  const wrapper = element('div', { className: 'field' });
  wrapper.append(element('label', { text: label }));
  const input = element('input');
  input.type = 'text';
  input.value = value ?? '';
  input.dataset.field = field;
  input.dataset.setIndex = setIndex;
  if (stageIndex !== null) input.dataset.stageIndex = stageIndex;
  if (variantIndex !== null) input.dataset.variantIndex = variantIndex;
  wrapper.append(input);
  return wrapper;
}

function createAction(label, action, setIndex, stageIndex = null, danger = false) {
  const button = element('button', {
    className: `button button--small${danger ? ' button--danger' : ''}`,
    text: label,
    type: 'button',
  });
  button.dataset.action = action;
  button.dataset.setIndex = setIndex;
  if (stageIndex !== null) button.dataset.stageIndex = stageIndex;
  return button;
}

function createStageCard(stage, setIndex, stageIndex, total) {
  const card = element('article', { className: 'stage-card' });
  const header = element('div', { className: 'stage-card__header' });
  header.append(element('h3', { text: `STAGE ${stageIndex + 1}` }));
  const actions = element('div', { className: 'stage-card__actions' });
  actions.append(
    createAction('↑', 'stage-up', setIndex, stageIndex),
    createAction('↓', 'stage-down', setIndex, stageIndex),
    createAction('削除', 'stage-delete', setIndex, stageIndex, true),
  );
  actions.children[0].disabled = stageIndex === 0;
  actions.children[1].disabled = stageIndex === total - 1;
  header.append(actions);

  const fields = element('div', { className: 'stage-fields' });
  const appendContentFields = (container, content, variantIndex = null) => {
    const infoField = element('div', { className: 'field field--wide' });
    infoField.append(element('label', { text: '情報レベル' }));
    const select = element('select');
    select.dataset.field = 'infoLevel';
    select.dataset.setIndex = setIndex;
    select.dataset.stageIndex = stageIndex;
    if (variantIndex !== null) select.dataset.variantIndex = variantIndex;
    [
      ['text_only', 'text_only（文字のみ）'],
      ['text_and_illustration', 'text_and_illustration（文字＋絵）'],
      ['social_statistics', 'social_statistics（他者の選択率）'],
    ].forEach(([value, label]) => {
      const option = element('option', { text: label });
      option.value = value;
      option.selected = content.infoLevel === value;
      select.append(option);
    });
    infoField.append(select);
    container.append(
      infoField,
      createField('左：乗客ラベル', content.left.label, 'left.label', setIndex, stageIndex, variantIndex),
      createField('右：乗客ラベル', content.right.label, 'right.label', setIndex, stageIndex, variantIndex),
      createField('左：assetKey', content.left.assetKey, 'left.assetKey', setIndex, stageIndex, variantIndex),
      createField('右：assetKey', content.right.assetKey, 'right.assetKey', setIndex, stageIndex, variantIndex),
    );
  };

  if (Array.isArray(stage.variants) && stage.variants.length) {
    fields.classList.add('stage-fields--variants');
    stage.variants.forEach((variant, variantIndex) => {
      const variantBlock = element('section', { className: 'variant-block' });
      const variantTitle = element('h4', {
        text: variant.label || `分岐 ${variantIndex + 1}`,
      });
      const variantFields = element('div', { className: 'stage-fields' });
      variantFields.append(
        createField('分岐ID', variant.id, 'variant.id', setIndex, stageIndex, variantIndex),
        createField('分岐名', variant.label, 'variant.label', setIndex, stageIndex, variantIndex),
      );
      appendContentFields(variantFields, variant, variantIndex);
      variantBlock.append(variantTitle, variantFields);
      fields.append(variantBlock);
    });
  } else {
    appendContentFields(fields, stage);
  }
  card.append(header, fields);
  return card;
}

function renderSequence() {
  sequenceEditor.replaceChildren();
  config.questionSets.forEach((questionSet, setIndex) => {
    const section = element('section', { className: 'question-set' });
    const header = element('div', { className: 'question-set__header' });
    header.append(
      createField('セットID', questionSet.id, 'set.id', setIndex),
      createField('セット名', questionSet.label, 'set.label', setIndex),
    );
    const actions = element('div', { className: 'question-set__actions' });
    actions.append(
      createAction('↑', 'set-up', setIndex),
      createAction('↓', 'set-down', setIndex),
      createAction('削除', 'set-delete', setIndex, null, true),
    );
    actions.children[0].disabled = setIndex === 0;
    actions.children[1].disabled = setIndex === config.questionSets.length - 1;
    header.append(actions);

    const list = element('div', { className: 'stage-list' });
    questionSet.stages.forEach((stage, stageIndex) => {
      list.append(createStageCard(stage, setIndex, stageIndex, questionSet.stages.length));
    });
    const addStage = createAction('＋ ステージを追加', 'stage-add', setIndex);
    addStage.classList.add('add-stage');
    section.append(header, list, addStage);
    sequenceEditor.append(section);
  });
}

function addTimelineItem(label, duration, state, extra = {}) {
  const item = element('div', { className: 'timeline__item' });
  item.dataset.state = state;
  Object.entries(extra).forEach(([key, value]) => { item.dataset[key] = value; });
  item.append(
    element('strong', { text: label }),
    element('span', { text: duration === null ? '操作待ち' : formatSeconds(duration) }),
  );
  timeline.append(item);
}

function renderTimeline() {
  timeline.replaceChildren();
  addTimelineItem('ATTRACT', null, 'ATTRACT');
  config.sceneSequence.forEach((scene, sceneIndex) => {
    addTimelineItem(
      scene.label || scene.id,
      scene.durationMs,
      scene.id,
      { sceneIndex },
    );
  });
}

function renderAll() {
  renderTimings();
  renderSequence();
  renderTimeline();
}

function normalizeAndRender() {
  config = normalizeAppConfig(config);
  selectedSceneIndex = Math.min(
    Math.max(0, selectedSceneIndex),
    config.sceneSequence.length - 1,
  );
  renderAll();
}

function selectScene(sceneIndex) {
  if (!config.sceneSequence[sceneIndex]) return;
  selectedSceneIndex = sceneIndex;
  timingEditor.querySelectorAll('.scene-config-card').forEach((card) => {
    const selected = Number(card.dataset.sceneIndex) === sceneIndex;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-selected', String(selected));
  });
}

function syncStageInputSceneCount() {
  const required = config.questionSets.reduce(
    (total, questionSet) => total + questionSet.stages.length,
    0,
  );
  const stageScenes = () => config.sceneSequence
    .map((scene, index) => scene.behavior === 'stage_input' ? index : -1)
    .filter((index) => index >= 0);
  while (stageScenes().length > required) {
    config.sceneSequence.splice(stageScenes().at(-1), 1);
  }
  while (stageScenes().length < required) {
    const number = stageScenes().length + 1;
    const insertAt = config.sceneSequence.findIndex((scene) =>
      scene.behavior === 'summary' || scene.behavior === 'end',
    );
    config.sceneSequence.splice(insertAt < 0 ? config.sceneSequence.length : insertAt, 0, {
      id: `STAGE_${number}_INPUT`,
      behavior: 'stage_input',
      label: `Stage ${number}：設問`,
      durationMs: 12000,
      backgroundAssetKey: 'train_close_full',
      title: '',
      message: '← 左　・　↓ 自分　・　→ 右',
    });
  }
}

timingEditor.addEventListener('input', (event) => {
  const input = event.target;
  if (input.dataset.holdDuration) {
    config.choiceHoldDurationMs = Math.max(100, Number(input.value) || 100);
    timingEditor.querySelectorAll('[data-hold-duration]').forEach((peer) => {
      if (peer !== input) peer.value = config.choiceHoldDurationMs;
    });
    timingEditor.querySelector('[data-hold-seconds]').textContent = formatSeconds(config.choiceHoldDurationMs);
    return;
  }
  if (input.dataset.sceneField === undefined) return;
  const sceneIndex = Number(input.dataset.sceneIndex);
  const scene = config.sceneSequence[sceneIndex];
  if (!scene) return;
  const field = input.dataset.sceneField;
  scene[field] = field === 'durationMs' ? Math.max(0, Number(input.value) || 0) : input.value;
  if (field === 'backgroundAssetKey') {
    scene.backgroundImageName = '';
    scene.backgroundImageSrc = '';
    renderTimings();
    renderTimeline();
    return;
  }
  if (field === 'durationMs') {
    timingEditor.querySelectorAll(`[data-scene-index="${sceneIndex}"][data-scene-field="durationMs"]`).forEach((peer) => {
      if (peer !== input) peer.value = scene.durationMs;
    });
    timingEditor.querySelector(`[data-scene-seconds="${sceneIndex}"]`).textContent = formatSeconds(scene.durationMs);
  }
  renderTimeline();
});

timingEditor.addEventListener('click', (event) => {
  const card = event.target.closest('.scene-config-card');
  if (card) selectScene(Number(card.dataset.sceneIndex));
  const button = event.target.closest('[data-scene-action]');
  if (!button) return;
  const sceneIndex = Number(button.dataset.sceneIndex);
  const action = button.dataset.sceneAction;
  if (action === 'scene-up' && sceneIndex > 0) {
    [config.sceneSequence[sceneIndex - 1], config.sceneSequence[sceneIndex]] = [config.sceneSequence[sceneIndex], config.sceneSequence[sceneIndex - 1]];
    selectedSceneIndex = sceneIndex - 1;
  } else if (action === 'scene-down' && sceneIndex < config.sceneSequence.length - 1) {
    [config.sceneSequence[sceneIndex + 1], config.sceneSequence[sceneIndex]] = [config.sceneSequence[sceneIndex], config.sceneSequence[sceneIndex + 1]];
    selectedSceneIndex = sceneIndex + 1;
  } else if (action === 'scene-delete') {
    if (config.sceneSequence.length === 1) return announce('シーンは最低1つ必要です。', true);
    config.sceneSequence.splice(sceneIndex, 1);
    selectedSceneIndex = Math.min(sceneIndex, config.sceneSequence.length - 1);
  } else if (action === 'scene-upload-remove') {
    config.sceneSequence[sceneIndex].backgroundImageName = '';
    config.sceneSequence[sceneIndex].backgroundImageSrc = '';
  }
  normalizeAndRender();
});

timingEditor.addEventListener('change', (event) => {
  const input = event.target;
  if (!input.dataset.sceneUpload) return;
  const sceneIndex = Number(input.dataset.sceneIndex);
  const file = input.files?.[0];
  if (!file || !file.type.startsWith('image/') || !config.sceneSequence[sceneIndex]) return;
  const targetScene = config.sceneSequence[sceneIndex];
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const currentIndex = config.sceneSequence.indexOf(targetScene);
    if (currentIndex < 0) return;
    targetScene.backgroundImageName = file.name;
    targetScene.backgroundImageSrc = String(reader.result);
    selectedSceneIndex = currentIndex;
    renderTimings();
    renderTimeline();
    announce(
      file.size > 2_500_000
        ? `${file.name} を取り込みました。容量が大きいためブラウザ保存上限にご注意ください。`
        : `${file.name} を背景画像として取り込みました。`,
    );
  });
  reader.addEventListener('error', () => announce('画像ファイルを読み込めませんでした。', true));
  reader.readAsDataURL(file);
});

document.querySelector('#add-scene').addEventListener('click', () => {
  const number = config.sceneSequence.length + 1;
  const newScene = {
    id: `CUSTOM_SCENE_${number}`,
    behavior: 'timed',
    label: `追加シーン ${number}`,
    durationMs: 2000,
    backgroundAssetKey: BACKGROUND_ASSET_KEYS[0] ?? 'bg_train_loop',
    title: '',
    message: '',
  };
  const insertAt = Math.min(selectedSceneIndex + 1, config.sceneSequence.length);
  config.sceneSequence.splice(insertAt, 0, newScene);
  selectedSceneIndex = insertAt;
  normalizeAndRender();
});

sequenceEditor.addEventListener('input', (event) => {
  const input = event.target;
  const setIndex = Number(input.dataset.setIndex);
  const stageIndex = input.dataset.stageIndex === undefined ? null : Number(input.dataset.stageIndex);
  const variantIndex = input.dataset.variantIndex === undefined ? null : Number(input.dataset.variantIndex);
  const field = input.dataset.field;
  if (!field || !config.questionSets[setIndex]) return;
  const questionSet = config.questionSets[setIndex];
  if (field === 'set.id') questionSet.id = input.value;
  else if (field === 'set.label') questionSet.label = input.value;
  else if (stageIndex !== null) {
    const stage = questionSet.stages[stageIndex];
    const content = variantIndex === null ? stage : stage.variants?.[variantIndex];
    if (!content) return;
    if (field === 'variant.id') content.id = input.value;
    else if (field === 'variant.label') content.label = input.value;
    else if (field === 'infoLevel') content.infoLevel = input.value;
    else {
      const [side, property] = field.split('.');
      content[side][property] = input.value;
    }
  }
  renderTimeline();
});

sequenceEditor.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const setIndex = Number(button.dataset.setIndex);
  const stageIndex = button.dataset.stageIndex === undefined ? null : Number(button.dataset.stageIndex);
  const questionSet = config.questionSets[setIndex];

  if (action === 'set-up' && setIndex > 0) {
    [config.questionSets[setIndex - 1], config.questionSets[setIndex]] = [questionSet, config.questionSets[setIndex - 1]];
  } else if (action === 'set-down' && setIndex < config.questionSets.length - 1) {
    [config.questionSets[setIndex + 1], config.questionSets[setIndex]] = [questionSet, config.questionSets[setIndex + 1]];
  } else if (action === 'set-delete') {
    if (config.questionSets.length === 1) return announce('設問セットは最低1つ必要です。', true);
    config.questionSets.splice(setIndex, 1);
    syncStageInputSceneCount();
  } else if (action === 'stage-add') {
    questionSet.stages.push({
      stage: questionSet.stages.length + 1,
      infoLevel: 'text_only',
      left: { label: '左の乗客' },
      right: { label: '右の乗客' },
    });
    syncStageInputSceneCount();
  } else if (action === 'stage-delete') {
    if (questionSet.stages.length === 1) return announce('各設問セットには最低1ステージ必要です。', true);
    questionSet.stages.splice(stageIndex, 1);
    syncStageInputSceneCount();
  } else if (action === 'stage-up' && stageIndex > 0) {
    [questionSet.stages[stageIndex - 1], questionSet.stages[stageIndex]] = [questionSet.stages[stageIndex], questionSet.stages[stageIndex - 1]];
  } else if (action === 'stage-down' && stageIndex < questionSet.stages.length - 1) {
    [questionSet.stages[stageIndex + 1], questionSet.stages[stageIndex]] = [questionSet.stages[stageIndex], questionSet.stages[stageIndex + 1]];
  }
  normalizeAndRender();
});

document.querySelector('#add-question-set').addEventListener('click', () => {
  const number = config.questionSets.length + 1;
  const template = getDefaultConfig().questionSets[0];
  template.id = `question_set_${number}`;
  template.label = `設問セット ${number}`;
  config.questionSets.push(template);
  syncStageInputSceneCount();
  normalizeAndRender();
});

document.querySelector('#save-config').addEventListener('click', () => {
  config = saveStoredConfig(config);
  renderAll();
  announce('設定をブラウザに保存しました。本編の次回読込から反映されます。');
});

document.querySelector('#reset-config').addEventListener('click', () => {
  if (!window.confirm('編集中の設定を初期値へ戻しますか？')) return;
  config = getDefaultConfig();
  selectedSceneIndex = 0;
  renderAll();
  announce('編集中の設定を初期値へ戻しました（まだ保存されていません）。');
});

document.querySelector('#export-config').addEventListener('click', () => {
  config = normalizeAppConfig(config);
  const blob = new Blob([`${JSON.stringify(config, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = `rocking-train-config-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  announce('設定JSONを書き出しました。');
});

document.querySelector('#import-config').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    config = normalizeAppConfig(JSON.parse(await file.text()));
    selectedSceneIndex = 0;
    renderAll();
    announce(`${file.name} を読み込みました（まだブラウザ保存はされていません）。`);
  } catch (error) {
    announce(`JSONを読み込めませんでした: ${error.message}`, true);
  } finally {
    event.target.value = '';
  }
});

function preparePreview() {
  config = savePreviewConfig(config);
  const url = new URL('./index.html', window.location.href);
  url.searchParams.set('preview', '1');
  url.searchParams.set('run', Date.now());
  return url.href;
}

document.querySelector('#run-preview').addEventListener('click', () => {
  previewFrame.src = preparePreview();
  previewPlaceholder.hidden = true;
  announce('編集中の設定でプレビューを開始しました。');
});

document.querySelector('#open-preview').addEventListener('click', () => {
  window.open(preparePreview(), 'rocking-train-preview', 'width=1280,height=800');
});

window.addEventListener('message', (event) => {
  if (event.source !== previewFrame.contentWindow || event.data?.type !== 'rocking-train-preview-state') return;
  const { value, context } = event.data.snapshot;
  timeline.querySelectorAll('.timeline__item').forEach((item) => {
    let active = item.dataset.state === value;
    if (active && item.dataset.sceneIndex !== undefined) {
      active = Number(item.dataset.sceneIndex) === context.sceneIndex;
    }
    item.classList.toggle('is-active', active);
    if (active) item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
});

renderAll();
