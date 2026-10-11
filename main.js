import { CONTENT } from './content.js';
import { buildRuntimeConfig, DEFAULT_APP_CONFIG } from './config-store.js';

/**
 * Rocking Train prototype: question data, assets, mock statistics, and input.
 *
 * This module has no framework dependency. It can later be connected to an
 * XState actor (or another state machine exposing a compatible send method).
 */

/** @typedef {'left' | 'right' | 'self'} Choice */
/** @typedef {'text_only' | 'text_and_illustration' | 'text_and_stats'} InfoLevel */

/**
 * @typedef {Object} PassengerInfo
 * @property {string} label
 * @property {string} [assetKey]
 * @property {string} [imageName]
 * @property {string} [imageSrc]
 */

/**
 * @typedef {Object} StageInfo
 * @property {number} stage
 * @property {InfoLevel} infoLevel
 * @property {PassengerInfo} left
 * @property {PassengerInfo} right
 * @property {'random' | 'text_and_illustration' | 'text_and_stats'} [presentationType]
 * @property {readonly StageVariant[]} [variants]
 * @property {{ leftPercent: number, rightPercent: number }} [stats]
 */

/**
 * @typedef {Object} StageVariant
 * @property {string} id
 * @property {string} label
 * @property {InfoLevel} infoLevel
 * @property {PassengerInfo} left
 * @property {PassengerInfo} right
 */

/**
 * @typedef {Object} QuestionSet
 * @property {string} id
 * @property {string} label
 * @property {readonly StageInfo[]} stages
 */

/** @typedef {'image' | 'video' | 'gif'} AssetType */

/**
 * @typedef {Object} AssetInfo
 * @property {AssetType} type
 * @property {string} src
 * @property {{ label: string, color: string }} fallback
 */

/** @typedef {Record<string, AssetInfo>} AssetManifest */

/**
 * @typedef {Object} ChoiceEvent
 * @property {'CHOICE_MADE' | 'CHOICE_HOLD_PROGRESS'} type
 * @property {Choice} choice
 * @property {number} [progress]
 */

/**
 * The minimum interface required from the application state machine.
 * XState actors satisfy this contract.
 *
 * @typedef {Object} ChoiceStateMachine
 * @property {(event: ChoiceEvent) => void} send
 * @property {() => ({ value: unknown })} [getSnapshot]
 */

/**
 * A replaceable input source. A future WebSocket implementation only needs to
 * provide the same methods as the keyboard source.
 *
 * @typedef {Object} ChoiceInputSource
 * @property {(
 *   onChoice: (choice: Choice) => void,
 *   onProgress: (choice: Choice, progress: number) => void
 * ) => void} start
 * @property {() => void} stop
 */

/** @type {readonly QuestionSet[]} */
const DEFAULT_RUNTIME_CONFIG = buildRuntimeConfig(DEFAULT_APP_CONFIG);

export const QUESTION_SETS = DEFAULT_RUNTIME_CONFIG.questionSets;

/**
 * Backward-compatible alias for code that only needs the first question set.
 * New code should use QUESTION_SETS.
 */
export const STAGES = QUESTION_SETS[0].stages;

/** @type {AssetManifest} */
export const ASSET_MANIFEST = Object.freeze({
  char_20f: Object.freeze({
    type: 'image',
    // PNG insertion point: Stage 2, left passenger.
    src: './assets/char_20f.png',
    fallback: Object.freeze({
      label: CONTENT.passengers.woman20.label,
      color: '#d96c88',
    }),
  }),
  char_70m: Object.freeze({
    type: 'image',
    // PNG insertion point: Stage 2, right passenger.
    src: './assets/char_70m.png',
    fallback: Object.freeze({
      label: CONTENT.passengers.man70.label,
      color: '#5576a8',
    }),
  }),
  bg_train_loop: Object.freeze({
    type: 'image',
    // PNG insertion point: ATTRACT waiting screen.
    src: './assets/bg_train_loop.png',
    fallback: Object.freeze({
      label: CONTENT.assetFallbacks.trainBackground,
      color: '#55646f',
    }),
  }),
  train_far_full: Object.freeze({
    type: 'image',
    // SCENE_INTRO frame 1.
    src: './assets/01_train_Far_Full.png',
    fallback: Object.freeze({
      label: CONTENT.assetFallbacks.crowdedTrain,
      color: '#635c58',
    }),
  }),
  train_far_empty: Object.freeze({
    type: 'image',
    // SCENE_INTRO frame 2.
    src: './assets/02_train_Far_Empty.png',
    fallback: Object.freeze({
      label: CONTENT.assetFallbacks.emptyTrain,
      color: '#59656b',
    }),
  }),
  train_close_full: Object.freeze({
    type: 'image',
    // Question presentation and selection screens.
    src: './assets/03_train_Close_Full.png',
    fallback: Object.freeze({
      label: CONTENT.assetFallbacks.closeTrain,
      color: '#4e5b62',
    }),
  }),
  hesitation_effect: Object.freeze({
    type: 'gif',
    src: './assets/hesitation_effect.gif',
    fallback: Object.freeze({
      label: CONTENT.assetFallbacks.hesitationEffect,
      color: '#735b91',
    }),
  }),
});

/** @typedef {'bgm' | 'se'} AudioKind */
/** @typedef {{ kind: AudioKind, label: string, src: string, loop?: boolean }} AudioAssetInfo */
/** @type {Readonly<Record<string, AudioAssetInfo>>} */
export const AUDIO_MANIFEST = Object.freeze({
  bgm_crowded: Object.freeze({
    kind: 'bgm',
    label: '混雑した車内の環境音',
    src: './assets/audio/bgm_crowded.mp3',
    loop: true,
  }),
  bgm_quiet: Object.freeze({
    kind: 'bgm',
    label: '空いた車内の環境音',
    src: './assets/audio/bgm_quiet.mp3',
    loop: true,
  }),
  se_input: Object.freeze({
    kind: 'se',
    label: '入力・決定音',
    src: './assets/audio/se_input.wav',
  }),
  se_hesitation: Object.freeze({
    kind: 'se',
    label: '迷い演出音',
    src: './assets/audio/se_hesitation.wav',
  }),
  se_reveal: Object.freeze({
    kind: 'se',
    label: '結果発表ジングル',
    src: './assets/audio/se_reveal.mp3',
  }),
});

function runtimeImageManifest(customAssets = {}) {
  const custom = Object.fromEntries(Object.entries(customAssets?.images ?? {}).map(([key, asset]) => [
    key,
    {
      type: asset.type ?? 'image',
      src: asset.src,
      fallback: { label: asset.fileName || key, color: '#666b70' },
    },
  ]));
  return { ...ASSET_MANIFEST, ...custom };
}

function runtimeAudioManifest(customAssets = {}) {
  return { ...AUDIO_MANIFEST, ...(customAssets?.audio ?? {}) };
}

/**
 * HTML Audio based BGM / SE engine with autoplay unlock and BGM crossfades.
 */
export class AudioManager {
  constructor({ windowRef = typeof window === 'undefined' ? null : window, manifest = AUDIO_MANIFEST } = {}) {
    this.windowRef = windowRef;
    this.manifest = manifest;
    this.unlocked = false;
    this.muted = false;
    this.currentBgm = null;
    this.currentBgmKey = '';
    this.pendingSound = null;
    this.activeAudio = new Set();
    this.targetVolumes = new Map();
    this.fadeTimers = new Map();
    this.unlockTarget = null;
    this.handleUnlock = this.unlock.bind(this);
  }

  createAudio(assetKey) {
    const asset = this.manifest[assetKey];
    const AudioConstructor = this.windowRef?.Audio ?? globalThis.Audio;
    if (!asset?.src || typeof AudioConstructor !== 'function') return null;
    const audio = new AudioConstructor(asset.src);
    audio.preload = 'auto';
    this.activeAudio.add(audio);
    return audio;
  }

  start(target = this.windowRef) {
    if (!target?.addEventListener) return;
    this.unlockTarget = target;
    target.addEventListener('pointerdown', this.handleUnlock, { capture: true });
    target.addEventListener('keydown', this.handleUnlock, { capture: true });
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.unlockTarget?.removeEventListener?.('pointerdown', this.handleUnlock, { capture: true });
    this.unlockTarget?.removeEventListener?.('keydown', this.handleUnlock, { capture: true });
    if (this.pendingSound) this.enterScene(this.pendingSound);
  }

  safePlay(audio) {
    if (!audio) return;
    try {
      const promise = audio.play();
      promise?.catch?.((error) => console.warn('音声を再生できませんでした。', error));
    } catch (error) {
      console.warn('音声を再生できませんでした。', error);
    }
  }

  setAudioVolume(audio, volume) {
    if (!audio) return;
    const normalized = Math.min(1, Math.max(0, volume));
    this.targetVolumes.set(audio, normalized);
    audio.volume = this.muted ? 0 : normalized;
  }

