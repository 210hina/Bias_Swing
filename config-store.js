import { CONTENT } from './content.js';

export const CONFIG_SCHEMA_VERSION = 3;
export const CONFIG_STORAGE_KEY = 'rocking-train-config-v1';
export const PREVIEW_CONFIG_KEY = 'rocking-train-preview-config-v1';

const INFO_LEVELS = new Set([
  'text_only',
  'text_and_illustration',
  'social_statistics',
]);

export const DEFAULT_APP_CONFIG = Object.freeze({
  schemaVersion: CONFIG_SCHEMA_VERSION,
  choiceHoldDurationMs: 2000,
  sceneSequence: Object.freeze([
    Object.freeze({
      id: 'SESSION_START',
      behavior: 'timed',
      label: '開始表示',
      durationMs: 400,
      backgroundAssetKey: 'train_far_full',
      title: CONTENT.scenes.sessionStart.title,
      message: CONTENT.scenes.sessionStart.message,
    }),
    Object.freeze({
      id: 'SCENE_INTRO_FULL',
      behavior: 'timed',
      label: '導入：混雑した車内',
      durationMs: 2000,
      backgroundAssetKey: 'train_far_full',
      title: CONTENT.scenes.intro.fullTitle,
      message: CONTENT.scenes.intro.fullMessage,
    }),
    Object.freeze({
      id: 'SCENE_INTRO_EMPTY',
      behavior: 'timed',
      label: '導入：空いた車内',
      durationMs: 2000,
      backgroundAssetKey: 'train_far_empty',
      title: CONTENT.scenes.intro.emptyTitle,
      message: CONTENT.scenes.intro.emptyMessage,
    }),
    Object.freeze({
      id: 'STAGE_1_INPUT',
      behavior: 'stage_input',
      label: 'Stage 1：文字のみ',
      durationMs: 12000,
      backgroundAssetKey: 'train_close_full',
      title: '',
      message: CONTENT.scenes.stage.inputHint,
    }),
    Object.freeze({
      id: 'STAGE_2_INPUT',
      behavior: 'stage_input',
      label: 'Stage 2：ランダム分岐',
      durationMs: 12000,
      backgroundAssetKey: 'train_close_full',
      title: '',
      message: CONTENT.scenes.stage.inputHint,
    }),
    Object.freeze({
      id: 'SESSION_SUMMARY',
      behavior: 'summary',
      label: '総合結果',
      durationMs: 4000,
      backgroundAssetKey: 'train_far_empty',
      title: CONTENT.scenes.summary.title,
      message: '',
    }),
    Object.freeze({
      id: 'SESSION_END',
      behavior: 'end',
      label: '終了表示',
      durationMs: 4000,
      backgroundAssetKey: 'train_far_empty',
      title: CONTENT.scenes.end.title,
      message: CONTENT.scenes.end.message,
    }),
  ]),
  questionSets: Object.freeze([
    Object.freeze({
      id: 'priority_seat_01',
      label: CONTENT.questionSets.first.label,
      stages: Object.freeze([
        Object.freeze({
          stage: 1,
          infoLevel: 'text_only',
          left: Object.freeze({ label: CONTENT.passengers.woman20.label }),
          right: Object.freeze({ label: CONTENT.passengers.man70.label }),
        }),
        Object.freeze({
          stage: 2,
          selectionMode: 'random',
          variants: Object.freeze([
            Object.freeze({
              id: 'illustration',
              label: '2α：イラスト情報',
              infoLevel: 'text_and_illustration',
              left: Object.freeze({
                label: CONTENT.passengers.woman20.label,
                assetKey: 'char_20f',
              }),
              right: Object.freeze({
                label: CONTENT.passengers.man70.label,
                assetKey: 'char_70m',
              }),
            }),
            Object.freeze({
              id: 'social_statistics',
              label: '2β：他者の選択率',
              infoLevel: 'social_statistics',
              left: Object.freeze({ label: CONTENT.passengers.woman20.label }),
              right: Object.freeze({ label: CONTENT.passengers.man70.label }),
            }),
          ]),
        }),
      ]),
    }),
  ]),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteMilliseconds(value, fallback, minimum = 0, maximum = 300000) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.round(number)))
    : fallback;
}

function normalizePassenger(passenger, fallback) {
  const label = String(passenger?.label ?? '').trim() || fallback.label;
  const assetKey = String(passenger?.assetKey ?? '').trim();
  return assetKey ? { label, assetKey } : { label };
}

function normalizeStageContent(source, fallback, fallbackId = 'variant') {
  return {
    id: String(source?.id ?? '').trim() || fallback?.id || fallbackId,
    label: String(source?.label ?? '').trim() || fallback?.label || fallbackId,
    infoLevel: INFO_LEVELS.has(source?.infoLevel)
      ? source.infoLevel
      : fallback?.infoLevel ?? 'text_only',
    left: normalizePassenger(source?.left, fallback?.left ?? { label: '左の乗客' }),
    right: normalizePassenger(source?.right, fallback?.right ?? { label: '右の乗客' }),
  };
}

const SCENE_BEHAVIORS = new Set(['timed', 'stage_input', 'summary', 'end']);

