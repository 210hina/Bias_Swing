import { CONTENT } from './content.js';

export const CONFIG_SCHEMA_VERSION = 5;
export const CONFIG_STORAGE_KEY = 'rocking-train-config-v1';
export const PREVIEW_CONFIG_KEY = 'rocking-train-preview-config-v1';

const INFO_LEVELS = new Set(['text_only', 'text_and_illustration', 'text_and_stats']);
const PRESENTATION_TYPES = new Set(['random', 'text_and_illustration', 'text_and_stats']);
const SCENE_BEHAVIORS = new Set(['timed', 'stage_input', 'summary', 'end']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultSoundAsset() {
  return {
    bgm: { assetKey: '', loop: true, volume: 70, fadeMs: 800 },
    se: { startAssetKey: '', actionAssetKey: '', volume: 80 },
  };
}

function timedScene(id, label, durationMs, backgroundAssetKey, title, message, behavior = 'timed') {
  return {
    id,
    behavior,
    label,
    durationMs,
    backgroundAssetKey,
    backgroundImageName: '',
    backgroundImageSrc: '',
    title,
    message,
    soundAsset: defaultSoundAsset(),
  };
}

const DEFAULT_QUESTION_SET = {
  id: 'priority_seat_01',
  label: CONTENT.questionSets.first.label,
  stages: [
    {
      stage: 1,
      infoLevel: 'text_only',
      left: { label: CONTENT.passengers.woman20.label },
      right: { label: CONTENT.passengers.man70.label },
    },
    {
      stage: 2,
      presentationType: 'random',
      variants: [
        {
          id: 'illustration',
          label: '2α：イラスト情報',
          infoLevel: 'text_and_illustration',
          left: { label: CONTENT.passengers.woman20.label, assetKey: 'char_20f' },
          right: { label: CONTENT.passengers.man70.label, assetKey: 'char_70m' },
        },
        {
          id: 'text_and_stats',
          label: '2β：他者の選択率',
          infoLevel: 'text_and_stats',
          left: { label: CONTENT.passengers.woman20.label },
          right: { label: CONTENT.passengers.man70.label },
          stats: { leftPercent: 45, rightPercent: 55 },
        },
      ],
    },
  ],
};

export const DEFAULT_APP_CONFIG = Object.freeze({
  schemaVersion: CONFIG_SCHEMA_VERSION,
  customAssets: Object.freeze({
    images: Object.freeze({}),
    audio: Object.freeze({}),
  }),
  choiceHoldDurationMs: 2000,
  introduction: Object.freeze({
    sequence: Object.freeze([
      timedScene('SESSION_START', '開始表示', 400, 'train_far_full', CONTENT.scenes.sessionStart.title, CONTENT.scenes.sessionStart.message),
      timedScene('SCENE_INTRO_FULL', '導入：混雑した車内', 2000, 'train_far_full', CONTENT.scenes.intro.fullTitle, CONTENT.scenes.intro.fullMessage),
      timedScene('SCENE_INTRO_EMPTY', '導入：空いた車内', 2000, 'train_far_empty', CONTENT.scenes.intro.emptyTitle, CONTENT.scenes.intro.emptyMessage),
    ]),
  }),
  questionScenes: Object.freeze([
    Object.freeze({
      id: 'question_scene_01',
      label: 'シーン 1',
      questionSet: Object.freeze(clone(DEFAULT_QUESTION_SET)),
      sequence: Object.freeze([
        timedScene('SCENE_1_STAGE_1_INPUT', 'Stage 1：文字のみ', 12000, 'train_close_full', '', CONTENT.scenes.stage.inputHint, 'stage_input'),
        timedScene('SCENE_1_STAGE_2_INPUT', 'Stage 2：ランダム分岐', 12000, 'train_close_full', '', CONTENT.scenes.stage.inputHint, 'stage_input'),
      ]),
    }),
  ]),
  result: Object.freeze({
    sequence: Object.freeze([
      timedScene('SESSION_SUMMARY', '総合結果', 4000, 'train_far_empty', CONTENT.scenes.summary.title, '', 'summary'),
      timedScene('SESSION_END', '終了表示', 4000, 'train_far_empty', CONTENT.scenes.end.title, CONTENT.scenes.end.message, 'end'),
    ]),
    diagnosis: Object.freeze(clone(CONTENT.diagnosis)),
  }),
});

function finiteMilliseconds(value, fallback, minimum = 0, maximum = 300000) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.round(number)))
    : fallback;
}