  fade(audio, from, to, durationMs, onComplete) {
    if (!audio) return;
    const existingTimer = this.fadeTimers.get(audio);
    if (existingTimer) clearInterval(existingTimer);
    this.fadeTimers.delete(audio);
    const duration = Math.max(0, Number(durationMs) || 0);
    if (!duration) {
      this.setAudioVolume(audio, to);
      onComplete?.();
      return;
    }
    const startedAt = Date.now();
    this.setAudioVolume(audio, from);
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      this.setAudioVolume(audio, from + (to - from) * progress);
      if (progress >= 1) {
        clearInterval(timer);
        this.fadeTimers.delete(audio);
        onComplete?.();
      }
    }, 40);
    this.fadeTimers.set(audio, timer);
  }

  stopAudio(audio) {
    if (!audio) return;
    const fadeTimer = this.fadeTimers.get(audio);
    if (fadeTimer) clearInterval(fadeTimer);
    this.fadeTimers.delete(audio);
    audio.pause?.();
    try { audio.currentTime = 0; } catch { /* Some streams are not seekable. */ }
    this.activeAudio.delete(audio);
    this.targetVolumes.delete(audio);
  }

  transitionBgm(settings = {}) {
    const assetKey = String(settings.assetKey ?? '');
    const asset = this.manifest[assetKey];
    const fadeMs = Math.max(0, Number(settings.fadeMs) || 0);
    const targetVolume = Math.min(1, Math.max(0, Number(settings.volume ?? 70) / 100));
    if (assetKey && asset?.kind !== 'bgm') return;

    if (assetKey && assetKey === this.currentBgmKey && this.currentBgm) {
      this.currentBgm.loop = settings.loop ?? asset.loop ?? true;
      this.fade(this.currentBgm, this.targetVolumes.get(this.currentBgm) ?? 0, targetVolume, fadeMs);
      return;
    }

    const previous = this.currentBgm;
    this.currentBgm = null;
    this.currentBgmKey = '';
    if (previous) {
      const previousVolume = this.targetVolumes.get(previous) ?? previous.volume ?? 0;
      this.fade(previous, previousVolume, 0, fadeMs, () => this.stopAudio(previous));
    }
    if (!assetKey || !asset) return;

    const next = this.createAudio(assetKey);
    if (!next) return;
    next.loop = settings.loop ?? asset.loop ?? true;
    this.currentBgm = next;
    this.currentBgmKey = assetKey;
    this.setAudioVolume(next, 0);
    this.safePlay(next);
    this.fade(next, 0, targetVolume, fadeMs);
  }

  playSe(assetKey, volume = 80) {
    const asset = this.manifest[assetKey];
    if (!this.unlocked || !assetKey || asset?.kind !== 'se') return;
    const audio = this.createAudio(assetKey);
    if (!audio) return;
    this.setAudioVolume(audio, Number(volume) / 100);
    const cleanup = () => this.stopAudio(audio);
    audio.addEventListener?.('ended', cleanup, { once: true });
    audio.addEventListener?.('error', cleanup, { once: true });
    this.safePlay(audio);
  }

  enterScene(soundAsset = null) {
    this.pendingSound = soundAsset;
    if (!this.unlocked) return;
    const sound = soundAsset ?? {
      bgm: { assetKey: '', volume: 70, fadeMs: 800, loop: true },
      se: { startAssetKey: '', actionAssetKey: '', volume: 80 },
    };
    this.transitionBgm(sound.bgm);
    this.playSe(sound.se?.startAssetKey, sound.se?.volume);
  }

  playActionSe(soundAsset = this.pendingSound) {
    this.playSe(soundAsset?.se?.actionAssetKey, soundAsset?.se?.volume);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.activeAudio.forEach((audio) => {
      audio.volume = this.muted ? 0 : this.targetVolumes.get(audio) ?? 0;
    });
  }

  destroy() {
    this.unlockTarget?.removeEventListener?.('pointerdown', this.handleUnlock, { capture: true });
    this.unlockTarget?.removeEventListener?.('keydown', this.handleUnlock, { capture: true });
    this.fadeTimers.forEach((timer) => clearInterval(timer));
    this.fadeTimers.clear();
    [...this.activeAudio].forEach((audio) => this.stopAudio(audio));
    this.currentBgm = null;
    this.currentBgmKey = '';
  }
}

const VALID_CHOICES = new Set(['left', 'right', 'self']);

/** @type {ChoiceStateMachine | null} */
let choiceStateMachine = null;

/**
 * Connect the choice layer to the application's state machine.
 *
 * @param {ChoiceStateMachine | null} machine
 */
export function setChoiceStateMachine(machine) {
  if (machine !== null && typeof machine.send !== 'function') {
    throw new TypeError('The state machine must provide a send(event) method.');
  }
  choiceStateMachine = machine;
}

/**
 * Return mock aggregate results for a stage.
 * The argument is reserved for later stage-specific data retrieval.
 *
 * @param {StageInfo | number} stage
 * @returns {{ leftPercent: number, rightPercent: number }}
 */
export function getMockStats(stage) {
  const configured = typeof stage === 'object' && stage ? stage.stats : null;
  const percentage = (value, fallback) => {
    const number = value === '' || value == null ? Number.NaN : Number(value);
    return Number.isFinite(number)
      ? Math.min(100, Math.max(0, number))
      : fallback;
  };
  return {
    leftPercent: percentage(configured?.leftPercent, 45),
    rightPercent: percentage(configured?.rightPercent, 55),
  };
}

/**
 * Create a colored placeholder for an unavailable media asset.
 *
 * @param {Document} documentRef
 * @param {{ label: string, color: string }} fallback
 * @returns {HTMLDivElement}
 */
function createAssetFallback(documentRef, fallback) {
  const placeholder = documentRef.createElement('div');
  placeholder.className = 'media-asset__fallback';
  placeholder.style.setProperty('--fallback-color', fallback.color);
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute('aria-label', fallback.label);

  const label = documentRef.createElement('span');
  label.className = 'media-asset__fallback-label';
  label.textContent = fallback.label;
  placeholder.append(label);

  return placeholder;
}

/**
 * Render an image, video, or GIF from the asset manifest.
 *
 * Accepts either MediaAsset('char_20f') or an object containing assetKey.
 * documentRef is injectable for DOM tests.
 *
 * @param {string | { assetKey: string, imageName?: string, imageSrc?: string, assetManifest?: AssetManifest, documentRef?: Document }} props
 * @returns {HTMLDivElement}
 */
export function MediaAsset(props) {
  const assetKey = typeof props === 'string' ? props : props?.assetKey;
  const imageName = typeof props === 'object' ? props?.imageName : '';
  const imageSrc = typeof props === 'object' ? props?.imageSrc : '';
  const assetManifest = typeof props === 'object' && props?.assetManifest
    ? props.assetManifest
    : ASSET_MANIFEST;
  const documentRef =
    (typeof props === 'object' && props?.documentRef) ||
    (typeof document === 'undefined' ? null : document);

  if (!documentRef) {
    throw new Error('MediaAsset requires a DOM Document.');
  }

  const root = documentRef.createElement('div');
  root.className = 'media-asset';
  root.dataset.assetKey = assetKey || '';

  const manifestAsset = assetManifest[assetKey];
  const asset = typeof imageSrc === 'string' && imageSrc.startsWith('data:image/')
    ? {
        type: 'image',
        src: imageSrc,
        fallback: {
          label: imageName || manifestAsset?.fallback?.label || assetKey || CONTENT.assetFallbacks.unspecified,
          color: manifestAsset?.fallback?.color || '#666b70',
        },
      }
    : manifestAsset;
  const fallback = asset?.fallback ?? {
    label: assetKey
      ? CONTENT.assetFallbacks.unknownPrefix + assetKey
      : CONTENT.assetFallbacks.unspecified,
    color: '#666b70',
  };
  let fallbackShown = false;

  const showFallback = () => {
    if (fallbackShown) return;
    fallbackShown = true;
    root.classList.add('media-asset--fallback');
    root.replaceChildren(createAssetFallback(documentRef, fallback));
  };

  if (!asset?.src) {
    showFallback();
    return root;
  }

  /** @type {HTMLImageElement | HTMLVideoElement | null} */
  let media = null;
  if (asset.type === 'video') {
    media = documentRef.createElement('video');
    media.autoplay = true;
    media.loop = true;
    media.muted = true;
    media.playsInline = true;
    media.setAttribute('aria-label', fallback.label);
  } else if (asset.type === 'image' || asset.type === 'gif') {
    media = documentRef.createElement('img');
    media.alt = fallback.label;
    media.decoding = 'async';
    if (asset.type === 'gif') media.dataset.mediaType = 'gif';
  }

  if (!media) {
    showFallback();
    return root;
  }

  media.className = 'media-asset__media';
  media.addEventListener('error', showFallback, { once: true });
  media.src = asset.src;
  root.append(media);
  return root;
}

/**
 * Render one passenger option.
 *
 * @param {Document} documentRef
 * @param {'left' | 'right'} side
 * @param {PassengerInfo} passenger
 * @param {InfoLevel} infoLevel
 * @param {ReturnType<typeof createChoiceHoldController>} holdController
 * @returns {HTMLElement}
 */
function createChoiceOption(documentRef, side, passenger, infoLevel, holdController, assetManifest) {
  const option = documentRef.createElement('button');
  option.className = 'choice-prompt__option choice-prompt__option--' + side;
  option.type = 'button';
  option.dataset.choice = side;
  option.setAttribute(
    'aria-label',
    passenger.label + CONTENT.choices.giveSeatSuffix,
  );
  option.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault?.();
    option.setPointerCapture?.(event.pointerId);
    holdController.start(side);
  });
  const cancelHold = () => holdController.cancel(side);
  option.addEventListener('pointerup', cancelHold);
  option.addEventListener('pointercancel', cancelHold);
  option.addEventListener('pointerleave', cancelHold);

  if (['text_and_illustration', 'text_and_stats'].includes(infoLevel)) {
    option.append(MediaAsset({
      assetKey: passenger.assetKey ?? '',
      imageName: passenger.imageName ?? '',
      imageSrc: passenger.imageSrc ?? '',
      assetManifest,
      documentRef,
    }));
  }

  const label = documentRef.createElement('h2');
  label.className = 'choice-prompt__label';
  label.textContent = passenger.label;
  option.append(label);

  return option;
}