function legacySceneSequence(candidate, defaults) {
  const durations = candidate?.durations ?? {};
  const legacyIntro = Number(durations.sceneIntro);
  const introHalf = Number.isFinite(legacyIntro) ? legacyIntro / 2 : null;
  const durationMap = {
    SESSION_START: durations.sessionStart,
    SCENE_INTRO_FULL: durations.sceneIntroCrowded ?? introHalf,
    SCENE_INTRO_EMPTY: durations.sceneIntroEmpty ?? introHalf,
    STAGE_1_INPUT: durations.stageWaitInput,
    STAGE_2_INPUT: durations.stageWaitInput,
    SESSION_SUMMARY: durations.sessionSummary,
    SESSION_END: durations.sessionEnd,
  };
  return defaults.map((scene) => ({
    ...scene,
    durationMs: finiteMilliseconds(durationMap[scene.id], scene.durationMs),
  }));
}

function normalizeSceneSequence(candidate, defaults) {
  const source = Array.isArray(candidate?.sceneSequence) && candidate.sceneSequence.length
    ? candidate.sceneSequence
    : legacySceneSequence(candidate, defaults);
  const usedIds = new Set();
  return source.map((scene, index) => {
    const fallback = defaults[Math.min(index, defaults.length - 1)] ?? defaults[0];
    const baseId = String(scene?.id ?? '').trim() || `CUSTOM_SCENE_${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}_${suffix++}`;
    usedIds.add(id);
    return {
      id,
      behavior: SCENE_BEHAVIORS.has(scene?.behavior) ? scene.behavior : 'timed',
      label: String(scene?.label ?? '').trim() || `シーン ${index + 1}`,
      durationMs: finiteMilliseconds(scene?.durationMs, fallback.durationMs),
      backgroundAssetKey: String(scene?.backgroundAssetKey ?? '').trim() || fallback.backgroundAssetKey,
      backgroundImageName: String(scene?.backgroundImageName ?? ''),
      backgroundImageSrc:
        typeof scene?.backgroundImageSrc === 'string' &&
        scene.backgroundImageSrc.startsWith('data:image/')
          ? scene.backgroundImageSrc
          : '',
      title: String(scene?.title ?? ''),
      message: String(scene?.message ?? ''),
    };
  });
}

/** Return a mutable copy suitable for form editing. */
export function getDefaultConfig() {
  return clone(DEFAULT_APP_CONFIG);
}

/**
 * Validate imported/stored data and fill every missing value from defaults.
 * This is the single JSON shape consumed by both the app and admin page.
 */
export function normalizeAppConfig(candidate = {}) {
  const defaults = getDefaultConfig();
  const candidateSets = Array.isArray(candidate?.questionSets)
    ? candidate.questionSets
    : [];
  const usedSetIds = new Set();
  const questionSets = candidateSets.map((questionSet, setIndex) => {
    const fallbackSet = defaults.questionSets[0];
    const candidateStages = Array.isArray(questionSet?.stages)
      ? questionSet.stages
      : [];
    const stages = candidateStages.map((stage, stageIndex) => {
      const fallbackStage = fallbackSet.stages[Math.min(stageIndex, fallbackSet.stages.length - 1)];
      const fallbackVariants = Array.isArray(fallbackStage?.variants)
        ? fallbackStage.variants
        : [];
      const sourceVariants = Array.isArray(stage?.variants) ? stage.variants : [];
      // Version 1 stored Stage 2 as a single illustration stage. Upgrade it to
      // the new 2α / 2β random branch automatically.
      const variants = sourceVariants.length
        ? sourceVariants.map((variant, variantIndex) => normalizeStageContent(
            variant,
            fallbackVariants[variantIndex] ?? fallbackVariants[0],
            `variant_${variantIndex + 1}`,
          ))
        : Number(candidate?.schemaVersion ?? 1) < 2 && fallbackVariants.length
          ? fallbackVariants.map((fallbackVariant, variantIndex) => normalizeStageContent(
              variantIndex === 0
                ? { ...stage, id: fallbackVariant.id, label: fallbackVariant.label }
                : {
                    ...fallbackVariant,
                    left: { ...fallbackVariant.left, label: stage?.left?.label },
                    right: { ...fallbackVariant.right, label: stage?.right?.label },
                  },
              fallbackVariant,
              `variant_${variantIndex + 1}`,
            ))
          : [];

      if (variants.length) {
        return {
          stage: stageIndex + 1,
          selectionMode: 'random',
          variants,
        };
      }

      const normalized = normalizeStageContent(stage, fallbackStage, `stage_${stageIndex + 1}`);
      delete normalized.id;
      delete normalized.label;
      return { stage: stageIndex + 1, ...normalized };
    });
    const baseId = String(questionSet?.id ?? '').trim() || `question_set_${setIndex + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedSetIds.has(id)) id = `${baseId}_${suffix++}`;
    usedSetIds.add(id);
    return {
      id,
      label: String(questionSet?.label ?? '').trim() || `設問セット ${setIndex + 1}`,
      stages: stages.length ? stages : clone(fallbackSet.stages),
    };
  });

  const normalizedQuestionSets = questionSets.length ? questionSets : defaults.questionSets;

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    sceneSequence: normalizeSceneSequence(candidate, defaults.sceneSequence),
    choiceHoldDurationMs: finiteMilliseconds(
      candidate?.choiceHoldDurationMs,
      defaults.choiceHoldDurationMs,
      100,
      30000,
    ),
    questionSets: normalizedQuestionSets,
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