function normalizePassenger(passenger, fallback) {
  const label = String(passenger?.label ?? '').trim() || fallback.label;
  const assetKey = String(passenger?.assetKey ?? '').trim();
  const imageName = String(passenger?.imageName ?? '');
  const imageSrc = typeof passenger?.imageSrc === 'string' && passenger.imageSrc.startsWith('data:image/')
    ? passenger.imageSrc
    : '';
  const normalized = { label };
  if (assetKey) normalized.assetKey = assetKey;
  if (imageSrc) {
    normalized.imageName = imageName;
    normalized.imageSrc = imageSrc;
  }
  return normalized;
}

function normalizeStageContent(source, fallback, fallbackId = 'variant') {
  const sourceInfoLevel = source?.infoLevel === 'social_statistics'
    ? 'text_and_stats'
    : source?.infoLevel;
  const fallbackInfoLevel = fallback?.infoLevel === 'social_statistics'
    ? 'text_and_stats'
    : fallback?.infoLevel;
  const infoLevel = INFO_LEVELS.has(sourceInfoLevel)
    ? sourceInfoLevel
    : fallbackInfoLevel ?? 'text_only';
  const normalized = {
    id: String(source?.id ?? '').trim() || fallback?.id || fallbackId,
    label: String(source?.label ?? '').trim() || fallback?.label || fallbackId,
    infoLevel,
    left: normalizePassenger(source?.left, fallback?.left ?? { label: '左の乗客' }),
    right: normalizePassenger(source?.right, fallback?.right ?? { label: '右の乗客' }),
  };
  if (infoLevel === 'text_and_stats') {
    const leftSource = source?.stats?.leftPercent;
    const rightSource = source?.stats?.rightPercent;
    const left = leftSource === '' || leftSource == null ? Number.NaN : Number(leftSource);
    const right = rightSource === '' || rightSource == null ? Number.NaN : Number(rightSource);
    normalized.stats = {
      leftPercent: Number.isFinite(left) ? Math.min(100, Math.max(0, left)) : fallback?.stats?.leftPercent ?? 45,
      rightPercent: Number.isFinite(right) ? Math.min(100, Math.max(0, right)) : fallback?.stats?.rightPercent ?? 55,
    };
  }
  return normalized;
}

function normalizeQuestionSet(source, fallback, setIndex) {
  const sourceStages = Array.isArray(source?.stages) ? source.stages : [];
  const stages = sourceStages.map((stage, stageIndex) => {
    const fallbackStage = fallback.stages[Math.min(stageIndex, fallback.stages.length - 1)];
    const fallbackVariants = Array.isArray(fallbackStage?.variants) ? fallbackStage.variants : [];
    const sourceVariants = Array.isArray(stage?.variants) ? stage.variants : [];
    const variants = sourceVariants.map((variant, variantIndex) => normalizeStageContent(
      variant,
      fallbackVariants[variantIndex] ?? fallbackVariants[0],
      `variant_${variantIndex + 1}`,
    ));
    if (variants.length) {
      const requestedPresentation = stage?.presentationType ?? stage?.selectionMode;
      return {
        stage: stageIndex + 1,
        presentationType: PRESENTATION_TYPES.has(requestedPresentation) ? requestedPresentation : 'random',
        variants,
      };
    }
    const normalized = normalizeStageContent(stage, fallbackStage, `stage_${stageIndex + 1}`);
    delete normalized.id;
    delete normalized.label;
    return { stage: stageIndex + 1, ...normalized };
  });
  return {
    id: String(source?.id ?? '').trim() || `question_set_${setIndex + 1}`,
    label: String(source?.label ?? '').trim() || `設問セット ${setIndex + 1}`,
    stages: stages.length ? stages : clone(fallback.stages),
  };
}