/**
 * Render a stage prompt at the detail level specified by StageInfo.
 *
 * Accepts either ChoicePrompt(stageInfo) or an object containing stageInfo.
 *
 * @param {StageInfo | {
 *   stageInfo: StageInfo,
 *   documentRef?: Document,
 *   onChoice?: (choice: Choice) => void,
 *   onProgress?: (choice: Choice, progress: number) => void,
 *   holdDurationMs?: number
 *   assetManifest?: AssetManifest
 * }} props
 * @returns {HTMLElement}
 */
export function ChoicePrompt(props) {
  const wrappedProps = props && 'stageInfo' in props;
  const stageInfo = wrappedProps ? props.stageInfo : props;
  const documentRef =
    (wrappedProps && props.documentRef) ||
    (typeof document === 'undefined' ? null : document);

  if (!documentRef) {
    throw new Error('ChoicePrompt requires a DOM Document.');
  }
  if (
    !stageInfo ||
    !['text_only', 'text_and_illustration', 'text_and_stats'].includes(stageInfo.infoLevel)
  ) {
    throw new TypeError('ChoicePrompt received invalid StageInfo.');
  }
  const windowRef = documentRef.defaultView;
  const assetManifest = wrappedProps ? (props.assetManifest ?? ASSET_MANIFEST) : ASSET_MANIFEST;
  const holdController = createChoiceHoldController({
    durationMs: wrappedProps ? props.holdDurationMs : undefined,
    now: () => windowRef?.performance?.now() ?? Date.now(),
    requestFrame: windowRef?.requestAnimationFrame
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : undefined,
    cancelFrame: windowRef?.cancelAnimationFrame
      ? windowRef.cancelAnimationFrame.bind(windowRef)
      : undefined,
    onProgress:
      (wrappedProps && props.onProgress) || emitChoiceHoldProgress,
    onComplete: (wrappedProps && props.onChoice) || emitChoice,
  });

  const prompt = documentRef.createElement('section');
  prompt.className = 'choice-prompt choice-prompt--' + stageInfo.infoLevel;
  prompt.dataset.stage = String(stageInfo.stage);
  prompt.dataset.infoLevel = stageInfo.infoLevel;
  prompt.setAttribute('aria-label', CONTENT.choicePrompt.ariaLabel);

  if (stageInfo.infoLevel === 'text_and_stats') {
    prompt.append(SocialStatistics({
      stageInfo,
      stats: getMockStats(stageInfo),
      documentRef,
    }));
  }

  prompt.append(
    createChoiceOption(
      documentRef,
      'left',
      stageInfo.left,
      stageInfo.infoLevel,
      holdController,
      assetManifest,
    ),
    createChoiceOption(
      documentRef,
      'right',
      stageInfo.right,
      stageInfo.infoLevel,
      holdController,
      assetManifest,
    ),
  );
  return prompt;
}

/**
 * Render only the option that was just selected.
 *
 * @param {Object} props
 * @param {StageInfo} props.stageInfo
 * @param {Choice} props.choice
 * @param {AssetManifest} [props.assetManifest]
 * @param {Document} props.documentRef
 * @returns {HTMLElement}
 */
export function ChoiceSelectionFeedback({
  stageInfo,
  choice,
  assetManifest = ASSET_MANIFEST,
  documentRef,
}) {
  const feedback = documentRef.createElement('section');
  feedback.className = `choice-feedback choice-feedback--${choice}`;
  feedback.setAttribute('aria-label', '確定した選択肢');

  const selected = choice === 'left'
    ? stageInfo.left
    : choice === 'right'
      ? stageInfo.right
      : { label: CONTENT.choices.self };
  const card = documentRef.createElement('div');
  card.className = 'choice-feedback__option';

  if (
    choice !== 'self' &&
    ['text_and_illustration', 'text_and_stats'].includes(stageInfo.infoLevel)
  ) {
    card.append(MediaAsset({
      assetKey: selected.assetKey ?? '',
      imageName: selected.imageName ?? '',
      imageSrc: selected.imageSrc ?? '',
      assetManifest,
      documentRef,
    }));
  }

  const label = documentRef.createElement('h2');
  label.className = 'choice-feedback__label';
  label.textContent = selected.label;
  card.append(label);
  feedback.append(card);
  return feedback;
}

function selectedChoiceLabel(stageInfo, choice) {
  if (choice === 'left') return stageInfo.left.label;
  if (choice === 'right') return stageInfo.right.label;
  return CONTENT.choices.self;
}

/**
 * Information shown before choosing in the Stage 2β branch.
 *
 * @param {Object} props
 * @param {StageInfo} props.stageInfo
 * @param {{ leftPercent: number, rightPercent: number }} props.stats
 * @param {Document} props.documentRef
 */
export function SocialStatistics({ stageInfo, stats, documentRef }) {
  const panel = documentRef.createElement('section');
  panel.className = 'social-statistics';
  const title = documentRef.createElement('h2');
  title.textContent = CONTENT.socialStatistics.title;
  const description = documentRef.createElement('p');
  description.textContent = CONTENT.socialStatistics.description;
  const comparison = documentRef.createElement('div');
  comparison.className = 'social-statistics__comparison';
  const labels = documentRef.createElement('div');
  labels.className = 'social-statistics__labels';
  [
    ['left', stageInfo.left.label, stats.leftPercent],
    ['right', stageInfo.right.label, stats.rightPercent],
  ].forEach(([side, labelText, percent]) => {
    const item = documentRef.createElement('div');
    item.className = `social-statistics__label social-statistics__label--${side}`;
    const label = documentRef.createElement('span');
    label.textContent = labelText;
    const value = documentRef.createElement('strong');
    value.textContent = percent + '%';
    item.append(label, value);
    labels.append(item);
  });

  const total = Math.max(0, stats.leftPercent) + Math.max(0, stats.rightPercent);
  const leftShare = total > 0 ? (Math.max(0, stats.leftPercent) / total) * 100 : 50;
  const bar = documentRef.createElement('div');
  bar.className = 'social-statistics__bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute(
    'aria-label',
    `${stageInfo.left.label} ${stats.leftPercent}%、${stageInfo.right.label} ${stats.rightPercent}%`,
  );
  const leftFill = documentRef.createElement('span');
  leftFill.className = 'social-statistics__segment social-statistics__segment--left';
  leftFill.style.setProperty('--social-share', leftShare + '%');
  const rightFill = documentRef.createElement('span');
  rightFill.className = 'social-statistics__segment social-statistics__segment--right';
  rightFill.style.setProperty('--social-share', 100 - leftShare + '%');
  bar.append(leftFill, rightFill);
  comparison.append(labels, bar);
  panel.append(title, description, comparison);
  return panel;
}

const CHOICE_LABELS = Object.freeze({
  left: CONTENT.choices.leftAction,
  right: CONTENT.choices.rightAction,
  self: CONTENT.choices.selfAction,
});

export const CHOICE_HOLD_DURATION_MS = 2000;

/**
 * Shared hold gesture used by keyboard and on-screen controls.
 *
 * @param {Object} options
 * @param {(choice: Choice, progress: number) => void} options.onProgress
 * @param {(choice: Choice) => void} options.onComplete
 * @param {number} [options.durationMs]
 * @param {() => number} [options.now]
 * @param {(callback: (time: number) => void) => unknown} [options.requestFrame]
 * @param {(frameId: unknown) => void} [options.cancelFrame]
 * @param {() => boolean} [options.canContinue]
 */
export function createChoiceHoldController({
  onProgress,
  onComplete,
  durationMs = CHOICE_HOLD_DURATION_MS,
  now = () => Date.now(),
  requestFrame = (callback) => setTimeout(() => callback(now()), 16),
  cancelFrame = (frameId) => clearTimeout(frameId),
  canContinue = () => true,
}) {
  /** @type {Choice | null} */
  let activeChoice = null;
  let startedAt = 0;
  let frameId = null;

  const cancel = (choice = activeChoice) => {
    if (!activeChoice || (choice && choice !== activeChoice)) return;
    const cancelledChoice = activeChoice;
    activeChoice = null;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    onProgress(cancelledChoice, 0);
  };

  const tick = () => {
    if (!activeChoice) return;
    if (!canContinue()) {
      cancel();
      return;
    }

    const progress = Math.min(1, Math.max(0, (now() - startedAt) / durationMs));
    onProgress(activeChoice, progress);
    if (progress >= 1) {
      const completedChoice = activeChoice;
      activeChoice = null;
      frameId = null;
      onComplete(completedChoice);
      return;
    }
    frameId = requestFrame(tick);
  };

  return {
    /** @param {Choice} choice */
    start(choice) {
      if (choice === activeChoice) return;
      if (activeChoice) cancel();
      activeChoice = choice;
      startedAt = now();
      onProgress(choice, 0);
      frameId = requestFrame(tick);
    },
    cancel,
    get activeChoice() {
      return activeChoice;
    },
  };
}

