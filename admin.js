import {
  CONFIG_STORAGE_KEY,
  buildRuntimeConfig,
  getDefaultConfig,
  loadStoredConfig,
  normalizeAppConfig,
  saveStoredConfig,
} from './config-store.js';
import { ASSET_MANIFEST, AUDIO_MANIFEST } from './main.js';

const BUILTIN_BACKGROUND_ASSET_KEYS = Object.entries(ASSET_MANIFEST)
  .filter(([key, asset]) => asset.type === 'image' && (key.startsWith('bg_') || key.startsWith('train_')))
  .map(([key]) => key);
const PLACEHOLDER_AUDIO_ASSET_KEYS = new Set(Object.keys(AUDIO_MANIFEST));
const BEHAVIORS = [
  ['timed', '通常演出（時間で次へ）'],
  ['stage_input', '設問を表示（選択入力）'],
  ['summary', '総合結果を表示'],
  ['end', '終了画面'],
];
const PRESENTATION_TYPES = [
  ['text_only', '文字のみ'],
  ['random', 'ランダム分岐（2α / 2β）'],
  ['text_and_illustration', '2α：イラスト情報'],
  ['text_and_stats', '2β：他者の選択率'],
];

const tabs = document.querySelector('#config-tabs');
const tabToolbar = document.querySelector('#tab-toolbar');
const tabEditor = document.querySelector('#tab-editor');
const questionSceneActions = document.querySelector('#question-scene-actions');
const timeline = document.querySelector('#timeline');
const previewFrame = document.querySelector('#preview-frame');
const previewPlaceholder = document.querySelector('#preview-placeholder');
const status = document.querySelector('#status');

let config = loadStoredConfig();
let activeTab = { type: 'intro', index: 0 };
const selectedTransitions = new Map();
let statusTimer = null;
let previewHasRun = false;
let previewFromCurrentTab = true;
let previewStartSceneId = null;
let previewRefreshTimer = null;
let externalPreviewWindow = null;
let externalPreviewFromCurrentTab = true;
let previewMuted = false;
let draggedTransitionIndex = null;
let draggedTransitionTabKey = '';
let dragAutoScrollSpeed = 0;
let dragAutoScrollFrame = null;

function customImages() {
  return config.customAssets?.images ?? {};
}

function customAudio() {
  return config.customAssets?.audio ?? {};
}

function imageAssetInfo(key) {
  const builtin = ASSET_MANIFEST[key];
  if (builtin) return { fileName: builtin.src.split('/').pop() || key, src: builtin.src, builtin: true };
  const custom = customImages()[key];
  return custom ? { ...custom, builtin: false } : null;
}

function audioAssetInfo(key) {
  return AUDIO_MANIFEST[key] ?? customAudio()[key] ?? null;
}

function audioFileName(key) {
  const asset = audioAssetInfo(key);
  return asset?.fileName || asset?.src?.split('/').pop() || key;
}

function backgroundAssetKeys() {
  return [...BUILTIN_BACKGROUND_ASSET_KEYS, ...Object.keys(customImages())];
}

function illustrationAssetKeys() {
  const builtin = Object.keys(ASSET_MANIFEST).filter((key) => !BUILTIN_BACKGROUND_ASSET_KEYS.includes(key));
  return [...builtin, ...Object.keys(customImages())];
}

function audioAssetKeys(kind) {
  return Object.entries(customAudio())
    .filter(([, asset]) => asset.kind === kind)
    .map(([key]) => key);
}

function clearPlaceholderAudioReferences(candidate = config) {
  const sequences = [
    candidate.introduction?.sequence ?? [],
    ...(candidate.questionScenes ?? []).map((scene) => scene.sequence ?? []),
    candidate.result?.sequence ?? [],
  ];
  sequences.flat().forEach((scene) => {
    if (PLACEHOLDER_AUDIO_ASSET_KEYS.has(scene.soundAsset?.bgm?.assetKey)) {
      scene.soundAsset.bgm.assetKey = '';
    }
    ['startAssetKey', 'actionAssetKey'].forEach((field) => {
      if (PLACEHOLDER_AUDIO_ASSET_KEYS.has(scene.soundAsset?.se?.[field])) {
        scene.soundAsset.se[field] = '';
      }
    });
  });
}

clearPlaceholderAudioReferences();

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.type = options.type;
  return node;
}

function button(label, action, className = '') {
  const node = el('button', {
    type: 'button',
    text: label,
    className: `button ${className}`.trim(),
  });
  node.dataset.action = action;
  return node;
}