function normalizeSceneItem(scene, fallback, index, usedIds) {
  const baseId = String(scene?.id ?? '').trim() || `CUSTOM_SCENE_${index + 1}`;
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) id = `${baseId}_${suffix++}`;
  usedIds.add(id);
  const sound = scene?.soundAsset ?? {};
  const fallbackSound = fallback?.soundAsset ?? defaultSoundAsset();
  const sourceBgm = typeof sound.bgm === 'string' ? { assetKey: sound.bgm } : sound.bgm ?? {};
  const sourceSe = typeof sound.se === 'string' ? { startAssetKey: sound.se } : sound.se ?? {};
  const fallbackBgm = typeof fallbackSound.bgm === 'string'
    ? { assetKey: fallbackSound.bgm }
    : fallbackSound.bgm ?? {};
  const fallbackSe = typeof fallbackSound.se === 'string'
    ? { startAssetKey: fallbackSound.se }
    : fallbackSound.se ?? {};
  const behavior = SCENE_BEHAVIORS.has(scene?.behavior) ? scene.behavior : fallback?.behavior ?? 'timed';
  const rawMessage = String(scene?.message ?? '');
  const message = behavior === 'stage_input' && rawMessage.trim() === '← 左　・　↓ 自分　・　→ 右'
    ? ''
    : rawMessage;
  return {
    id,
    behavior,
    label: String(scene?.label ?? '').trim() || `シーン ${index + 1}`,
    durationMs: finiteMilliseconds(scene?.durationMs, fallback?.durationMs ?? 2000),
    backgroundAssetKey: String(scene?.backgroundAssetKey ?? '').trim() || fallback?.backgroundAssetKey || 'train_far_full',
    backgroundImageName: String(scene?.backgroundImageName ?? ''),
    backgroundImageSrc:
      typeof scene?.backgroundImageSrc === 'string' && scene.backgroundImageSrc.startsWith('data:image/')
        ? scene.backgroundImageSrc
        : '',
    title: String(scene?.title ?? ''),
    message,
    soundAsset: {
      bgm: {
        assetKey: String(sourceBgm.assetKey ?? ''),
        loop: sourceBgm.loop === undefined ? fallbackBgm.loop !== false : Boolean(sourceBgm.loop),
        volume: finiteMilliseconds(sourceBgm.volume, fallbackBgm.volume ?? 70, 0, 100),
        fadeMs: finiteMilliseconds(sourceBgm.fadeMs, fallbackBgm.fadeMs ?? 800, 0, 30000),
      },
      se: {
        startAssetKey: String(sourceSe.startAssetKey ?? ''),
        actionAssetKey: String(sourceSe.actionAssetKey ?? ''),
        volume: finiteMilliseconds(sourceSe.volume, fallbackSe.volume ?? 80, 0, 100),
      },
    },
  };
}

function normalizeSequence(source, fallback, usedIds) {
  const list = Array.isArray(source) ? source : (fallback ?? []);
  return list.map((scene, index) => normalizeSceneItem(
    scene,
    fallback?.[Math.min(index, Math.max(0, fallback.length - 1))],
    index,
    usedIds,
  ));
}

function normalizeDiagnosis(source = {}) {
  const fallback = CONTENT.diagnosis;
  return Object.fromEntries(['empty', 'intuitive', 'balanced', 'thoughtful'].map((key) => [
    key,
    {
      title: String(source?.[key]?.title ?? fallback[key].title),
      message: String(source?.[key]?.message ?? fallback[key].message),
    },
  ]));
}