/**
 * Convert response time into a simple linear hesitation score.
 * Immediate input is 0%; consuming the full input window is 100%.
 *
 * @param {number} responseTimeMs
 * @param {number} inputWindowMs
 * @returns {number}
 */
export function calculateHesitationDegree(responseTimeMs, inputWindowMs) {
  const safeWindow = Math.max(1, Number(inputWindowMs) || 1);
  const safeResponse = Math.max(0, Number(responseTimeMs) || 0);
  return Math.min(100, Math.round((safeResponse / safeWindow) * 100));
}

/**
 * Build an overall diagnosis from the in-memory stage history.
 *
 * @param {readonly StageResult[]} results
 * @returns {{
 *   averageHesitation: number,
 *   title: string,
 *   message: string,
 *   dominantChoice: Choice | null
 * }}
 */
export function getSessionDiagnosis(results, diagnosisContent = CONTENT.diagnosis) {
  if (!results.length) {
    return {
      averageHesitation: 0,
      title: diagnosisContent.empty.title,
      message: diagnosisContent.empty.message,
      dominantChoice: null,
    };
  }

  const averageHesitation = Math.round(
    results.reduce((sum, result) => sum + result.hesitationPercent, 0) / results.length,
  );
  const counts = { left: 0, right: 0, self: 0 };
  results.forEach((result) => {
    counts[result.choice] += 1;
  });
  /** @type {Choice} */
  const dominantChoice = /** @type {Choice} */ (
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  );

  if (averageHesitation <= 33) {
    return {
      averageHesitation,
      title: diagnosisContent.intuitive.title,
      message: diagnosisContent.intuitive.message,
      dominantChoice,
    };
  }
  if (averageHesitation <= 66) {
    return {
      averageHesitation,
      title: diagnosisContent.balanced.title,
      message: diagnosisContent.balanced.message,
      dominantChoice,
    };
  }
  return {
    averageHesitation,
    title: diagnosisContent.thoughtful.title,
    message: diagnosisContent.thoughtful.message,
    dominantChoice,
  };
}

/**
 * Brain-mode interstitial shown after a player choice.
 *
 * @param {{ choice: Choice, documentRef?: Document }} props
 * @returns {HTMLElement}
 */
export function HesitationEffect({ choice, documentRef = typeof document === 'undefined' ? null : document }) {
  if (!documentRef) throw new Error('HesitationEffect requires a DOM Document.');

  const effect = documentRef.createElement('section');
  effect.className = 'hesitation-effect';
  effect.append(MediaAsset({ assetKey: 'hesitation_effect', documentRef }));

  const mode = documentRef.createElement('p');
  mode.className = 'hesitation-effect__mode';
  mode.textContent = CONTENT.hesitation.mode;
  const choiceText = documentRef.createElement('p');
  choiceText.className = 'hesitation-effect__choice';
  choiceText.textContent = CHOICE_LABELS[choice];
  effect.append(mode, choiceText);
  return effect;
}

/**
 * Ticket-like summary UI used in place of thermal printing.
 *
 * @param {Object} props
 * @param {readonly StageResult[]} props.results
 * @param {readonly QuestionSet[]} props.questionSets
 * @param {typeof CONTENT.diagnosis} [props.diagnosisContent]
 * @param {Document} [props.documentRef]
 * @returns {HTMLElement}
 */
export function TicketMock({
  results,
  questionSets,
  diagnosisContent = CONTENT.diagnosis,
  documentRef = typeof document === 'undefined' ? null : document,
}) {
  if (!documentRef) throw new Error('TicketMock requires a DOM Document.');

  const ticket = documentRef.createElement('section');
  ticket.className = 'ticket-mock';
  ticket.setAttribute('aria-label', CONTENT.ticket.ariaLabel);

  const header = documentRef.createElement('header');
  header.className = 'ticket-mock__header';
  const eyebrow = documentRef.createElement('span');
  eyebrow.textContent = CONTENT.ticket.brand;
  const title = documentRef.createElement('h2');
  title.textContent = CONTENT.ticket.title;
  header.append(eyebrow, title);
  ticket.append(header);

  const diagnosis = getSessionDiagnosis(results, diagnosisContent);
  const diagnosisBlock = documentRef.createElement('div');
  diagnosisBlock.className = 'ticket-mock__diagnosis';
  const diagnosisTitle = documentRef.createElement('strong');
  diagnosisTitle.textContent = diagnosis.title;
  const diagnosisMessage = documentRef.createElement('p');
  diagnosisMessage.textContent = diagnosis.message;
  const diagnosisScore = documentRef.createElement('span');
  diagnosisScore.textContent =
    CONTENT.ticket.overallHesitationPrefix + diagnosis.averageHesitation + '%';
  diagnosisBlock.append(diagnosisTitle, diagnosisMessage, diagnosisScore);
  ticket.append(diagnosisBlock);

  const rows = documentRef.createElement('ol');
  rows.className = 'ticket-mock__results';
  results.forEach((result) => {
    const questionSet = questionSets.find((item) => item.id === result.questionSetId);
    const stage = questionSet?.stages.find((item) => item.stage === result.stage);
    if (!stage) return;
    const item = documentRef.createElement('li');
    item.className = 'ticket-mock__result';

    const stageLabel = documentRef.createElement('span');
    stageLabel.className = 'ticket-mock__stage';
    stageLabel.textContent =
      CONTENT.ticket.questionSetPrefix +
      result.questionSetNumber +
      CONTENT.ticket.stageSeparator +
      CONTENT.ticket.stagePrefix +
      result.stage;
    const answer = documentRef.createElement('strong');
    answer.textContent =
      result.choice === 'left'
        ? (result.leftLabel ?? stage.left?.label ?? '') + CONTENT.choices.giveSeatSuffix
        : result.choice === 'right'
          ? (result.rightLabel ?? stage.right?.label ?? '') + CONTENT.choices.giveSeatSuffix
          : CHOICE_LABELS.self;
    const hesitation = documentRef.createElement('span');
    hesitation.className = 'ticket-mock__hesitation';
    hesitation.textContent = CONTENT.ticket.hesitationPrefix + result.hesitationPercent + '%';
    item.append(stageLabel, answer, hesitation);
    rows.append(item);
  });
  ticket.append(rows);

  const footer = documentRef.createElement('footer');
  footer.className = 'ticket-mock__footer';
  footer.textContent = CONTENT.ticket.footer;
  ticket.append(footer);
  return ticket;
}

/**
 * Send one normalized choice to the configured state machine.
 *
 * @param {Choice} choice
 * @returns {boolean} true when an event was sent
 */
export function emitChoice(choice) {
  if (!VALID_CHOICES.has(choice)) {
    throw new TypeError('Unknown choice: ' + String(choice));
  }
  if (!choiceStateMachine) return false;

  choiceStateMachine.send({ type: 'CHOICE_MADE', choice });
  return true;
}

/**
 * Send hold progress through the same input abstraction as the final choice.
 *
 * @param {Choice} choice
 * @param {number} progress value between 0 and 1
 * @returns {boolean}
 */
export function emitChoiceHoldProgress(choice, progress) {
  if (!VALID_CHOICES.has(choice)) return false;
  if (!choiceStateMachine) return false;

  choiceStateMachine.send({
    type: 'CHOICE_HOLD_PROGRESS',
    choice,
    progress: Math.min(1, Math.max(0, progress)),
  });
  return true;
}

/**
 * Accept a plain state string or a nested XState state value.
 *
 * @param {unknown} state
 * @returns {boolean}
 */
function isWaitingForInput(state) {
  if (state === 'STAGE_WAIT_INPUT') return true;
  if (state && typeof state === 'object') {
    if (state.context?.acceptsChoice === true) return true;
    if ('value' in state && isWaitingForInput(state.value)) return true;
    return Object.values(state).some(isWaitingForInput);
  }
  return false;
}

/** @returns {unknown} */
function getConnectedMachineState() {
  return choiceStateMachine?.getSnapshot?.();
}

const KEY_TO_CHOICE = Object.freeze({
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'self',
});

/**
 * Create a keyboard input source without registering listeners yet.
 *
 * @param {Object} [options]
 * @param {{ addEventListener: Function, removeEventListener: Function }} [options.target]
 * @param {() => unknown} [options.getState]
 * @param {number} [options.holdDurationMs]
 * @param {() => number} [options.now]
 * @param {(callback: (time: number) => void) => unknown} [options.requestFrame]
 * @param {(frameId: unknown) => void} [options.cancelFrame]
 * @returns {ChoiceInputSource}
 */