function announce(message, error = false) {
  clearTimeout(statusTimer);
  status.textContent = message;
  status.style.color = error ? 'var(--danger)' : 'var(--accent)';
  statusTimer = setTimeout(() => { status.textContent = ''; }, 4500);
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}秒`;
}

function tabKey() {
  return activeTab.type === 'question'
    ? `question:${config.questionScenes[activeTab.index]?.id ?? activeTab.index}`
    : activeTab.type;
}

function activeSequence() {
  if (activeTab.type === 'intro') return config.introduction.sequence;
  if (activeTab.type === 'result') return config.result.sequence;
  return config.questionScenes[activeTab.index]?.sequence ?? [];
}

function activeQuestionScene() {
  return activeTab.type === 'question' ? config.questionScenes[activeTab.index] : null;
}

function stageIndexForTransition(transitionIndex, sequence = activeSequence()) {
  return sequence.slice(0, transitionIndex).filter((scene) => scene.behavior === 'stage_input').length;
}

function createStageConfig(stageIndex) {
  const defaults = getDefaultConfig().questionScenes[0].questionSet.stages;
  const template = defaults[Math.min(stageIndex, defaults.length - 1)] ?? defaults[0];
  const stage = JSON.parse(JSON.stringify(template));
  stage.stage = stageIndex + 1;
  return stage;
}

function renumberStages(questionScene) {
  questionScene.questionSet.stages.forEach((stage, index) => { stage.stage = index + 1; });
}

function synchronizeQuestionStages(questionScene) {
  const stages = questionScene.questionSet.stages;
  const inputCount = questionScene.sequence.filter((scene) => scene.behavior === 'stage_input').length;
  while (stages.length < inputCount) stages.push(createStageConfig(stages.length));
  if (stages.length > inputCount) stages.splice(inputCount);
  renumberStages(questionScene);
}

function synchronizeAllQuestionStages() {
  config.questionScenes.forEach(synchronizeQuestionStages);
}

function setStagePresentation(questionScene, stageIndex, presentationType) {
  const stages = questionScene.questionSet.stages;
  const current = stages[stageIndex];
  if (!current) return;

  if (presentationType === 'random') {
    if (Array.isArray(current.variants)) {
      current.presentationType = 'random';
      return;
    }
    const replacement = createStageConfig(Math.max(1, stageIndex));
    const leftLabel = current.left?.label;
    const rightLabel = current.right?.label;
    replacement.variants.forEach((variant) => {
      if (leftLabel) variant.left.label = leftLabel;
      if (rightLabel) variant.right.label = rightLabel;
    });
    const illustration = replacement.variants.find((variant) => variant.infoLevel === 'text_and_illustration');
    if (current.infoLevel === 'text_and_illustration' && illustration) {
      illustration.left = { ...illustration.left, ...current.left };
      illustration.right = { ...illustration.right, ...current.right };
    }
    const statistics = replacement.variants.find((variant) => variant.infoLevel === 'text_and_stats');
    if (current.infoLevel === 'text_and_stats' && statistics) {
      statistics.left = { ...statistics.left, ...current.left };
      statistics.right = { ...statistics.right, ...current.right };
      if (current.stats) statistics.stats = { ...current.stats };
    }
    replacement.presentationType = 'random';
    replacement.stage = stageIndex + 1;
    stages[stageIndex] = replacement;
    return;
  }

  if (presentationType === 'text_only') {
    const source = Array.isArray(current.variants)
      ? current.variants.find((variant) => variant.infoLevel === current.presentationType) ?? current.variants[0]
      : current;
    stages[stageIndex] = {
      stage: stageIndex + 1,
      infoLevel: 'text_only',
      left: { ...(source?.left ?? {}), label: source?.left?.label ?? '左の乗客' },
      right: { ...(source?.right ?? {}), label: source?.right?.label ?? '右の乗客' },
    };
    return;
  }

  if (Array.isArray(current.variants)) {
    current.presentationType = presentationType;
    return;
  }

  current.infoLevel = presentationType;
  if (presentationType === 'text_and_illustration') {
    current.left.assetKey ||= 'char_20f';
    current.right.assetKey ||= 'char_70m';
    delete current.stats;
  } else if (presentationType === 'text_and_stats') {
    current.left.assetKey ||= 'char_20f';
    current.right.assetKey ||= 'char_70m';
    current.stats ??= { leftPercent: 45, rightPercent: 55 };
  }
}

function activeStartSceneId() {
  const sequence = activeSequence();
  const selectedIndex = selectedTransitions.get(tabKey()) ?? 0;
  return sequence[selectedIndex]?.id ?? sequence[0]?.id ?? '';
}

function field(label, value, dataset = {}, wide = false) {
  const wrap = el('div', { className: `field${wide ? ' field--wide' : ''}` });
  wrap.append(el('label', { text: label }));
  const input = el('input');
  input.type = 'text';
  input.value = value ?? '';
  Object.assign(input.dataset, dataset);
  wrap.append(input);
  return wrap;
}

function percentageField(label, value, dataset = {}) {
  const wrap = el('div', { className: 'field percentage-field' });
  wrap.append(el('label', { text: label }));
  const input = el('input');
  input.type = 'number'; input.min = '0'; input.max = '100'; input.step = '1';
  input.value = value ?? ''; Object.assign(input.dataset, dataset);
  const suffix = el('span', { text: '%' });
  wrap.append(input, suffix);
  return wrap;
}

function imageAssetField(label, value, dataset = {}) {
  const wrap = el('div', { className: 'field' });
  wrap.append(el('label', { text: label }));
  const select = el('select');
  Object.assign(select.dataset, dataset);
  const none = el('option', { text: '未指定' });
  none.value = ''; none.selected = !value; select.append(none);
  if (value && !imageAssetInfo(value)) {
    const missing = el('option', { text: '参照先ファイルなし（未登録）' });
    missing.value = value; missing.selected = true; select.append(missing);
  }
  illustrationAssetKeys().forEach((key) => {
    const asset = imageAssetInfo(key);
    const option = el('option', { text: asset?.fileName ?? key });
    option.value = key; option.selected = value === key; select.append(option);
  });
  wrap.append(select);
  return wrap;
}

function audioAssetField(label, value, keys, dataset, kind) {
  const wrap = el('div', { className: 'field audio-asset-field' });
  wrap.append(el('label', { text: label }));
  const select = el('select');
  Object.assign(select.dataset, dataset);
  const none = el('option', { text: 'None（再生しない）' });
  none.value = ''; none.selected = !value; select.append(none);
  keys.forEach((key) => {
    const option = el('option', { text: audioFileName(key) });
    option.value = key; option.selected = value === key; select.append(option);
  });
  const uploadLabel = el('label', {
    className: 'audio-asset-field__upload-label',
    text: 'ローカルPCから音素材を追加',
  });
  const upload = el('input');
  upload.type = 'file';
  upload.accept = 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,.mp3,.wav,.ogg,.m4a,.aac';
  upload.dataset.sceneAudioUpload = 'true';
  upload.dataset.transitionIndex = dataset.transitionIndex;
  upload.dataset.audioTargetField = dataset.soundField;
  upload.dataset.audioKind = kind;
  wrap.append(select, uploadLabel, upload);
  return wrap;
}

function audioNumberField(label, value, min, max, step, dataset, suffix) {
  const wrap = el('div', { className: 'field audio-number-field' });
  wrap.append(el('label', { text: label }));
  const controls = el('div', { className: 'audio-number-field__controls' });
  const range = el('input');
  range.type = 'range'; range.min = String(min); range.max = String(max); range.step = String(step);
  range.value = String(value); Object.assign(range.dataset, dataset);
  const number = el('input');
  number.type = 'number'; number.min = String(min); number.max = String(max); number.step = String(step);
  number.value = String(value); Object.assign(number.dataset, dataset);
  controls.append(range, number, el('span', { text: suffix }));
  wrap.append(controls);
  return wrap;
}

function renderAudioSettings(scene, transitionIndex) {
  const sound = scene.soundAsset;
  const section = el('section', { className: 'scene-config-card__audio-settings' });
  section.append(el('h4', { text: 'BGM / SE' }));
  const grid = el('div', { className: 'audio-settings-grid' });
  const data = (soundField) => ({ soundField, transitionIndex });
  const loop = el('label', { className: 'audio-loop-field' });
  const loopInput = el('input');
  loopInput.type = 'checkbox'; loopInput.checked = sound.bgm.loop; Object.assign(loopInput.dataset, data('bgm.loop'));
  loop.append(loopInput, el('span', { text: 'BGMをループ再生' }));
  grid.append(
    audioAssetField('開始時BGM', sound.bgm.assetKey, audioAssetKeys('bgm'), data('bgm.assetKey'), 'bgm'),
    loop,
    audioNumberField('BGM音量', sound.bgm.volume, 0, 100, 1, data('bgm.volume'), '%'),
    audioNumberField('クロスフェード', sound.bgm.fadeMs, 0, 10000, 100, data('bgm.fadeMs'), 'ms'),
    audioAssetField('開始時SE', sound.se.startAssetKey, audioAssetKeys('se'), data('se.startAssetKey'), 'se'),
    audioAssetField('選択・アクション時SE', sound.se.actionAssetKey, audioAssetKeys('se'), data('se.actionAssetKey'), 'se'),
    audioNumberField('SE音量', sound.se.volume, 0, 100, 1, data('se.volume'), '%'),
  );
  section.append(grid);
  return section;
}

function renderTabs() {
  tabs.replaceChildren();
  const definitions = [
    { type: 'intro', label: 'イントロダクション' },
    ...config.questionScenes.map((scene, index) => ({ type: 'question', index, label: scene.label })),
    { type: 'result', label: '結果・サマリー' },
    { type: 'assets', label: 'アセット管理' },
  ];
  definitions.forEach((definition) => {
    const selected = definition.type === activeTab.type &&
      (definition.type !== 'question' || definition.index === activeTab.index);
    const tab = el('button', {
      type: 'button',
      text: definition.label,
      className: `config-tab${selected ? ' is-active' : ''}`,
    });
    tab.role = 'tab';
    tab.setAttribute('aria-selected', String(selected));
    tab.dataset.tabType = definition.type;
    if (definition.index !== undefined) tab.dataset.tabIndex = definition.index;
    tabs.append(tab);
  });
}

function renderQuestionSceneActions() {
  questionSceneActions.replaceChildren();
  questionSceneActions.hidden = activeTab.type !== 'question';
  if (activeTab.type !== 'question') return;

  const add = button('＋ シーンを追加', 'question-add', 'button--primary');
  const duplicate = button('シーンを複製', 'question-duplicate');
  const remove = button('シーン削除', 'question-delete', 'button--danger');
  remove.disabled = config.questionScenes.length === 1;
  questionSceneActions.append(add, duplicate, remove);
}

function renderToolbar() {
  tabToolbar.replaceChildren();
  const title = el('div');
  title.append(
    el('strong', {
      text: activeTab.type === 'intro'
        ? 'Intro / Overall Timing'
        : activeTab.type === 'assets'
          ? 'Custom Asset Library'
        : activeTab.type === 'result'
          ? 'Summary & Result'
          : `Scene ${activeTab.index + 1}`,
    }),
    el('small', {
      text: activeTab.type === 'assets'
        ? '画像と音声をファイル名で登録し、複数の画面から再利用できます。'
        : '画面イベントを選択すると、カード下部の「＋」から直後へ追加できます。',
    }),
  );
  tabToolbar.append(title);
}

function renderHoldSetting(container) {
  const row = el('div', { className: 'timing-row timing-row--hold' });
  const label = el('label', { text: '選択ホールド時間' });
  label.append(el('small', { text: 'すべての設問シーンへ共通適用' }));
  const range = el('input');
  range.type = 'range'; range.min = '100'; range.max = '10000'; range.step = '100';
  range.value = config.choiceHoldDurationMs; range.dataset.holdDuration = 'true';
  const number = el('input');
  number.type = 'number'; number.min = '100'; number.max = '30000'; number.step = '100';
  number.value = config.choiceHoldDurationMs; number.dataset.holdDuration = 'true';
  const value = el('span', { className: 'seconds', text: seconds(config.choiceHoldDurationMs) });
  value.dataset.holdSeconds = 'true';
  row.append(label, range, number, value);
  container.append(row);
}

function renderTransitionCard(scene, index, container) {
  const selectedIndex = selectedTransitions.get(tabKey()) ?? 0;
  const card = el('article', {
    className: `scene-config-card${index === selectedIndex ? ' is-selected' : ''}`,
  });
  card.dataset.transitionIndex = index;
  const header = el('header', { className: 'scene-config-card__header' });
  const dragHandle = el('span', { className: 'scene-config-card__drag-handle', text: '⠿' });
  dragHandle.draggable = true;
  dragHandle.dataset.transitionDragHandle = 'true';
  dragHandle.dataset.transitionIndex = index;
  dragHandle.title = 'ドラッグして並び替え';
  dragHandle.setAttribute('role', 'button');
  dragHandle.setAttribute('tabindex', '0');
  dragHandle.setAttribute('aria-label', `${scene.label}をドラッグして並び替え`);
  const name = el('div', { className: 'scene-config-card__name' });
  name.append(el('strong', { text: `${index + 1}.` }));
  const nameInput = el('input');
  nameInput.type = 'text'; nameInput.value = scene.label; nameInput.placeholder = '画面イベント名';
  nameInput.dataset.transitionField = 'label'; nameInput.dataset.transitionIndex = index;
  name.append(nameInput);
  const actions = el('div', { className: 'scene-config-card__actions' });
  const remove = button('削除', 'transition-delete', 'button--small button--danger');
  remove.dataset.transitionIndex = index;
  if (
    activeTab.type === 'question' &&
    scene.behavior === 'stage_input' &&
    activeSequence().filter((item) => item.behavior === 'stage_input').length === 1
  ) {
    remove.disabled = true;
    remove.title = '設問画面は最低1つ必要です';
  }
  header.append(dragHandle, name, actions); actions.append(remove);

  const fields = el('div', { className: 'scene-config-card__fields' });
  fields.append(field('シーンID / ステート名', scene.id, { transitionField: 'id', transitionIndex: index }));
  const behaviorWrap = el('div', { className: 'field' });
  behaviorWrap.append(el('label', { text: '動作種別' }));
  const behavior = el('select');
  behavior.dataset.transitionField = 'behavior'; behavior.dataset.transitionIndex = index;
  BEHAVIORS.forEach(([value, text]) => {
    const option = el('option', { text }); option.value = value; option.selected = scene.behavior === value;
    behavior.append(option);
  });
  behaviorWrap.append(behavior); fields.append(behaviorWrap);

  const backgroundWrap = el('div', { className: 'field' });
  backgroundWrap.append(el('label', { text: '背景画像（ファイル名）' }));
  const background = el('select');
  background.dataset.transitionField = 'backgroundAssetKey'; background.dataset.transitionIndex = index;
  backgroundAssetKeys().forEach((key) => {
    const asset = imageAssetInfo(key);
    const option = el('option', { text: asset?.fileName ?? key });
    option.value = key; option.selected = scene.backgroundAssetKey === key; background.append(option);
  });
  backgroundWrap.append(background); fields.append(backgroundWrap);

  const uploadWrap = el('div', { className: 'field scene-upload' });
  uploadWrap.append(el('label', { text: 'ローカル背景画像' }));
  const upload = el('input');
  upload.type = 'file'; upload.accept = 'image/png,image/jpeg,image/webp,image/gif';
  upload.dataset.transitionUpload = 'true'; upload.dataset.transitionIndex = index;
  uploadWrap.append(upload, el('small', {
    className: 'scene-upload__status',
    text: scene.backgroundImageName ? `選択中: ${scene.backgroundImageName}` : '未選択',
  }));
  if (scene.backgroundImageSrc) {
    const clear = button('アップロード画像を解除', 'transition-upload-remove', 'button--small button--danger');
    clear.dataset.transitionIndex = index; uploadWrap.append(clear);
  }
  fields.append(uploadWrap);

  const duration = el('div', { className: 'field field--wide scene-duration' });
  duration.append(el('label', {
    text: scene.behavior === 'stage_input'
      ? '迷い度の基準時間（ms / 秒）'
      : '表示時間（ms / 秒）',
  }));
  if (scene.behavior === 'stage_input') {
    duration.append(el('small', {
      className: 'scene-duration__note',
      text: '入力が確定するまで次の画面へ進みません。この時間は迷い度の算出にのみ使用します。',
    }));
  } else {
    const advanceOnInput = el('label', { className: 'scene-advance-on-input' });
    const checkbox = el('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(scene.advanceOnInput);
    checkbox.dataset.transitionField = 'advanceOnInput';
    checkbox.dataset.transitionIndex = index;
    advanceOnInput.append(checkbox, el('span', { text: '矢印キー入力で次に進む' }));
    duration.append(advanceOnInput);
  }
  const controls = el('div', { className: 'scene-duration__controls' });
  const range = el('input');
  range.type = 'range'; range.min = '0'; range.max = '30000'; range.step = '100'; range.value = scene.durationMs;
  range.disabled = Boolean(scene.advanceOnInput);
  range.dataset.transitionField = 'durationMs'; range.dataset.transitionIndex = index;
  const number = el('input');
  number.type = 'number'; number.min = '0'; number.max = '300000'; number.step = '100'; number.value = scene.durationMs;
  number.disabled = Boolean(scene.advanceOnInput);
  number.dataset.transitionField = 'durationMs'; number.dataset.transitionIndex = index;
  const durationText = el('span', {
    className: 'seconds',
    text: scene.advanceOnInput ? '入力待ち' : seconds(scene.durationMs),
  });
  durationText.dataset.transitionSeconds = index;
  controls.append(range, number, durationText); duration.append(controls); fields.append(duration);
  fields.append(
    field('表示タイトル（任意）', scene.title, { transitionField: 'title', transitionIndex: index }, true),
    field('メッセージ本文（任意）', scene.message, { transitionField: 'message', transitionIndex: index }, true),
  );
  const insertArea = el('footer', { className: 'scene-config-card__insert' });
  const insert = button('＋', 'transition-add-after', 'scene-config-card__insert-button');
  insert.dataset.transitionIndex = index;
  insert.title = 'この画面イベントの直後に追加';
  insert.setAttribute('aria-label', `${scene.label}の直後に画面イベントを追加`);
  insertArea.append(insert);
  card.append(header, fields, renderAudioSettings(scene, index));
  renderTransitionStageSettings(card, scene, index);
  card.append(insertArea); container.append(card);
}

function renderSequenceSection(container, heading = '画面遷移・タイマー') {
  const section = el('section', { className: 'editor-section' });
  section.append(el('h3', { text: heading }));
  const list = el('div', { className: 'timing-editor' });
  activeSequence().forEach((scene, index) => renderTransitionCard(scene, index, list));
  if (!activeSequence().length) {
    const empty = el('div', { className: 'empty-state' });
    empty.append(el('p', { text: '画面イベントがありません。' }));
    const insert = button('＋', 'transition-add-after', 'scene-config-card__insert-button');
    insert.dataset.transitionIndex = '-1';
    insert.title = '最初の画面イベントを追加';
    insert.setAttribute('aria-label', '最初の画面イベントを追加');
    empty.append(insert);
    list.append(empty);
  }
  section.append(list); container.append(section);
}

function renderStageContent(container, content, stageIndex, variantIndex = null) {
  const data = (stageField) => ({ stageField, stageIndex, ...(variantIndex === null ? {} : { variantIndex }) });
  container.append(
    field('左：乗客ラベル', content.left.label, data('left.label')),
    field('右：乗客ラベル', content.right.label, data('right.label')),
  );
  if (['text_and_illustration', 'text_and_stats'].includes(content.infoLevel)) {
    container.append(
      imageAssetField('左：イラスト画像（ファイル名）', content.left.assetKey, data('left.assetKey')),
      imageAssetField('右：イラスト画像（ファイル名）', content.right.assetKey, data('right.assetKey')),
      illustrationUploadField('左：ローカル画像', content.left, 'left', stageIndex, variantIndex),
      illustrationUploadField('右：ローカル画像', content.right, 'right', stageIndex, variantIndex),
    );
  }
  if (content.infoLevel === 'text_and_stats') {
    container.append(
      percentageField('左の選択率', content.stats?.leftPercent, data('stats.leftPercent')),
      percentageField('右の選択率', content.stats?.rightPercent, data('stats.rightPercent')),
    );
  }
}

function illustrationUploadField(label, passenger, side, stageIndex, variantIndex) {
  const wrap = el('div', { className: 'field illustration-upload' });
  wrap.append(el('label', { text: label }));
  if (passenger.imageSrc) {
    const preview = el('img', { className: 'illustration-upload__preview' });
    preview.src = passenger.imageSrc;
    preview.alt = `${passenger.label}のアップロード画像`;
    wrap.append(preview);
  }
  const input = el('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp,image/gif';
  input.dataset.stageIllustrationUpload = 'true';
  input.dataset.stageIndex = stageIndex;
  input.dataset.passengerSide = side;
  if (variantIndex !== null) input.dataset.variantIndex = variantIndex;
  wrap.append(input, el('small', {
    className: 'scene-upload__status',
    text: passenger.imageName ? `選択中: ${passenger.imageName}` : '未選択（上で選択した画像を使用）',
  }));
  if (passenger.imageSrc) {
    const remove = button('アップロード画像を解除', 'stage-illustration-remove', 'button--small button--danger');
    remove.dataset.stageIndex = stageIndex;
    remove.dataset.passengerSide = side;
    if (variantIndex !== null) remove.dataset.variantIndex = variantIndex;
    wrap.append(remove);
  }
  return wrap;
}

function stageContentFromDataset(dataset) {
  const questionScene = activeQuestionScene();
  const stage = questionScene?.questionSet.stages[Number(dataset.stageIndex)];
  if (!stage) return null;
  return dataset.variantIndex === undefined
    ? stage
    : stage.variants?.[Number(dataset.variantIndex)] ?? null;
}

function visitStageContents(visitor) {
  config.questionScenes.forEach((questionScene) => {
    questionScene.questionSet.stages.forEach((stage) => {
      if (Array.isArray(stage.variants)) stage.variants.forEach(visitor);
      else visitor(stage);
    });
  });
}

function clearCustomAssetReferences(type, key) {
  let count = 0;
  if (type === 'image') {
    visitStageContents((content) => {
      ['left', 'right'].forEach((side) => {
        if (content?.[side]?.assetKey === key) {
          content[side].assetKey = '';
          count += 1;
        }
      });
    });
    [config.introduction.sequence, ...config.questionScenes.map((scene) => scene.sequence), config.result.sequence]
      .flat()
      .forEach((scene) => {
        if (scene.backgroundAssetKey === key) {
          scene.backgroundAssetKey = 'train_far_full';
          count += 1;
        }
      });
  } else {
    [config.introduction.sequence, ...config.questionScenes.map((scene) => scene.sequence), config.result.sequence]
      .flat()
      .forEach((scene) => {
        const sound = scene.soundAsset;
        ['assetKey'].forEach((field) => {
          if (sound?.bgm?.[field] === key) { sound.bgm[field] = ''; count += 1; }
        });
        ['startAssetKey', 'actionAssetKey'].forEach((field) => {
          if (sound?.se?.[field] === key) { sound.se[field] = ''; count += 1; }
        });
      });
  }
  return count;
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('ファイルを読み込めませんでした。')));
    reader.readAsDataURL(file);
  });
}

function createUniqueAssetKey(type, fileName = '') {
  const baseName = fileName.replace(/\.[^.]+$/, '').toLowerCase();
  const sanitized = baseName
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = sanitized || `custom_${type}`;
  let key = base;
  let suffix = 2;
  const exists = (candidate) => Boolean(
    ASSET_MANIFEST[candidate] || AUDIO_MANIFEST[candidate] ||
    customImages()[candidate] || customAudio()[candidate]
  );
  while (exists(key)) key = `${base}_${suffix++}`;
  return key;
}

function renderTransitionStageSettings(card, scene, transitionIndex) {
  if (activeTab.type !== 'question' || scene.behavior !== 'stage_input') return;
  const questionScene = activeQuestionScene();
  const stageIndex = stageIndexForTransition(transitionIndex);
  const stage = questionScene?.questionSet.stages[stageIndex];
  if (!stage) return;

  const settings = el('section', { className: 'scene-config-card__question-settings' });
  settings.append(el('h4', { text: '設問・提示情報' }));
  const presentation = el('div', { className: 'presentation-type-setting' });
  presentation.append(el('label', { text: '提示情報タイプ' }));
  const presentationSelect = el('select');
  presentationSelect.dataset.stageField = 'stagePresentation';
  presentationSelect.dataset.stageIndex = stageIndex;
  const selectedType = Array.isArray(stage.variants)
    ? stage.presentationType ?? 'random'
    : stage.infoLevel ?? 'text_only';
  PRESENTATION_TYPES.forEach(([value, text]) => {
    const option = el('option', { text });
    option.value = value;
    option.selected = selectedType === value;
    presentationSelect.append(option);
  });
  presentation.append(presentationSelect);
  settings.append(presentation);

  if (Array.isArray(stage.variants)) {
    const visibleVariants = selectedType === 'text_and_illustration'
      ? stage.variants.filter((variant) => variant.infoLevel === 'text_and_illustration')
      : selectedType === 'text_and_stats'
        ? stage.variants.filter((variant) => variant.infoLevel === 'text_and_stats')
        : stage.variants;
    visibleVariants.forEach((variant) => {
      const variantIndex = stage.variants.indexOf(variant);
      const variantBlock = el('section', { className: 'variant-block' });
      const variantFields = el('div', { className: 'stage-fields' });
      renderStageContent(variantFields, variant, stageIndex, variantIndex);
      variantBlock.append(el('h4', { text: variant.label }), variantFields);
      settings.append(variantBlock);
    });
  } else {
    const stageFields = el('div', { className: 'stage-fields' });
    renderStageContent(stageFields, stage, stageIndex);
    settings.append(stageFields);
  }
  card.append(settings);
}

function renderDiagnosis(container) {
  const section = el('section', { className: 'editor-section' });
  section.append(el('h3', { text: '総合診断テキスト' }));
  const labels = { empty: 'データなし', intuitive: '直感派', balanced: 'バランス派', thoughtful: '熟考派' };
  Object.entries(config.result.diagnosis).forEach(([key, diagnosis]) => {
    const block = el('div', { className: 'diagnosis-editor' });
    block.append(
      el('h4', { text: labels[key] }),
      field('診断タイトル', diagnosis.title, { diagnosisKey: key, diagnosisField: 'title' }),
      field('診断本文', diagnosis.message, { diagnosisKey: key, diagnosisField: 'message' }, true),
    );
    section.append(block);
  });
  container.append(section);
}

function assetRegistrationForm(type) {
  const isImage = type === 'image';
  const form = el('section', { className: 'asset-registration' });
  form.dataset.assetRegistration = type;
  form.append(el('h4', { text: isImage ? '画像アセットを登録' : '音声アセットを登録' }));
  const grid = el('div', { className: 'asset-registration__grid' });
  if (!isImage) {
    const kindWrap = el('div', { className: 'field' });
    kindWrap.append(el('label', { text: '音声種別' }));
    const kind = el('select');
    kind.dataset.assetRegistrationField = 'kind';
    kind.dataset.assetRegistrationType = type;
    [['bgm', 'BGM'], ['se', 'SE（効果音）']].forEach(([value, text]) => {
      const option = el('option', { text }); option.value = value; kind.append(option);
    });
    kindWrap.append(kind); grid.append(kindWrap);
  }
  const fileWrap = el('div', { className: 'field asset-registration__file' });
  fileWrap.append(el('label', { text: isImage ? '画像ファイル' : '音声ファイル' }));
  const file = el('input');
  file.type = 'file';
  file.accept = isImage
    ? 'image/png,image/jpeg,image/webp,image/gif'
    : 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,.mp3,.wav,.ogg,.m4a,.aac';
  file.dataset.assetRegistrationField = 'file';
  file.dataset.assetRegistrationType = type;
  fileWrap.append(file); grid.append(fileWrap);
  const register = button(isImage ? '画像を登録' : '音声を登録', `asset-register-${type}`, 'button--primary');
  form.append(grid, register);
  return form;
}

function renderAssetLibrary(container) {
  const intro = el('section', { className: 'editor-section asset-library-intro' });
  intro.append(
    el('h3', { text: 'カスタムアセットライブラリ' }),
    el('p', { text: '管理画面ではすべてファイル名で管理します。ファイルを選ぶだけで登録でき、複数の画面から再利用できます。' }),
    el('p', { text: '内部参照IDは自動生成され、登録ファイルはBase64形式でブラウザ保存・JSON Exportされます。' }),
  );
  const forms = el('div', { className: 'asset-registration-list' });
  forms.append(assetRegistrationForm('image'), assetRegistrationForm('audio'));
  intro.append(forms); container.append(intro);

  const listSection = el('section', { className: 'editor-section' });
  listSection.append(el('h3', { text: '登録済みアセット' }));
  const list = el('div', { className: 'custom-asset-list' });
  const entries = [
    ...Object.entries(customImages()).map(([key, asset]) => ({ key, asset, type: 'image' })),
    ...Object.entries(customAudio()).map(([key, asset]) => ({ key, asset, type: 'audio' })),
  ];
  entries.forEach(({ key, asset, type }) => {
    const card = el('article', { className: 'custom-asset-card' });
    const media = el('div', { className: 'custom-asset-card__media' });
    if (type === 'image') {
      const preview = el('img'); preview.src = asset.src; preview.alt = asset.fileName; media.append(preview);
    } else {
      const preview = el('audio'); preview.src = asset.src; preview.controls = true; preview.preload = 'metadata'; media.append(preview);
    }
    const details = el('div', { className: 'custom-asset-card__details' });
    details.append(
      el('strong', { text: asset.fileName || 'ファイル名なし' }),
      el('small', { text: type === 'image' ? '画像' : asset.kind.toUpperCase() }),
    );
    const remove = button('削除', 'asset-delete', 'button--danger button--small');
    remove.dataset.customAssetType = type;
    remove.dataset.customAssetKey = key;
    card.append(media, details, remove); list.append(card);
  });
  if (!entries.length) list.append(el('p', { className: 'empty-state', text: 'カスタムアセットはまだ登録されていません。' }));
  listSection.append(list); container.append(listSection);
}

function renderEditor() {
  tabEditor.replaceChildren();
  if (activeTab.type === 'intro') {
    renderHoldSetting(tabEditor);
    renderSequenceSection(tabEditor, 'イントロダクション画面');
  } else if (activeTab.type === 'assets') {
    renderAssetLibrary(tabEditor);
  } else if (activeTab.type === 'result') {
    renderSequenceSection(tabEditor, '結果・終了画面');
    renderDiagnosis(tabEditor);
  } else {
    const questionScene = config.questionScenes[activeTab.index];
    const meta = el('section', { className: 'editor-section scene-package-meta' });
    meta.append(el('h3', { text: 'シーン基本情報' }));
    const fields = el('div', { className: 'stage-fields' });
    fields.append(
      field('シーンID', questionScene.id, { questionField: 'id' }),
      field('タブ名 / シーン名', questionScene.label, { questionField: 'label' }),
    );
    meta.append(fields); tabEditor.append(meta);
    renderSequenceSection(tabEditor, '画面イベント');
  }
}

function renderTimeline() {
  timeline.replaceChildren();
  const attract = el('button', { type: 'button', className: 'timeline__item' });
  attract.dataset.state = 'ATTRACT'; attract.dataset.startSceneId = '';
  attract.title = 'ATTRACTからプレビューを開始';
  attract.append(el('strong', { text: 'ATTRACT' }), el('span', { text: '操作待ち' }));
  timeline.append(attract);
  buildRuntimeConfig(config).sceneSequence.forEach((scene, index) => {
    const item = el('button', { type: 'button', className: 'timeline__item' });
    item.dataset.state = scene.id; item.dataset.sceneIndex = index; item.dataset.startSceneId = scene.id;
    item.title = `${scene.label || scene.id}からプレビューを開始`;
    item.append(
      el('strong', { text: scene.label || scene.id }),
      el('span', {
        text: scene.behavior === 'stage_input' || scene.advanceOnInput
          ? '入力待ち'
          : seconds(scene.durationMs),
      }),
    );
    timeline.append(item);
  });
  scheduleLivePreview();
}

function renderAll() {
  renderTabs(); renderQuestionSceneActions(); renderToolbar(); renderEditor(); renderTimeline();
}

function normalizeAndRender() {
  config = normalizeAppConfig(config);
  clearPlaceholderAudioReferences();
  synchronizeAllQuestionStages();
  if (activeTab.type === 'question') activeTab.index = Math.min(activeTab.index, config.questionScenes.length - 1);
  renderAll();
}

function createTransition(behavior = 'timed', label = '追加画面') {
  const suffix = Date.now().toString(36).toUpperCase();
  return {
    id: `CUSTOM_${suffix}`,
    behavior,
    advanceOnInput: false,
    label,
    durationMs: behavior === 'stage_input' ? 12000 : 2000,
    backgroundAssetKey: behavior === 'stage_input' ? 'train_close_full' : 'train_far_full',
    backgroundImageName: '', backgroundImageSrc: '', title: '', message: '',
    soundAsset: {
      bgm: { assetKey: '', loop: true, volume: 70, fadeMs: 800 },
      se: { startAssetKey: '', actionAssetKey: '', volume: 80 },
    },
  };
}

tabs.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab-type]');
  if (!tab) return;
  activeTab = { type: tab.dataset.tabType, index: Number(tab.dataset.tabIndex ?? 0) };
  renderAll();
});

questionSceneActions.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'question-add') {
    const template = getDefaultConfig().questionScenes[0];
    const index = activeTab.type === 'question' ? activeTab.index + 1 : config.questionScenes.length;
    template.id = `question_scene_${String(config.questionScenes.length + 1).padStart(2, '0')}`;
    template.label = `シーン ${config.questionScenes.length + 1}`;
    template.questionSet.id = `question_set_${config.questionScenes.length + 1}`;
    template.questionSet.label = `設問セット ${config.questionScenes.length + 1}`;
    template.sequence.forEach((scene, stageIndex) => {
      scene.id = `SCENE_${config.questionScenes.length + 1}_STAGE_${stageIndex + 1}_INPUT`;
    });
    config.questionScenes.splice(index, 0, template); activeTab = { type: 'question', index };
  } else if (activeTab.type === 'question') {
    const index = activeTab.index;
    if (action === 'question-up' && index > 0) {
      [config.questionScenes[index - 1], config.questionScenes[index]] = [config.questionScenes[index], config.questionScenes[index - 1]];
      activeTab.index -= 1;
    } else if (action === 'question-down' && index < config.questionScenes.length - 1) {
      [config.questionScenes[index + 1], config.questionScenes[index]] = [config.questionScenes[index], config.questionScenes[index + 1]];
      activeTab.index += 1;
    } else if (action === 'question-duplicate') {
      const copy = JSON.parse(JSON.stringify(config.questionScenes[index]));
      copy.id += '_copy'; copy.label += '（複製）'; copy.questionSet.id += '_copy';
      copy.sequence.forEach((scene) => { scene.id += '_COPY'; });
      config.questionScenes.splice(index + 1, 0, copy); activeTab.index += 1;
    } else if (action === 'question-delete' && config.questionScenes.length > 1) {
      config.questionScenes.splice(index, 1); activeTab.index = Math.min(index, config.questionScenes.length - 1);
    }
  }
  normalizeAndRender();
});

tabEditor.addEventListener('input', (event) => {
  const input = event.target;
  if (input.dataset.customAssetField) {
    const collection = input.dataset.customAssetType === 'image' ? customImages() : customAudio();
    const asset = collection[input.dataset.customAssetKey];
    if (asset) asset[input.dataset.customAssetField] = input.value;
    scheduleLivePreview();
    return;
  }
  if (input.dataset.holdDuration) {
    config.choiceHoldDurationMs = Math.max(100, Number(input.value) || 100);
    tabEditor.querySelectorAll('[data-hold-duration]').forEach((peer) => { if (peer !== input) peer.value = config.choiceHoldDurationMs; });
    tabEditor.querySelector('[data-hold-seconds]').textContent = seconds(config.choiceHoldDurationMs);
    scheduleLivePreview();
    return;
  }
  if (input.dataset.soundField) {
    const scene = activeSequence()[Number(input.dataset.transitionIndex)];
    if (!scene) return;
    const [group, key] = input.dataset.soundField.split('.');
    const numeric = ['volume', 'fadeMs'].includes(key);
    const value = input.type === 'checkbox'
      ? input.checked
      : numeric
        ? Math.max(0, Number(input.value) || 0)
        : input.value;
    scene.soundAsset[group][key] = value;
    if (numeric) {
      tabEditor.querySelectorAll(
        `[data-transition-index="${input.dataset.transitionIndex}"][data-sound-field="${input.dataset.soundField}"]`,
      ).forEach((peer) => { if (peer !== input) peer.value = String(value); });
    }
    scheduleLivePreview();
    return;
  }
  if (input.dataset.transitionField !== undefined) {
    const index = Number(input.dataset.transitionIndex);
    const scene = activeSequence()[index];
    if (!scene) return;
    const key = input.dataset.transitionField;
    const previousBehavior = scene.behavior;
    if (key === 'behavior' && activeTab.type === 'question' && previousBehavior !== input.value) {
      const questionScene = activeQuestionScene();
      const stageIndex = stageIndexForTransition(index);
      if (previousBehavior === 'stage_input') {
        if (activeSequence().filter((item) => item.behavior === 'stage_input').length === 1) {
          input.value = previousBehavior;
          announce('設問画面は最低1つ必要です。', true);
          return;
        }
        questionScene.questionSet.stages.splice(stageIndex, 1);
      } else if (input.value === 'stage_input') {
        questionScene.questionSet.stages.splice(stageIndex, 0, createStageConfig(stageIndex));
      }
      renumberStages(questionScene);
    }
    scene[key] = key === 'durationMs'
      ? Math.max(0, Number(input.value) || 0)
      : input.type === 'checkbox'
        ? input.checked
        : input.value;
    if (key === 'behavior' && scene.behavior === 'stage_input') scene.advanceOnInput = false;
    if (key === 'backgroundAssetKey') { scene.backgroundImageName = ''; scene.backgroundImageSrc = ''; renderEditor(); }
    if (key === 'durationMs') {
      tabEditor.querySelectorAll(`[data-transition-index="${index}"][data-transition-field="durationMs"]`).forEach((peer) => { if (peer !== input) peer.value = scene.durationMs; });
      tabEditor.querySelector(`[data-transition-seconds="${index}"]`).textContent = seconds(scene.durationMs);
    }
    if (key === 'behavior' || key === 'advanceOnInput') renderEditor();
    renderTimeline(); return;
  }
  if (activeTab.type !== 'question' && !input.dataset.diagnosisKey) return;
  const questionScene = config.questionScenes[activeTab.index];
  if (input.dataset.questionField) {
    const key = input.dataset.questionField;
    if (key.startsWith('questionSet.')) questionScene.questionSet[key.split('.')[1]] = input.value;
    else questionScene[key] = input.value;
    if (key === 'label') renderTabs();
    scheduleLivePreview();
    return;
  }
  if (input.dataset.stageField) {
    const stage = questionScene.questionSet.stages[Number(input.dataset.stageIndex)];
    const content = input.dataset.variantIndex === undefined ? stage : stage.variants?.[Number(input.dataset.variantIndex)];
    if (!content) return;
    const key = input.dataset.stageField;
    if (key === 'stagePresentation') {
      setStagePresentation(questionScene, Number(input.dataset.stageIndex), input.value);
      renderEditor(); scheduleLivePreview(); return;
    } else if (key === 'presentationType') {
      stage.presentationType = input.value;
      renderEditor(); scheduleLivePreview(); return;
    } else if (key === 'infoLevel') content.infoLevel = input.value;
    else if (key === 'variant.id') content.id = input.value;
    else if (key === 'variant.label') content.label = input.value;
    else { const [side, property] = key.split('.'); content[side][property] = input.value; }
    scheduleLivePreview();
    return;
  }
  if (input.dataset.diagnosisKey) {
    config.result.diagnosis[input.dataset.diagnosisKey][input.dataset.diagnosisField] = input.value;
    scheduleLivePreview();
  }
});

function clearTransitionDragIndicators() {
  tabEditor.querySelectorAll('.scene-config-card').forEach((card) => {
    card.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
  });
  document.body.classList.remove('is-transition-dragging');
}

function stopDragAutoScroll() {
  dragAutoScrollSpeed = 0;
  if (dragAutoScrollFrame !== null) cancelAnimationFrame(dragAutoScrollFrame);
  dragAutoScrollFrame = null;
}

function runDragAutoScroll() {
  if (!dragAutoScrollSpeed || draggedTransitionIndex === null) {
    dragAutoScrollFrame = null;
    return;
  }
  window.scrollBy(0, dragAutoScrollSpeed);
  dragAutoScrollFrame = requestAnimationFrame(runDragAutoScroll);
}

function updateDragAutoScroll(pointerY) {
  const viewportHeight = window.innerHeight;
  const edgeSize = Math.min(180, Math.max(100, viewportHeight * 0.18));
  const maximumSpeed = 30;
  let nextSpeed = 0;
  if (pointerY < edgeSize) {
    nextSpeed = -maximumSpeed * (1 - Math.max(0, pointerY) / edgeSize);
  } else if (pointerY > viewportHeight - edgeSize) {
    nextSpeed = maximumSpeed * (1 - Math.max(0, viewportHeight - pointerY) / edgeSize);
  }
  dragAutoScrollSpeed = Math.round(nextSpeed);
  if (dragAutoScrollSpeed && dragAutoScrollFrame === null) {
    dragAutoScrollFrame = requestAnimationFrame(runDragAutoScroll);
  } else if (!dragAutoScrollSpeed) {
    stopDragAutoScroll();
  }
}

tabEditor.addEventListener('dragstart', (event) => {
  const handle = event.target.closest('[data-transition-drag-handle]');
  if (!handle) return;
  draggedTransitionIndex = Number(handle.dataset.transitionIndex);
  draggedTransitionTabKey = tabKey();
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(draggedTransitionIndex));
  handle.closest('.scene-config-card')?.classList.add('is-dragging');
  document.body.classList.add('is-transition-dragging');
});

document.addEventListener('dragover', (event) => {
  if (draggedTransitionIndex === null) return;
  updateDragAutoScroll(event.clientY);
});

tabEditor.addEventListener('dragover', (event) => {
  if (draggedTransitionIndex === null || draggedTransitionTabKey !== tabKey()) return;
  const card = event.target.closest('.scene-config-card');
  if (!card) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const rectangle = card.getBoundingClientRect();
  const dropAfter = event.clientY >= rectangle.top + rectangle.height / 2;
  tabEditor.querySelectorAll('.scene-config-card').forEach((item) => {
    item.classList.remove('is-drop-before', 'is-drop-after');
  });
  card.classList.add(dropAfter ? 'is-drop-after' : 'is-drop-before');
});

tabEditor.addEventListener('drop', (event) => {
  const card = event.target.closest('.scene-config-card');
  if (draggedTransitionIndex === null || draggedTransitionTabKey !== tabKey() || !card) return;
  event.preventDefault();
  const sourceIndex = draggedTransitionIndex;
  const targetIndex = Number(card.dataset.transitionIndex);
  const rectangle = card.getBoundingClientRect();
  const dropAfter = event.clientY >= rectangle.top + rectangle.height / 2;
  const sequence = activeSequence();
  const questionScene = activeQuestionScene();
  const sourceStageIndex = stageIndexForTransition(sourceIndex, sequence);
  const movedStage = questionScene && sequence[sourceIndex]?.behavior === 'stage_input'
    ? questionScene.questionSet.stages.splice(sourceStageIndex, 1)[0]
    : null;
  let insertIndex = targetIndex + (dropAfter ? 1 : 0);
  const [moved] = sequence.splice(sourceIndex, 1);
  if (sourceIndex < insertIndex) insertIndex -= 1;
  insertIndex = Math.max(0, Math.min(insertIndex, sequence.length));
  sequence.splice(insertIndex, 0, moved);
  if (movedStage && questionScene) {
    const targetStageIndex = stageIndexForTransition(insertIndex, sequence);
    questionScene.questionSet.stages.splice(targetStageIndex, 0, movedStage);
    renumberStages(questionScene);
  }
  selectedTransitions.set(tabKey(), insertIndex);
  draggedTransitionIndex = null;
  draggedTransitionTabKey = '';
  stopDragAutoScroll();
  clearTransitionDragIndicators();
  normalizeAndRender();
});

tabEditor.addEventListener('dragend', () => {
  draggedTransitionIndex = null;
  draggedTransitionTabKey = '';
  stopDragAutoScroll();
  clearTransitionDragIndicators();
});

document.addEventListener('drop', () => {
  stopDragAutoScroll();
  if (draggedTransitionIndex !== null) {
    draggedTransitionIndex = null;
    draggedTransitionTabKey = '';
    clearTransitionDragIndicators();
  }
});

tabEditor.addEventListener('click', (event) => {
  const transitionCard = event.target.closest('.scene-config-card');
  if (transitionCard) {
    const selectedIndex = Number(transitionCard.dataset.transitionIndex);
    selectedTransitions.set(tabKey(), selectedIndex);
    tabEditor.querySelectorAll('.scene-config-card').forEach((card) => {
      card.classList.toggle('is-selected', Number(card.dataset.transitionIndex) === selectedIndex);
    });
  }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === 'asset-register-image' || action === 'asset-register-audio') {
    const type = action.endsWith('image') ? 'image' : 'audio';
    const form = actionButton.closest('[data-asset-registration]');
    const value = (fieldName) => form?.querySelector(`[data-asset-registration-field="${fieldName}"]`)?.value ?? '';
    const kind = value('kind') || 'bgm';
    const file = form?.querySelector('[data-asset-registration-field="file"]')?.files?.[0];
    const validFile = type === 'image'
      ? file?.type.startsWith('image/')
      : file && (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name));
    if (!validFile) {
      announce(type === 'image' ? '画像ファイルを選択してください。' : '音声ファイルを選択してください。', true); return;
    }
    const key = createUniqueAssetKey(type, file.name);
    actionButton.disabled = true;
    fileAsDataUrl(file).then((src) => {
      if (type === 'image') {
        config.customAssets.images[key] = { type: 'image', fileName: file.name, src };
      } else {
        config.customAssets.audio[key] = { kind, fileName: file.name, src };
      }
      renderAll();
      announce(
        file.size > 2_500_000
          ? `${file.name}を登録しました。容量が大きいため、保存にはJSON Exportを推奨します。`
          : `${file.name}を登録しました。JSON Exportにも含まれます。`,
      );
    }).catch((error) => announce(`ファイルを読み込めませんでした: ${error.message}`, true));
    return;
  }
  if (action === 'asset-delete') {
    const type = actionButton.dataset.customAssetType;
    const key = actionButton.dataset.customAssetKey;
    const asset = type === 'image' ? customImages()[key] : customAudio()[key];
    const fileName = asset?.fileName || 'このファイル';
    if (!window.confirm(`「${fileName}」を削除しますか？使用中の設定からも解除されます。`)) return;
    const referenceCount = clearCustomAssetReferences(type, key);
    if (type === 'image') delete config.customAssets.images[key];
    else delete config.customAssets.audio[key];
    normalizeAndRender();
    announce(`「${fileName}」を削除し、${referenceCount}件の参照を解除しました。`);
    return;
  }
  if (action.startsWith('transition-')) {
    const sequence = activeSequence(); const index = Number(actionButton.dataset.transitionIndex);
    if (action === 'transition-add-after') {
      const insertIndex = Math.min(sequence.length, index + 1);
      sequence.splice(insertIndex, 0, createTransition());
      selectedTransitions.set(tabKey(), insertIndex);
    } else if (action === 'transition-delete') {
      if (activeTab.type === 'question' && sequence[index]?.behavior === 'stage_input') {
        const questionScene = activeQuestionScene();
        questionScene.questionSet.stages.splice(stageIndexForTransition(index, sequence), 1);
        renumberStages(questionScene);
      }
      sequence.splice(index, 1);
    }
    else if (action === 'transition-upload-remove' && sequence[index]) { sequence[index].backgroundImageName = ''; sequence[index].backgroundImageSrc = ''; }
    if (action !== 'transition-add-after') selectedTransitions.set(tabKey(), Math.min(index, sequence.length - 1));
    normalizeAndRender(); return;
  }
  if (action === 'stage-illustration-remove') {
    const content = stageContentFromDataset(actionButton.dataset);
    const passenger = content?.[actionButton.dataset.passengerSide];
    if (!passenger) return;
    delete passenger.imageName;
    delete passenger.imageSrc;
    renderEditor();
    scheduleLivePreview();
  }
});

tabEditor.addEventListener('change', (event) => {
  const input = event.target;
  if (input.dataset.sceneAudioUpload) {
    const scene = activeSequence()[Number(input.dataset.transitionIndex)];
    const file = input.files?.[0];
    const validFile = file && (
      file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name)
    );
    if (!scene || !validFile) {
      announce('対応する音声ファイルを選択してください。', true);
      return;
    }
    const key = createUniqueAssetKey('audio', file.name);
    const [group, field] = input.dataset.audioTargetField.split('.');
    fileAsDataUrl(file).then((src) => {
      config.customAssets.audio[key] = {
        kind: input.dataset.audioKind === 'bgm' ? 'bgm' : 'se',
        fileName: file.name,
        src,
      };
      scene.soundAsset[group][field] = key;
      renderEditor();
      scheduleLivePreview();
      announce(
        file.size > 2_500_000
          ? `${file.name}を登録・設定しました。容量が大きいため、保存にはJSON Exportを推奨します。`
          : `${file.name}を登録し、この画面イベントへ設定しました。`,
      );
    }).catch((error) => announce(`音声ファイルを読み込めませんでした: ${error.message}`, true));
    return;
  }
  if (input.dataset.stageIllustrationUpload) {
    const content = stageContentFromDataset(input.dataset);
    const passenger = content?.[input.dataset.passengerSide];
    const file = input.files?.[0];
    if (!passenger || !file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      passenger.imageName = file.name;
      passenger.imageSrc = String(reader.result);
      renderEditor();
      scheduleLivePreview();
      announce(
        file.size > 2_500_000
          ? `${file.name} を取り込みました。容量が大きいためブラウザ保存上限にご注意ください。`
          : `${file.name} を人物イラストとして取り込みました。`,
      );
    });
    reader.addEventListener('error', () => announce('イラスト画像を読み込めませんでした。', true));
    reader.readAsDataURL(file);
    return;
  }
  if (!input.dataset.transitionUpload) return;
  const scene = activeSequence()[Number(input.dataset.transitionIndex)];
  const file = input.files?.[0];
  if (!scene || !file?.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    scene.backgroundImageName = file.name; scene.backgroundImageSrc = String(reader.result);
    renderEditor(); scheduleLivePreview(); announce(`${file.name} を背景画像として取り込みました。`);
  });
  reader.addEventListener('error', () => announce('画像ファイルを読み込めませんでした。', true));
  reader.readAsDataURL(file);
});

function resolvedPreviewStartSceneId(fromCurrentTab) {
  if (previewStartSceneId !== null) return previewStartSceneId;
  return fromCurrentTab ? activeStartSceneId() : '';
}

function preparePreview(fromCurrentTab) {
  config = normalizeAppConfig(config);
  const url = new URL('./index.html', window.location.href);
  url.searchParams.set('preview', '1'); url.searchParams.set('run', Date.now());
  const startSceneId = resolvedPreviewStartSceneId(fromCurrentTab);
  if (startSceneId) url.searchParams.set('startSceneId', startSceneId);
  return url.href;
}

function sendPreviewConfig(targetWindow, fromCurrentTab) {
  if (!targetWindow) return;
  config = normalizeAppConfig(config);
  targetWindow.postMessage({
    type: 'rocking-train-preview-config',
    config,
    startSceneId: resolvedPreviewStartSceneId(fromCurrentTab),
    muted: previewMuted,
  }, window.location.origin === 'null' ? '*' : window.location.origin);
}

function scheduleLivePreview() {
  if (!previewHasRun) return;
  clearTimeout(previewRefreshTimer);
  previewRefreshTimer = setTimeout(() => {
    previewFrame.src = preparePreview(previewFromCurrentTab);
  }, 500);
}

document.querySelector('#run-preview').addEventListener('click', () => {
  previewHasRun = true; previewFromCurrentTab = true; previewStartSceneId = null;
  previewFrame.src = preparePreview(true); previewPlaceholder.hidden = true;
  announce('選択中の画面イベントからプレビューを開始しました。');
});
document.querySelector('#run-preview-all').addEventListener('click', () => {
  previewHasRun = true; previewFromCurrentTab = false; previewStartSceneId = null;
  previewFrame.src = preparePreview(false); previewPlaceholder.hidden = true;
  announce('イントロからプレビューを開始しました。');
});
timeline.addEventListener('click', (event) => {
  const item = event.target.closest('[data-start-scene-id]');
  if (!item) return;
  previewHasRun = true;
  previewFromCurrentTab = false;
  previewStartSceneId = item.dataset.startSceneId;
  previewFrame.src = preparePreview(false);
  previewPlaceholder.hidden = true;
  timeline.querySelectorAll('.timeline__item').forEach((candidate) => {
    candidate.classList.toggle('is-active', candidate === item);
  });
  announce(`${item.querySelector('strong')?.textContent ?? '選択画面'}からプレビューを開始しました。`);
});
document.querySelector('#open-preview').addEventListener('click', () => {
  externalPreviewFromCurrentTab = previewFromCurrentTab;
  externalPreviewWindow = window.open(
    preparePreview(externalPreviewFromCurrentTab),
    'rocking-train-preview',
    'width=1280,height=800',
  );
});
document.querySelector('#toggle-preview-audio').addEventListener('click', (event) => {
  previewMuted = !previewMuted;
  event.currentTarget.textContent = previewMuted ? '音声：OFF' : '音声：ON';
  event.currentTarget.setAttribute('aria-pressed', String(previewMuted));
  const message = { type: 'rocking-train-preview-audio-mute', muted: previewMuted };
  const origin = window.location.origin === 'null' ? '*' : window.location.origin;
  previewFrame.contentWindow?.postMessage(message, origin);
  if (externalPreviewWindow && !externalPreviewWindow.closed) externalPreviewWindow.postMessage(message, origin);
});

document.querySelector('#save-config').addEventListener('click', () => {
  config = saveStoredConfig(config); renderAll();
  let saved = false;
  try { saved = localStorage.getItem(CONFIG_STORAGE_KEY) === JSON.stringify(config); } catch { /* unavailable */ }
  announce(
    saved
      ? '設定とカスタムアセットをブラウザに保存しました。'
      : 'ブラウザ保存に失敗しました。容量上限の可能性があります。JSON Exportで保存してください。',
    !saved,
  );
});
document.querySelector('#reset-config').addEventListener('click', () => {
  if (!window.confirm('編集中の設定を初期値へ戻しますか？')) return;
  config = getDefaultConfig(); activeTab = { type: 'intro', index: 0 }; normalizeAndRender(); announce('初期値へ戻しました（未保存）。');
});
document.querySelector('#export-config').addEventListener('click', () => {
  config = normalizeAppConfig(config);
  const blob = new Blob([`${JSON.stringify(config, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = el('a'); link.href = url;
  link.download = `rocking-train-config-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  announce('設定JSONを書き出しました。');
});
document.querySelector('#import-config').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try { config = normalizeAppConfig(JSON.parse(await file.text())); activeTab = { type: 'intro', index: 0 }; normalizeAndRender(); announce(`${file.name}を読み込みました（未保存）。`); }
  catch (error) { announce(`JSONを読み込めませんでした: ${error.message}`, true); }
  event.target.value = '';
});

window.addEventListener('message', (event) => {
  if (event.data?.type === 'rocking-train-preview-ready') {
    if (event.source === previewFrame.contentWindow) sendPreviewConfig(event.source, previewFromCurrentTab);
    else if (event.source === externalPreviewWindow) {
      sendPreviewConfig(event.source, externalPreviewFromCurrentTab);
    }
    return;
  }
  if (event.source !== previewFrame.contentWindow || event.data?.type !== 'rocking-train-preview-state') return;
  const { value, context } = event.data.snapshot;
  timeline.querySelectorAll('.timeline__item').forEach((item) => {
    const activeState = value === 'STAGE_SELECTION_FEEDBACK'
      ? context.currentScene?.id
      : value;
    let active = item.dataset.state === activeState;
    if (active && item.dataset.sceneIndex !== undefined) active = Number(item.dataset.sceneIndex) === context.sceneIndex;
    item.classList.toggle('is-active', active);
    if (active) item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
});

synchronizeAllQuestionStages();
renderAll();