function normalizeAssetKey(value) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizeCustomAssets(source = {}) {
  const images = {};
  Object.entries(source?.images ?? {}).forEach(([rawKey, asset]) => {
    const key = normalizeAssetKey(rawKey);
    const src = typeof asset?.src === 'string' && asset.src.startsWith('data:image/')
      ? asset.src
      : '';
    if (!key || !src || images[key]) return;
    images[key] = {
      type: 'image',
      fileName: String(asset?.fileName ?? asset?.label ?? '').trim() || key,
      src,
    };
  });

  const audio = {};
  Object.entries(source?.audio ?? {}).forEach(([rawKey, asset]) => {
    const key = normalizeAssetKey(rawKey);
    const src = typeof asset?.src === 'string' && asset.src.startsWith('data:audio/')
      ? asset.src
      : '';
    if (!key || !src || audio[key]) return;
    audio[key] = {
      kind: asset?.kind === 'se' ? 'se' : 'bgm',
      fileName: String(asset?.fileName ?? asset?.label ?? '').trim() || key,
      src,
    };
  });
  return { images, audio };
}

function legacyDurationsToSequence(candidate, defaults) {
  const durations = candidate?.durations ?? {};
  const legacyIntro = Number(durations.sceneIntro);
  const introHalf = Number.isFinite(legacyIntro) ? legacyIntro / 2 : null;
  const allDefaults = [
    ...defaults.introduction.sequence,
    ...defaults.questionScenes[0].sequence,
    ...defaults.result.sequence,
  ];
  const durationMap = {
    SESSION_START: durations.sessionStart,
    SCENE_INTRO_FULL: durations.sceneIntroCrowded ?? introHalf,
    SCENE_INTRO_EMPTY: durations.sceneIntroEmpty ?? introHalf,
    SCENE_1_STAGE_1_INPUT: durations.stageWaitInput,
    SCENE_1_STAGE_2_INPUT: durations.stageWaitInput,
    SESSION_SUMMARY: durations.sessionSummary,
    SESSION_END: durations.sessionEnd,
  };
  return allDefaults.map((scene) => ({
    ...clone(scene),
    durationMs: finiteMilliseconds(durationMap[scene.id], scene.durationMs),
  }));
}

function migrateLegacyConfig(candidate, defaults) {
  const legacyQuestionSets = Array.isArray(candidate?.questionSets) && candidate.questionSets.length
    ? candidate.questionSets
    : [defaults.questionScenes[0].questionSet];
  const legacySequence = Array.isArray(candidate?.sceneSequence) && candidate.sceneSequence.length
    ? candidate.sceneSequence
    : legacyDurationsToSequence(candidate, defaults);
  const firstInput = legacySequence.findIndex((scene) => scene.behavior === 'stage_input');
  const resultStart = legacySequence.findIndex((scene) => scene.behavior === 'summary' || scene.behavior === 'end');
  const introEnd = firstInput < 0 ? (resultStart < 0 ? legacySequence.length : resultStart) : firstInput;
  const middleEnd = resultStart < 0 ? legacySequence.length : resultStart;
  const introduction = legacySequence.slice(0, introEnd);
  const middle = legacySequence.slice(introEnd, middleEnd);
  const result = legacySequence.slice(middleEnd);
  let cursor = 0;
  const questionScenes = legacyQuestionSets.map((questionSet, sceneIndex) => {
    const stageCount = Array.isArray(questionSet.stages) ? questionSet.stages.length : 1;
    const sequence = [];
    let consumedInputs = 0;
    while (cursor < middle.length && consumedInputs < stageCount) {
      const item = middle[cursor++];
      sequence.push(item);
      if (item.behavior === 'stage_input') consumedInputs += 1;
    }
    if (sceneIndex === legacyQuestionSets.length - 1) sequence.push(...middle.slice(cursor));
    return {
      id: `question_scene_${String(sceneIndex + 1).padStart(2, '0')}`,
      label: `シーン ${sceneIndex + 1}`,
      questionSet,
      sequence,
    };
  });
  return {
    schemaVersion: 4,
    customAssets: candidate?.customAssets,
    choiceHoldDurationMs: candidate?.choiceHoldDurationMs,
    introduction: { sequence: introduction },
    questionScenes,
    result: { sequence: result, diagnosis: candidate?.diagnosis },
  };
}

export function getDefaultConfig() {
  return clone(DEFAULT_APP_CONFIG);
}