export function createKeyboardChoiceInput(options = {}) {
  const target = options.target ?? (typeof window === 'undefined' ? null : window);
  const getState = options.getState ?? getConnectedMachineState;
  /** @type {((choice: Choice) => void) | null} */
  let onChoice = null;
  /** @type {((choice: Choice, progress: number) => void) | null} */
  let onProgress = null;
  let started = false;
  const holdController = createChoiceHoldController({
    durationMs: options.holdDurationMs,
    now: options.now ?? (() => target?.performance?.now?.() ?? Date.now()),
    requestFrame:
      options.requestFrame ??
      (target?.requestAnimationFrame
        ? target.requestAnimationFrame.bind(target)
        : undefined),
    cancelFrame:
      options.cancelFrame ??
      (target?.cancelAnimationFrame
        ? target.cancelAnimationFrame.bind(target)
        : undefined),
    canContinue: () => isWaitingForInput(getState()),
    onProgress: (choice, progress) => onProgress?.(choice, progress),
    onComplete: (choice) => onChoice?.(choice),
  });

  /** @param {{ key?: string, repeat?: boolean, preventDefault?: () => void }} event */
  const onKeyDown = (event) => {
    const choice = KEY_TO_CHOICE[event.key];
    if (!choice || event.repeat || !isWaitingForInput(getState())) return;

    event.preventDefault?.();
    if (choice === 'self') {
      onChoice?.(choice);
    } else {
      holdController.start(choice);
    }
  };

  /** @param {{ key?: string, preventDefault?: () => void }} event */
  const onKeyUp = (event) => {
    const choice = KEY_TO_CHOICE[event.key];
    if (choice !== 'left' && choice !== 'right') return;
    event.preventDefault?.();
    holdController.cancel(choice);
  };

  const onBlur = () => holdController.cancel();

  return {
    start(nextChoice, nextProgress) {
      if (started) return;
      if (!target) {
        throw new Error('Keyboard input requires an EventTarget.');
      }
      onChoice = nextChoice;
      onProgress = nextProgress;
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('blur', onBlur);
      started = true;
    },
    stop() {
      if (!started || !target) return;
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      holdController.cancel();
      onChoice = null;
      onProgress = null;
      started = false;
    },
  };
}

/**
 * Register any choice source with the shared dispatcher.
 *
 * @param {ChoiceInputSource} source
 * @returns {() => void} unregister function
 */
export function registerChoiceInput(source) {
  if (!source || typeof source.start !== 'function' || typeof source.stop !== 'function') {
    throw new TypeError('An input source must provide start() and stop() methods.');
  }

  source.start(emitChoice, emitChoiceHoldProgress);
  return () => source.stop();
}

/**
 * Register the default keyboard controls.
 *
 * @param {Parameters<typeof createKeyboardChoiceInput>[0]} [options]
 * @returns {() => void} unregister function
 */
export function registerKeyboardChoiceInput(options) {
  return registerChoiceInput(createKeyboardChoiceInput(options));
}

export const SCENE_STATES = Object.freeze({
  ATTRACT: 'ATTRACT',
  SESSION_START: 'SESSION_START',
  SCENE_INTRO: 'SCENE_INTRO',
  STAGE_WAIT_INPUT: 'STAGE_WAIT_INPUT',
  STAGE_SELECTION_FEEDBACK: 'STAGE_SELECTION_FEEDBACK',
  // STAGE_HESITATION: 'STAGE_HESITATION', // Currently disabled.
  STAGE_CONFIRM: 'STAGE_CONFIRM',
  SESSION_SUMMARY: 'SESSION_SUMMARY',
  SESSION_END: 'SESSION_END',
});

export const DEFAULT_SCENE_DURATIONS = Object.freeze({
  sessionStart: 400,
  sceneIntroCrowded: 2000,
  sceneIntroEmpty: 2000,
  sceneIntro: 4000,
  stageWaitInput: 12000,
  selectionFeedback: 1500,
  stageConfirm: 0,
  sessionSummary: 4000,
  sessionEnd: 4000,
});

export const DEFAULT_SCENE_SEQUENCE = DEFAULT_RUNTIME_CONFIG.sceneSequence;

/**
 * @typedef {Object} StageResult
 * @property {string} questionSetId
 * @property {number} questionSetNumber
 * @property {number} stage
 * @property {Choice} choice
 * @property {'input' | 'timeout'} source
 * @property {number} hesitationPercent
 * @property {number} responseTimeMs
 * @property {string} leftLabel
 * @property {string} rightLabel
 * @property {string} [variantId]
 */

/**
 * @typedef {Object} StageSequenceEntry
 * @property {QuestionSet} questionSet
 * @property {number} questionSetNumber
 * @property {StageInfo} stage
 */

/**
 * Small state machine responsible for scene timing, state, and rendering.
 */
export class SceneManager {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.root
   * @param {readonly QuestionSet[]} [options.questionSets]
   * @param {readonly StageInfo[]} [options.stages] legacy single-set input
   * @param {Partial<typeof DEFAULT_SCENE_DURATIONS>} [options.durations]
   * @param {readonly Object[]} [options.sceneSequence]
   * @param {number} [options.choiceHoldDurationMs]
   * @param {typeof CONTENT.diagnosis} [options.diagnosis]
   * @param {() => number} [options.random]
   * @param {Choice} [options.defaultChoice]
   * @param {() => number} [options.now]
   * @param {AudioManager} [options.audioManager]
   * @param {boolean} [options.audioMuted]
   * @param {{images?: Record<string, Object>, audio?: Record<string, Object>}} [options.customAssets]
   */
  constructor({
    root,
    questionSets = QUESTION_SETS,
    stages,
    durations = {},
    sceneSequence = DEFAULT_SCENE_SEQUENCE,
    choiceHoldDurationMs = CHOICE_HOLD_DURATION_MS,
    diagnosis = CONTENT.diagnosis,
    defaultChoice = 'self',
    now = () => Date.now(),
    random = Math.random,
    audioManager = null,
    audioMuted = false,
    customAssets = {},
  }) {
    if (!root) throw new TypeError('SceneManager requires a root element.');
    if (!VALID_CHOICES.has(defaultChoice)) {
      throw new TypeError('SceneManager received an invalid default choice.');
    }

    const normalizedQuestionSets = stages
      ? [{
          id: 'legacy_set',
          label: CONTENT.questionSets.legacyLabel,
          stages,
        }]
      : questionSets;
    if (
      !normalizedQuestionSets.length ||
      normalizedQuestionSets.some((questionSet) => !questionSet.stages.length)
    ) {
      throw new TypeError('SceneManager requires at least one non-empty question set.');
    }

    this.root = root;
    this.questionSets = normalizedQuestionSets;
    this.sceneSequence = Array.isArray(sceneSequence) && sceneSequence.length
      ? sceneSequence
      : null;
    this.sceneIndex = -1;
    this.random = random;
    /** @type {StageSequenceEntry[]} */
    this.stageSequence = this.buildStageSequence();
    // Compatibility view for existing integrations; progression uses stageSequence.
    this.stages = this.stageSequence.map((entry) => entry.stage);
    const legacyIntroDuration = Number(durations.sceneIntro);
    const legacyIntroHalf = Number.isFinite(legacyIntroDuration)
      ? legacyIntroDuration / 2
      : null;
    this.durations = {
      ...DEFAULT_SCENE_DURATIONS,
      ...durations,
      sceneIntroCrowded:
        durations.sceneIntroCrowded ?? legacyIntroHalf ?? DEFAULT_SCENE_DURATIONS.sceneIntroCrowded,
      sceneIntroEmpty:
        durations.sceneIntroEmpty ?? legacyIntroHalf ?? DEFAULT_SCENE_DURATIONS.sceneIntroEmpty,
    };
    this.choiceHoldDurationMs = choiceHoldDurationMs;
    this.diagnosis = diagnosis;
    this.defaultChoice = defaultChoice;
    this.now = now;
    this.state = SCENE_STATES.ATTRACT;
    this.stageIndex = 0;
    /** @type {Choice | null} */
    this.pendingChoice = null;
    /** @type {'input' | 'timeout' | null} */
    this.pendingSource = null;
    this.pendingHesitationPercent = 0;
    this.pendingResponseTimeMs = 0;
    this.inputStartedAt = null;
    this.introFrameIndex = 0;
    /** @type {StageResult[]} */
    this.results = [];
    this.timerId = null;
    this.started = false;
    this.listeners = new Set();
    this.windowRef = root.ownerDocument?.defaultView ?? null;
    this.assetManifest = runtimeImageManifest(customAssets);
    this.audioManifest = runtimeAudioManifest(customAssets);
    this.audioManager = audioManager ?? new AudioManager({
      windowRef: this.windowRef,
      manifest: this.audioManifest,
    });
    this.audioManager.setMuted(audioMuted);
    this.backgroundPreloadCache = new Map();
    this.backgroundRequestId = 0;
    this.requestedBackgroundKey = null;
    this.currentBackgroundKey = null;
    this.activeBackgroundFrame = -1;
    this.setupPersistentLayers();
    this.handleAttractKeyDown = this.handleAttractKeyDown.bind(this);
    this.handleSceneAdvanceKeyDown = this.handleSceneAdvanceKeyDown.bind(this);
  }

  buildStageSequence() {
    return this.questionSets.flatMap((questionSet, questionSetIndex) =>
      questionSet.stages.map((stage) => {
        const variants = Array.isArray(stage.variants) ? stage.variants : [];
        const presentationType = stage.presentationType ?? stage.selectionMode ?? 'random';
        const randomIndex = variants.length
          ? Math.min(variants.length - 1, Math.floor(this.random() * variants.length))
          : -1;
        const variant = presentationType === 'random'
          ? variants[randomIndex]
          : variants.find((candidate) => candidate.infoLevel === presentationType) ?? variants[randomIndex];
        const resolvedStage = variant
          ? {
              ...stage,
              ...variant,
              stage: stage.stage,
              variantId: variant.id,
            }
          : stage;
        return {
          questionSet,
          questionSetNumber: questionSetIndex + 1,
          stage: resolvedStage,
        };
      }),
    );
  }

  setupPersistentLayers() {
    const documentRef = this.root.ownerDocument;
    const existingBackground = this.root.querySelector?.('#background-layer');
    const existingUi = this.root.querySelector?.('#ui-layer');

    this.backgroundLayer = existingBackground ?? documentRef.createElement('div');
    this.backgroundLayer.id = 'background-layer';
    this.backgroundLayer.setAttribute('aria-hidden', 'true');

    this.uiLayer = existingUi ?? documentRef.createElement('div');
    this.uiLayer.id = 'ui-layer';
    this.uiLayer.setAttribute('aria-live', 'polite');

    if (!existingBackground || !existingUi) {
      this.root.replaceChildren(this.backgroundLayer, this.uiLayer);
    }

    this.backgroundFrames = [0, 1].map((index) => {
      const image = documentRef.createElement('img');
      image.className = 'background-layer__image';
      image.dataset.frame = String(index);
      image.alt = '';
      return image;
    });
    this.backgroundOverlay = documentRef.createElement('div');
    this.backgroundOverlay.className = 'background-layer__overlay';
    this.backgroundFallback = documentRef.createElement('span');
    this.backgroundFallback.className = 'background-layer__fallback';
    this.backgroundLayer.replaceChildren(
      ...this.backgroundFrames,
      this.backgroundOverlay,
      this.backgroundFallback,
    );
  }