/** Validate data, migrate v1-v3, and return the editable v4 shape. */
export function normalizeAppConfig(candidate = {}) {
  const defaults = getDefaultConfig();
  const source = Number(candidate?.schemaVersion ?? 1) >= 4 && candidate?.introduction
    ? candidate
    : migrateLegacyConfig(candidate, defaults);
  const usedSceneIds = new Set();
  const usedGroupIds = new Set();
  const usedQuestionSetIds = new Set();
  const sourceQuestionScenes = Array.isArray(source.questionScenes) && source.questionScenes.length
    ? source.questionScenes
    : defaults.questionScenes;
  const questionScenes = sourceQuestionScenes.map((questionScene, index) => {
    const fallback = defaults.questionScenes[0];
    const baseId = String(questionScene?.id ?? '').trim() || `question_scene_${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedGroupIds.has(id)) id = `${baseId}_${suffix++}`;
    usedGroupIds.add(id);
    const questionSet = normalizeQuestionSet(questionScene?.questionSet, fallback.questionSet, index);
    const questionSetBaseId = questionSet.id;
    let questionSetSuffix = 2;
    while (usedQuestionSetIds.has(questionSet.id)) {
      questionSet.id = `${questionSetBaseId}_${questionSetSuffix++}`;
    }
    usedQuestionSetIds.add(questionSet.id);
    return {
      id,
      label: String(questionScene?.label ?? '').trim() || `シーン ${index + 1}`,
      questionSet,
      sequence: normalizeSequence(questionScene?.sequence, fallback.sequence, usedSceneIds),
    };
  });
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    customAssets: normalizeCustomAssets(source?.customAssets),
    choiceHoldDurationMs: finiteMilliseconds(source?.choiceHoldDurationMs, defaults.choiceHoldDurationMs, 100, 30000),
    introduction: {
      sequence: normalizeSequence(source?.introduction?.sequence, defaults.introduction.sequence, usedSceneIds),
    },
    questionScenes,
    result: {
      sequence: normalizeSequence(source?.result?.sequence, defaults.result.sequence, usedSceneIds),
      diagnosis: normalizeDiagnosis(source?.result?.diagnosis),
    },
  };
}

/** Convert grouped editor data into the flat shape consumed by SceneManager. */
export function buildRuntimeConfig(config) {
  const normalized = normalizeAppConfig(config);
  return {
    sceneSequence: [
      ...normalized.introduction.sequence,
      ...normalized.questionScenes.flatMap((scene) => scene.sequence),
      ...normalized.result.sequence,
    ],
    questionSets: normalized.questionScenes.map((scene) => scene.questionSet),
    choiceHoldDurationMs: normalized.choiceHoldDurationMs,
    diagnosis: normalized.result.diagnosis,
    customAssets: normalized.customAssets,
  };
}

function readStorage(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? normalizeAppConfig(JSON.parse(raw)) : getDefaultConfig();
  } catch (error) {
    console.warn(`設定 ${key} を読み込めなかったためデフォルト値を使います。`, error);
    return getDefaultConfig();
  }
}

function writeStorage(storage, key, config) {
  const normalized = normalizeAppConfig(config);
  try {
    storage?.setItem(key, JSON.stringify(normalized));
  } catch (error) {
    console.warn(`設定 ${key} を保存できませんでした。`, error);
  }
  return normalized;
}

function browserStorage(name) {
  try {
    return globalThis[name] ?? null;
  } catch {
    return null;
  }
}

export function loadStoredConfig(storage) {
  return readStorage(storage ?? browserStorage('localStorage'), CONFIG_STORAGE_KEY);
}

export function saveStoredConfig(config, storage) {
  return writeStorage(storage ?? browserStorage('localStorage'), CONFIG_STORAGE_KEY, config);
}

export function loadPreviewConfig(storage) {
  return readStorage(storage ?? browserStorage('sessionStorage'), PREVIEW_CONFIG_KEY);
}

export function savePreviewConfig(config, storage) {
  return writeStorage(storage ?? browserStorage('sessionStorage'), PREVIEW_CONFIG_KEY, config);
}