  /**
   * Preload one manifest image. Resolved promises are cached for the session.
   *
   * @param {string} assetKey
   * @param {AssetInfo | null} [assetOverride]
   * @param {string} [cacheKey]
   * @returns {Promise<boolean>}
   */
  preloadBackground(assetKey, assetOverride = null, cacheKey = assetKey) {
    if (this.backgroundPreloadCache.has(cacheKey)) {
      return this.backgroundPreloadCache.get(cacheKey);
    }

    const asset = assetOverride ?? this.assetManifest[assetKey];
    if (!asset?.src || asset.type !== 'image') {
      const unavailable = Promise.resolve(false);
      this.backgroundPreloadCache.set(cacheKey, unavailable);
      return unavailable;
    }

    const ImageConstructor = this.windowRef?.Image;
    if (!ImageConstructor) {
      const testEnvironmentResult = Promise.resolve(true);
      this.backgroundPreloadCache.set(cacheKey, testEnvironmentResult);
      return testEnvironmentResult;
    }

    const promise = new Promise((resolve) => {
      const image = new ImageConstructor();
      image.onload = async () => {
        try {
          await image.decode?.();
        } catch {
          // onload already confirms that the image is usable.
        }
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = asset.src;
    });
    this.backgroundPreloadCache.set(cacheKey, promise);
    return promise;
  }

  preloadBackgrounds() {
    return Promise.all(
      [
        'bg_train_loop',
        'train_far_full',
        'train_far_empty',
        'train_close_full',
      ].map((assetKey) => this.preloadBackground(assetKey)),
    );
  }

  /**
   * Update only when the requested background changes. The image is decoded
   * before the inactive persistent frame is faded in.
   *
   * @param {string} assetKey
   * @param {AssetInfo | null} [assetOverride]
   * @param {string} [cacheKey]
   * @returns {Promise<boolean>}
   */
  async updateBackground(assetKey, assetOverride = null, cacheKey = assetKey) {
    if (cacheKey === this.requestedBackgroundKey) {
      return cacheKey === this.currentBackgroundKey;
    }

    this.requestedBackgroundKey = cacheKey;
    const requestId = ++this.backgroundRequestId;
    const loaded = await this.preloadBackground(assetKey, assetOverride, cacheKey);
    if (requestId !== this.backgroundRequestId) return false;

    const asset = assetOverride ?? this.assetManifest[assetKey];
    if (!loaded || !asset) {
      this.currentBackgroundKey = null;
      this.backgroundLayer.classList.add('background-layer--fallback');
      this.backgroundFallback.textContent =
        asset?.fallback?.label ?? CONTENT.assetFallbacks.unspecified;
      this.backgroundLayer.style.setProperty(
        '--background-fallback-color',
        asset?.fallback?.color ?? '#101820',
      );
      this.backgroundFrames.forEach((frame) =>
        frame.classList.remove('background-layer__image--active'),
      );
      return false;
    }

    const nextFrameIndex = this.activeBackgroundFrame === 0 ? 1 : 0;
    const nextFrame = this.backgroundFrames[nextFrameIndex];
    const previousFrame =
      this.activeBackgroundFrame < 0
        ? null
        : this.backgroundFrames[this.activeBackgroundFrame];

    if (nextFrame.dataset.assetKey !== cacheKey) {
      nextFrame.src = asset.src;
      nextFrame.dataset.assetKey = cacheKey;
    }
    nextFrame.setAttribute('aria-label', asset.fallback.label);
    this.backgroundLayer.classList.remove('background-layer--fallback');

    const applyCrossfade = () => {
      if (requestId !== this.backgroundRequestId) return;
      nextFrame.classList.add('background-layer__image--active');
      previousFrame?.classList.remove('background-layer__image--active');
      this.activeBackgroundFrame = nextFrameIndex;
      this.currentBackgroundKey = cacheKey;
      this.backgroundLayer.dataset.assetKey = cacheKey;
    };

    if (this.activeBackgroundFrame < 0) {
      applyCrossfade();
    } else if (this.windowRef?.requestAnimationFrame) {
      this.windowRef.requestAnimationFrame(applyCrossfade);
    } else {
      applyCrossfade();
    }
    return true;
  }

  syncBackgroundForState() {
    if (this.activeScene?.backgroundAssetKey) {
      if (this.activeScene.backgroundImageSrc) {
        const fallback = this.assetManifest[this.activeScene.backgroundAssetKey]?.fallback ?? {
          label: this.activeScene.backgroundImageName || this.activeScene.label,
          color: '#101820',
        };
        return this.updateBackground(
          this.activeScene.backgroundAssetKey,
          {
            type: 'image',
            src: this.activeScene.backgroundImageSrc,
            fallback,
          },
          `uploaded-scene-${this.sceneIndex}-${this.activeScene.backgroundImageName}`,
        );
      }
      return this.updateBackground(this.activeScene.backgroundAssetKey);
    }
    if (this.state === SCENE_STATES.ATTRACT) {
      return this.updateBackground('bg_train_loop');
    }
    if (this.state === SCENE_STATES.SCENE_INTRO) {
      return this.updateBackground(
        this.introFrameIndex === 0 ? 'train_far_full' : 'train_far_empty',
      );
    }
    if (
      this.state === SCENE_STATES.STAGE_WAIT_INPUT ||
      this.state === SCENE_STATES.STAGE_SELECTION_FEEDBACK ||
      this.state === SCENE_STATES.STAGE_CONFIRM
    ) {
      return this.updateBackground('train_close_full');
    }
    if (
      this.state === SCENE_STATES.SESSION_SUMMARY ||
      this.state === SCENE_STATES.SESSION_END
    ) {
      return this.updateBackground('train_far_empty');
    }
    return Promise.resolve(false);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.audioManager.start(this.windowRef);
    this.windowRef?.addEventListener('keydown', this.handleAttractKeyDown);
    this.windowRef?.addEventListener('keydown', this.handleSceneAdvanceKeyDown);
    void this.preloadBackgrounds();
    this.enterState(SCENE_STATES.ATTRACT);
  }

  destroy() {
    this.clearStateTimer();
    this.windowRef?.removeEventListener('keydown', this.handleAttractKeyDown);
    this.windowRef?.removeEventListener('keydown', this.handleSceneAdvanceKeyDown);
    this.audioManager.destroy();
    this.listeners.clear();
    this.started = false;
  }

  /** @returns {{ value: string, context: Object }} */
  getSnapshot() {
    return {
      value: this.state,
      context: {
        sceneIndex: this.sceneIndex,
        currentScene: this.activeScene,
        acceptsChoice:
          this.activeScene?.behavior === 'stage_input' &&
          this.state !== SCENE_STATES.STAGE_SELECTION_FEEDBACK,
        stageIndex: this.stageIndex,
        questionSetIndex: (this.currentEntry?.questionSetNumber ?? 1) - 1,
        currentQuestionSet: this.currentEntry?.questionSet ?? null,
        currentStage: this.currentEntry?.stage ?? null,
        introFrameIndex: this.introFrameIndex,
        pendingChoice: this.pendingChoice,
        hesitationPercent: this.pendingHesitationPercent,
        results: [...this.results],
      },
    };
  }

  /** @returns {StageSequenceEntry | null} */
  get currentEntry() {
    return this.stageSequence[this.stageIndex] ?? null;
  }

  get activeScene() {
    return this.sceneSequence?.[this.sceneIndex] ?? null;
  }

  notifySnapshot() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  beginSequenceSession() {
    this.startSequenceAt(this.sceneSequence[0]?.id);
  }

  /** Start a preview/session from any configured scene id. */
  startSequenceAt(sceneId) {
    if (!this.sceneSequence?.length) return false;
    const targetIndex = Math.max(0, this.sceneSequence.findIndex((scene) => scene.id === sceneId));
    this.clearStateTimer();
    this.stageSequence = this.buildStageSequence();
    this.stages = this.stageSequence.map((entry) => entry.stage);
    this.results = [];
    this.pendingChoice = null;
    this.pendingSource = null;
    this.pendingHesitationPercent = 0;
    this.pendingResponseTimeMs = 0;
    this.inputStartedAt = null;
    const precedingStageInputs = this.sceneSequence
      .slice(0, targetIndex)
      .filter((scene) => scene.behavior === 'stage_input').length;
    this.stageIndex = precedingStageInputs - 1;
    this.sceneIndex = targetIndex;
    this.enterSequenceScene();
    return true;
  }

  enterSequenceScene() {
    this.clearStateTimer();
    const scene = this.activeScene;
    if (!scene) {
      this.sceneIndex = -1;
      this.enterState(SCENE_STATES.ATTRACT);
      return;
    }

    if (scene.behavior === 'stage_input') {
      this.stageIndex += 1;
      if (!this.currentEntry) {
        this.advanceSequenceScene();
        return;
      }
      this.inputStartedAt = this.now();
      this.pendingChoice = null;
      this.pendingSource = null;
      this.pendingHesitationPercent = 0;
      this.pendingResponseTimeMs = 0;
    }

    this.state = scene.id;
    this.audioManager.enterScene(scene.soundAsset);
    void this.syncBackgroundForState();
    this.render();
    this.notifySnapshot();
    if (scene.behavior !== 'stage_input' && !scene.advanceOnInput) {
      this.schedule('SEQUENCE_TIMEOUT', scene.durationMs);
    }
  }

  advanceSequenceScene() {
    this.sceneIndex += 1;
    this.enterSequenceScene();
  }

  sendSequenceEvent(event) {
    if (this.state === SCENE_STATES.ATTRACT) {
      if (['START_SESSION', 'MOCK_INPUT_START'].includes(event.type)) {
        this.beginSequenceSession();
      }
      return;
    }

    const scene = this.activeScene;
    if (!scene) return;
    if (this.state === SCENE_STATES.STAGE_SELECTION_FEEDBACK) {
      if (event.type === 'SELECTION_FEEDBACK_COMPLETE') this.advanceSequenceScene();
      return;
    }
    if (
      event.type === 'CHOICE_HOLD_PROGRESS' &&
      scene.behavior === 'stage_input' &&
      VALID_CHOICES.has(event.choice)
    ) {
      this.updateChoiceHoldProgress(event.choice, event.progress ?? 0);
      return;
    }

    if (scene.behavior === 'stage_input') {
      if (event.type === 'CHOICE_MADE' && VALID_CHOICES.has(event.choice)) {
        this.audioManager.playActionSe(scene.soundAsset);
        this.pendingChoice = event.choice;
        this.pendingSource = 'input';
        this.pendingResponseTimeMs = Math.max(0, this.now() - this.inputStartedAt);
        this.pendingHesitationPercent = calculateHesitationDegree(
          this.pendingResponseTimeMs,
          scene.durationMs,
        );
        this.recordPendingChoice();
        this.clearStateTimer();
        this.state = SCENE_STATES.STAGE_SELECTION_FEEDBACK;
        this.render();
        this.notifySnapshot();
        this.schedule('SELECTION_FEEDBACK_COMPLETE', this.durations.selectionFeedback);
      }
      return;
    }

    const shouldAdvance =
      (event.type === 'SEQUENCE_TIMEOUT' && !scene.advanceOnInput) ||
      (event.type === 'ADVANCE_SCENE' && scene.advanceOnInput);
    if (shouldAdvance) {
      if (scene.behavior === 'end') {
        this.sceneIndex = -1;
        this.enterState(SCENE_STATES.ATTRACT);
      } else {
        this.advanceSequenceScene();
      }
    }
  }

  /**
   * @param {(snapshot: ReturnType<SceneManager['getSnapshot']>) => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  setAudioMuted(muted) {
    this.audioManager.setMuted(muted);
  }

  /**
   * @param {{ type: string, choice?: Choice, progress?: number }} event
   */
  send(event) {
    if (!event?.type) return;
    if (this.sceneSequence) {
      this.sendSequenceEvent(event);
      return;
    }
    if (
      event.type === 'CHOICE_HOLD_PROGRESS' &&
      this.state === SCENE_STATES.STAGE_WAIT_INPUT &&
      VALID_CHOICES.has(event.choice)
    ) {
      this.updateChoiceHoldProgress(event.choice, event.progress ?? 0);
      return;
    }

    switch (this.state) {
      case SCENE_STATES.ATTRACT:
        if (['START_SESSION', 'MOCK_INPUT_START'].includes(event.type)) {
          this.enterState(SCENE_STATES.SESSION_START);
        }
        break;
      case SCENE_STATES.SESSION_START:
        if (event.type === 'SESSION_READY') {
          this.enterState(SCENE_STATES.SCENE_INTRO);
        }
        break;
      case SCENE_STATES.SCENE_INTRO:
        if (event.type === 'INTRO_FRAME_NEXT' && this.introFrameIndex === 0) {
          this.clearStateTimer();
          this.introFrameIndex = 1;
          void this.syncBackgroundForState();
          this.render();
          const snapshot = this.getSnapshot();
          this.listeners.forEach((listener) => listener(snapshot));
          this.schedule('INTRO_TIMEOUT', this.durations.sceneIntroEmpty);
        } else if (event.type === 'INTRO_TIMEOUT') {
          this.enterState(SCENE_STATES.STAGE_WAIT_INPUT);
        }
        break;
      case SCENE_STATES.STAGE_WAIT_INPUT:
        if (event.type === 'CHOICE_MADE' && VALID_CHOICES.has(event.choice)) {
          this.pendingChoice = event.choice;
          this.pendingSource = 'input';
          this.pendingResponseTimeMs = Math.max(0, this.now() - this.inputStartedAt);
          this.pendingHesitationPercent = calculateHesitationDegree(
            this.pendingResponseTimeMs,
            this.durations.stageWaitInput,
          );
          /*
           * STAGE_HESITATION is currently disabled.
           * To restore it, re-enable the state and transition here before
           * STAGE_CONFIRM.
           */
          this.enterState(SCENE_STATES.STAGE_SELECTION_FEEDBACK);
        }
        break;
      case SCENE_STATES.STAGE_SELECTION_FEEDBACK:
        if (event.type === 'SELECTION_FEEDBACK_COMPLETE') {
          this.enterState(SCENE_STATES.STAGE_CONFIRM);
        }
        break;
      /*
       * case SCENE_STATES.STAGE_HESITATION:
       *   if (['HESITATION_COMPLETE', 'SKIP_HESITATION'].includes(event.type)) {
       *     this.enterState(SCENE_STATES.STAGE_CONFIRM);
       *   }
       *   break;
       */
      case SCENE_STATES.STAGE_CONFIRM:
        if (event.type === 'CHOICE_RECORDED') {
          if (this.stageIndex < this.stageSequence.length - 1) {
            this.stageIndex += 1;
            this.pendingChoice = null;
            this.pendingSource = null;
            this.pendingHesitationPercent = 0;
            this.pendingResponseTimeMs = 0;
            this.enterState(SCENE_STATES.STAGE_WAIT_INPUT);
          } else {
            this.enterState(SCENE_STATES.SESSION_SUMMARY);
          }
        }
        break;
      case SCENE_STATES.SESSION_SUMMARY:
        if (event.type === 'SUMMARY_TIMEOUT' || event.type === 'SUMMARY_ADVANCE') {
          this.enterState(SCENE_STATES.SESSION_END);
        }
        break;
      case SCENE_STATES.SESSION_END:
        if (event.type === 'END_TIMEOUT') {
          this.enterState(SCENE_STATES.ATTRACT);
        }
        break;
    }
  }

  handleAttractKeyDown(event) {
    if (
      this.state === SCENE_STATES.ATTRACT &&
      ['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      this.send({ type: 'START_SESSION' });
    }
  }

  handleSceneAdvanceKeyDown(event) {
    if (
      event.defaultPrevented ||
      event.repeat ||
      !['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(event.key)
    ) return;

    if (this.sceneSequence) {
      const scene = this.activeScene;
      if (
        !scene?.advanceOnInput ||
        scene.behavior === 'stage_input' ||
        this.state === SCENE_STATES.STAGE_SELECTION_FEEDBACK
      ) return;
      event.preventDefault();
      this.send({ type: 'ADVANCE_SCENE' });
      return;
    }

    if (this.state === SCENE_STATES.SESSION_SUMMARY) {
      event.preventDefault();
      this.send({ type: 'SUMMARY_ADVANCE' });
    }
  }

  /**
   * Paint hold progress without re-rendering the UI layer.
   *
   * @param {Choice} choice
   * @param {number} progress
   */
  updateChoiceHoldProgress(choice, progress) {
    const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
    const targets = this.uiLayer.querySelectorAll?.(
      '[data-choice="' + choice + '"]',
    ) ?? [];
    targets.forEach((target) => {
      target.style.setProperty('--hold-progress', percent + '%');
      target.dataset.holdProgress = String(percent);
    });
  }

  clearStateTimer() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  schedule(eventType, delay) {
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.send({ type: eventType });
    }, Math.max(0, delay));
  }

  enterState(nextState) {
    this.clearStateTimer();
    this.state = nextState;

    if (nextState === SCENE_STATES.ATTRACT) this.audioManager.enterScene(null);

    if (nextState === SCENE_STATES.SESSION_START) {
      this.stageSequence = this.buildStageSequence();
      this.stages = this.stageSequence.map((entry) => entry.stage);
      this.stageIndex = 0;
      this.pendingChoice = null;
      this.pendingSource = null;
      this.pendingHesitationPercent = 0;
      this.pendingResponseTimeMs = 0;
      this.inputStartedAt = null;
      this.results = [];
    } else if (nextState === SCENE_STATES.SCENE_INTRO) {
      this.introFrameIndex = 0;
    } else if (nextState === SCENE_STATES.STAGE_WAIT_INPUT) {
      this.inputStartedAt = this.now();
    } else if (nextState === SCENE_STATES.STAGE_CONFIRM) {
      this.recordPendingChoice();
    }

    void this.syncBackgroundForState();
    this.render();
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));

    const timedTransitions = {
      [SCENE_STATES.SESSION_START]: ['SESSION_READY', this.durations.sessionStart],
      [SCENE_STATES.SCENE_INTRO]: ['INTRO_FRAME_NEXT', this.durations.sceneIntroCrowded],
      [SCENE_STATES.STAGE_SELECTION_FEEDBACK]: ['SELECTION_FEEDBACK_COMPLETE', this.durations.selectionFeedback],
      // STAGE_HESITATION timer is currently disabled.
      [SCENE_STATES.STAGE_CONFIRM]: ['CHOICE_RECORDED', this.durations.stageConfirm],
      [SCENE_STATES.SESSION_END]: ['END_TIMEOUT', this.durations.sessionEnd],
    };
    const transition = timedTransitions[nextState];
    if (transition && this.state === nextState) {
      this.schedule(transition[0], transition[1]);
    }
  }

  recordPendingChoice() {
    if (!this.pendingChoice || !this.pendingSource) return;
    const entry = this.currentEntry;
    if (!entry) return;
    const { questionSet, questionSetNumber, stage } = entry;
    const previous = this.results.findIndex(
      (result) =>
        result.questionSetId === questionSet.id && result.stage === stage.stage,
    );
    const result = {
      questionSetId: questionSet.id,
      questionSetNumber,
      stage: stage.stage,
      choice: this.pendingChoice,
      source: this.pendingSource,
      hesitationPercent: this.pendingHesitationPercent,
      responseTimeMs: this.pendingResponseTimeMs,
      leftLabel: stage.left.label,
      rightLabel: stage.right.label,
      variantId: stage.variantId,
    };
    if (previous === -1) this.results.push(result);
    else this.results[previous] = result;
  }

  createScreen(title, message) {
    const documentRef = this.root.ownerDocument;
    const screen = documentRef.createElement('section');
    screen.className = 'scene scene--' + this.state.toLowerCase();
    screen.dataset.state = this.state;

    if (String(title ?? '').trim()) {
      const heading = documentRef.createElement('h1');
      heading.className = 'scene__title';
      heading.textContent = title;
      screen.append(heading);
    }

    if (message) {
      const body = documentRef.createElement('p');
      body.className = 'scene__message';
      body.textContent = message;
      screen.append(body);
    }
    return screen;
  }

  renderSequenceScene() {
    const scene = this.activeScene;
    if (!scene) return;
    const documentRef = this.root.ownerDocument;
    let screen;

    if (
      scene.behavior === 'stage_input' &&
      this.state === SCENE_STATES.STAGE_SELECTION_FEEDBACK
    ) {
      const entry = this.currentEntry;
      if (!entry || !this.pendingChoice) return;
      screen = this.createScreen(
        selectedChoiceLabel(entry.stage, this.pendingChoice) +
          CONTENT.scenes.selectionFeedback.selectedSuffix,
        '',
      );
      screen.append(ChoiceSelectionFeedback({
        stageInfo: entry.stage,
        choice: this.pendingChoice,
        assetManifest: this.assetManifest,
        documentRef,
      }));
    } else if (scene.behavior === 'stage_input') {
      const entry = this.currentEntry;
      if (!entry) return;
      const defaultTitle = CONTENT.scenes.stage.questionSetPrefix;
      screen = this.createScreen(scene.title || defaultTitle, scene.message);
      screen.append(ChoicePrompt({
        stageInfo: entry.stage,
        documentRef,
        holdDurationMs: this.choiceHoldDurationMs,
        assetManifest: this.assetManifest,
      }));
    } else if (scene.behavior === 'summary') {
      const defaultMessage =
        CONTENT.scenes.summary.messagePrefix +
        this.questionSets.length +
        CONTENT.scenes.summary.setCountSuffix +
        this.results.length +
        CONTENT.scenes.summary.messageSuffix;
      screen = this.createScreen(
        scene.title || CONTENT.scenes.summary.title,
        scene.message || defaultMessage,
      );
      screen.append(TicketMock({
        results: this.results,
        questionSets: this.questionSets,
        diagnosisContent: this.diagnosis,
        documentRef,
      }));
    } else {
      screen = this.createScreen(scene.title, scene.message);
      if (scene.behavior === 'timed') {
        screen.classList.add('scene--subtitle');
      }
    }

    screen.dataset.sceneIndex = String(this.sceneIndex);
    screen.dataset.sceneBehavior = scene.behavior;
    this.uiLayer.replaceChildren(screen);
  }

  render() {
    if (this.activeScene) {
      this.renderSequenceScene();
      return;
    }
    const documentRef = this.root.ownerDocument;
    const entry = this.currentEntry ?? this.stageSequence[0];
    const stage = entry.stage;
    let screen;

    switch (this.state) {
      case SCENE_STATES.ATTRACT: {
        screen = this.createScreen(
          CONTENT.scenes.attract.title,
          CONTENT.scenes.attract.message,
        );
        const startButton = documentRef.createElement('button');
        startButton.className = 'scene__action';
        startButton.type = 'button';
        startButton.textContent = CONTENT.scenes.attract.startButton;
        startButton.addEventListener('click', () => this.send({ type: 'START_SESSION' }));
        screen.append(startButton);
        break;
      }
      case SCENE_STATES.SESSION_START:
        screen = this.createScreen(
          CONTENT.scenes.sessionStart.title,
          CONTENT.scenes.sessionStart.message,
        );
        break;
      case SCENE_STATES.SCENE_INTRO:
        {
          const isEmptyFrame = this.introFrameIndex === 1;
          screen = this.createScreen(
            isEmptyFrame
              ? CONTENT.scenes.intro.emptyTitle
              : CONTENT.scenes.intro.fullTitle,
            isEmptyFrame
              ? CONTENT.scenes.intro.emptyMessage
              : CONTENT.scenes.intro.fullMessage,
          );
        }
        break;
      case SCENE_STATES.STAGE_WAIT_INPUT:
        screen = this.createScreen(
          CONTENT.scenes.stage.questionSetPrefix,
          CONTENT.scenes.stage.inputHint,
        );
        screen.append(ChoicePrompt({
          stageInfo: stage,
          documentRef,
          holdDurationMs: this.choiceHoldDurationMs,
          assetManifest: this.assetManifest,
        }));
        break;
      case SCENE_STATES.STAGE_SELECTION_FEEDBACK:
        screen = this.createScreen(
          selectedChoiceLabel(stage, this.pendingChoice ?? this.defaultChoice) +
            CONTENT.scenes.selectionFeedback.selectedSuffix,
          '',
        );
        screen.append(ChoiceSelectionFeedback({
          stageInfo: stage,
          choice: this.pendingChoice ?? this.defaultChoice,
          assetManifest: this.assetManifest,
          documentRef,
        }));
        break;
      /*
       * case SCENE_STATES.STAGE_HESITATION:
       *   screen = this.createScreen(
       *     CONTENT.scenes.hesitation.title,
       *     CONTENT.scenes.hesitation.message,
       *   );
       *   screen.append(HesitationEffect({
       *     choice: this.pendingChoice ?? this.defaultChoice,
       *     documentRef,
       *   }));
       *   break;
       */
      case SCENE_STATES.STAGE_CONFIRM:
        screen = this.createScreen(
          CONTENT.scenes.confirm.title,
          CONTENT.scenes.confirm.message,
        );
        break;
      case SCENE_STATES.SESSION_SUMMARY: {
        screen = this.createScreen(
          CONTENT.scenes.summary.title,
          CONTENT.scenes.summary.messagePrefix +
            this.questionSets.length +
            CONTENT.scenes.summary.setCountSuffix +
            this.stageSequence.length +
            CONTENT.scenes.summary.messageSuffix,
        );
        screen.append(TicketMock({
          results: this.results,
          questionSets: this.questionSets,
          diagnosisContent: this.diagnosis,
          documentRef,
        }));
        break;
      }
      case SCENE_STATES.SESSION_END:
        screen = this.createScreen(
          CONTENT.scenes.end.title,
          CONTENT.scenes.end.message,
        );
        break;
      default:
        screen = this.createScreen(CONTENT.scenes.loading.title, '');
    }

    this.uiLayer.replaceChildren(screen);
  }
}

/**
 * Wire the state machine, keyboard input, and initial screen together.
 *
 * @param {HTMLElement} root
 * @param {ConstructorParameters<typeof SceneManager>[0]} [options]
 */
export function bootstrapApp(root, options = {}) {
  const manager = new SceneManager({ ...options, root });
  setChoiceStateMachine(manager);
  const unregisterKeyboard = registerKeyboardChoiceInput({
    target: manager.windowRef,
    holdDurationMs: manager.choiceHoldDurationMs,
  });
  manager.start();

  return {
    manager,
    destroy() {
      unregisterKeyboard();
      manager.destroy();
      setChoiceStateMachine(null);
    },
  };
}
