import { registerChoiceInput } from '../main.js';


// ============================================================
// Tsurikawa BLE Adapter
//
// Rocking Train 本体代码不修改
//
// BLE Characteristic 01
//   float forceKg
//   float heightCm
//
// BLE Characteristic 02
//   float accX
//   float accY
//   float accZ
// ============================================================


// ============================================================
// BLE UUID
// ============================================================

const SERVICE_UUID =
  '19b10000-e8f2-537e-4f6c-d104768a1214';


// Force + Height
const FORCE_CHARACTERISTIC_UUID =
  '19b10001-e8f2-537e-4f6c-d104768a1214';


// ACC X / Y / Z
const ACC_CHARACTERISTIC_UUID =
  '19b10002-e8f2-537e-4f6c-d104768a1214';


// ============================================================
// START
// ============================================================

// 「体験を始める」画面で
// 拉力达到 1.0 kgf 后开始体验
const START_FORCE_KG = 1.0;


// ============================================================
// ANGLE INPUT
// ============================================================

// ±8°以内は Neutral
const DEAD_ZONE_DEG = 8;


// 一次选择结束后
// 回到 ±5° 内才能进行下一次角度输入
const RESET_ZONE_DEG = 5;


// 30° 达到最大输入速度
const MAX_ANGLE_DEG = 30;


// progress / second
const MIN_SPEED = 0.33;
const MAX_SPEED = 1.25;


// 角度越大，加速越明显
const SPEED_EXPONENT = 1.6;


// 角度 Low-pass Filter
const FILTER_ALPHA = 0.18;


// ============================================================
// DIRECTION
// ============================================================

// 当前实际硬件左右方向是反的
const INVERT_DIRECTION = true;


// ============================================================
// KEYBOARD
// ============================================================

// true:
// 屏蔽原来的 ← → ↓
//
// false:
// 调试时可以同时使用键盘
const DISABLE_KEYBOARD = true;


// ============================================================
// BLE STATE
// ============================================================

let device = null;

let accCharacteristic = null;

let forceCharacteristic = null;


// ============================================================
// ROCKING TRAIN CALLBACK
// ============================================================

let onChoiceCallback = null;

let onProgressCallback = null;


// ============================================================
// SENSOR STATE
// ============================================================

let currentForceKg = 0;

let currentHeightCm = 0;

let lastRawAngleDeg = null;

let zeroAngleDeg = null;

let filteredAngleDeg = 0;


// ============================================================
// CHOICE STATE
// ============================================================

let activeChoice = null;

let progress = 0;

let lastTimestamp = null;

let choiceArmed = true;


// ============================================================
// UTILITY
// ============================================================

function clamp(value, min, max) {

  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}


// ============================================================
// ACC → ANGLE
//
// 当前安装方向：
//
// 垂直:
// AY ≈ 1g
//
// 左右倾斜:
// AX 发生变化
//
// angle = atan2(AX, AY)
// ============================================================

function calculateRawAngle(
  ax,
  ay
) {

  return (
    Math.atan2(
      ax,
      ay
    )
    *
    180
    /
    Math.PI
  );
}


// ============================================================
// ANGLE → INPUT SPEED
// ============================================================

function angleToSpeed(
  angleDeg
) {

  const magnitude =
    Math.abs(
      angleDeg
    );


  if (
    magnitude <=
    DEAD_ZONE_DEG
  ) {

    return 0;
  }


  const normalized =
    clamp(

      (
        magnitude -
        DEAD_ZONE_DEG
      )
      /
      (
        MAX_ANGLE_DEG -
        DEAD_ZONE_DEG
      ),

      0,

      1
    );


  const curved =
    Math.pow(
      normalized,
      SPEED_EXPONENT
    );


  return (
    MIN_SPEED
    +
    (
      MAX_SPEED -
      MIN_SPEED
    )
    *
    curved
  );
}


// ============================================================
// HARDWARE PANEL
// ============================================================

function createHardwarePanel() {

  const panel =
    document.createElement(
      'div'
    );


  Object.assign(
    panel.style,
    {

      position: 'fixed',

      right: '16px',

      bottom: '16px',

      zIndex: '9999',

      display: 'grid',

      gap: '6px',

      minWidth: '190px',

      padding: '12px 14px',

      borderRadius: '10px',

      background:
        'rgba(0, 0, 0, 0.78)',

      color: 'white',

      fontFamily:
        'system-ui, sans-serif',

      fontSize: '12px',

      lineHeight: '1.5'

    }
  );


  // ----------------------------------------------------------
  // Connection
  // ----------------------------------------------------------

  const status =
    document.createElement(
      'div'
    );


  status.textContent =
    '吊り革：未接続';


  // ----------------------------------------------------------
  // Force
  // ----------------------------------------------------------

  const force =
    document.createElement(
      'div'
    );


  force.textContent =
    '拉力: -- kgf';


  // ----------------------------------------------------------
  // Height
  // ----------------------------------------------------------

  const height =
    document.createElement(
      'div'
    );


  height.textContent =
    '高度: -- cm';


  // ----------------------------------------------------------
  // Angle
  // ----------------------------------------------------------

  const angle =
    document.createElement(
      'div'
    );


  angle.textContent =
    '角度: --°';


  // ----------------------------------------------------------
  // Input
  // ----------------------------------------------------------

  const input =
    document.createElement(
      'div'
    );


  input.textContent =
    '输入: --';


  // ----------------------------------------------------------
  // Connect Button
  // ----------------------------------------------------------

  const connectButton =
    document.createElement(
      'button'
    );


  connectButton.textContent =
    '吊り革を接続';


  connectButton.style.padding =
    '6px 10px';


  connectButton.style.cursor =
    'pointer';


  // ----------------------------------------------------------
  // Zero Button
  // ----------------------------------------------------------

  const zeroButton =
    document.createElement(
      'button'
    );


  zeroButton.textContent =
    '0° 校正';


  zeroButton.disabled =
    true;


  zeroButton.style.padding =
    '6px 10px';


  zeroButton.style.cursor =
    'pointer';


  // ----------------------------------------------------------

  panel.append(

    status,

    force,

    height,

    angle,

    input,

    connectButton,

    zeroButton

  );


  document.body.append(
    panel
  );


  return {

    panel,

    status,

    force,

    height,

    angle,

    input,

    connectButton,

    zeroButton

  };
}


// ============================================================
// CREATE UI
// ============================================================

const ui =
  createHardwarePanel();


// ============================================================
// ZERO CALIBRATION
// ============================================================

function calibrateZero() {

  if (
    lastRawAngleDeg === null
  ) {

    return;
  }


  zeroAngleDeg =
    lastRawAngleDeg;


  filteredAngleDeg =
    0;


  progress =
    0;


  activeChoice =
    null;


  choiceArmed =
    true;


  ui.angle.textContent =
    '角度: 0.0°';


  ui.input.textContent =
    '输入: Ready';
}


// ============================================================
// START EXPERIENCE BY FORCE
//
// 拉力只在
// 「体験を始める」画面
// 有效
//
// 进入下一个画面以后
// Force 不再作为 Input
// ============================================================

function checkStartByForce(
  forceKg
) {

  // ----------------------------------------------------------
  // 未达到 1kgf
  // ----------------------------------------------------------

  if (
    forceKg <
    START_FORCE_KG
  ) {

    return;
  }


  // ----------------------------------------------------------
  // 原网页的「体験を始める」按钮
  //
  // 这个按钮只存在于 ATTRACT 页面
  // ----------------------------------------------------------

  const startButton =
    document.querySelector(
      '.scene__action'
    );


  // ----------------------------------------------------------
  // 已经进入体验
  //
  // startButton 不存在
  // 所以 Force 什么都不会做
  // ----------------------------------------------------------

  if (
    !startButton
  ) {

    return;
  }


  // ----------------------------------------------------------
  // Debug Display
  // ----------------------------------------------------------

  ui.input.textContent =
    `START — ${forceKg.toFixed(2)} kgf`;


  console.log(
    'Experience started by force:',
    forceKg,
    'kgf'
  );


  // ----------------------------------------------------------
  // 直接触发原网页自己的开始按钮
  //
  // main.js 不需要修改
  // ----------------------------------------------------------

  startButton.click();
}


// ============================================================
// FORCE + HEIGHT BLE PACKET
//
// 8 bytes:
//
// byte 0 - 3
// float forceKg
//
// byte 4 - 7
// float heightCm
//
// little endian
// ============================================================

function handleForce(
  event
) {

  const view =
    event
      .target
      .value;


  // ----------------------------------------------------------
  // Packet Check
  // ----------------------------------------------------------

  if (
    view.byteLength <
    8
  ) {

    console.warn(
      'Force packet too short:',
      view.byteLength
    );


    return;
  }


  // ----------------------------------------------------------
  // Force
  // ----------------------------------------------------------

  const forceKg =
    view.getFloat32(
      0,
      true
    );


  // ----------------------------------------------------------
  // Height
  // ----------------------------------------------------------

  const heightCm =
    view.getFloat32(
      4,
      true
    );


  // ----------------------------------------------------------
  // Save Current Value
  // ----------------------------------------------------------

  currentForceKg =
    forceKg;


  currentHeightCm =
    heightCm;


  // ----------------------------------------------------------
  // Display
  // ----------------------------------------------------------

  ui.force.textContent =
    `拉力: ${forceKg.toFixed(2)} kgf`;


  ui.height.textContent =
    `高度: ${heightCm.toFixed(1)} cm`;


  // ----------------------------------------------------------
  // Force只负责开始
  // ----------------------------------------------------------

  checkStartByForce(
    forceKg
  );
}


// ============================================================
// PROCESS ANGLE
// ============================================================

function processAngle(
  angleDeg,
  timestamp
) {

  // ==========================================================
  // DELTA TIME
  // ==========================================================

  if (
    lastTimestamp === null
  ) {

    lastTimestamp =
      timestamp;


    return;
  }


  const dt =
    clamp(

      (
        timestamp -
        lastTimestamp
      )
      /
      1000,

      0,

      0.1
    );


  lastTimestamp =
    timestamp;


  // ==========================================================
  // IMPORTANT
  //
  // 只有问题选择页面
  // 才允许 Angle 做 Input
  // ==========================================================

  const choicePrompt =
    document.querySelector(
      '.choice-prompt'
    );


  // ----------------------------------------------------------
  // 不是 A/B 选择画面
  // ----------------------------------------------------------

  if (
    !choicePrompt
  ) {

    if (
      activeChoice
    ) {

      onProgressCallback?.(
        activeChoice,
        0
      );
    }


    activeChoice =
      null;


    progress =
      0;


    choiceArmed =
      true;


    return;
  }


  // ==========================================================
  // CHOICE RE-ARM
  //
  // 一次 A/B 选择完成以后
  // 必须先把吊环放回中央
  // ==========================================================

  if (
    !choiceArmed
  ) {

    if (
      Math.abs(
        angleDeg
      )
      <=
      RESET_ZONE_DEG
    ) {

      choiceArmed =
        true;


      progress =
        0;


      activeChoice =
        null;


      ui.input.textContent =
        '输入: Ready';

    }


    return;
  }


  // ==========================================================
  // NEUTRAL
  // ==========================================================

  if (
    Math.abs(
      angleDeg
    )
    <=
    DEAD_ZONE_DEG
  ) {

    if (
      activeChoice
    ) {

      onProgressCallback?.(
        activeChoice,
        0
      );

    }


    activeChoice =
      null;


    progress =
      0;


    ui.input.textContent =
      '输入: Neutral';


    return;
  }


  // ==========================================================
  // DIRECTION
  // ==========================================================

  let choice =

    angleDeg < 0

      ? 'left'

      : 'right';


  // ==========================================================
  // INVERT HARDWARE DIRECTION
  // ==========================================================

  if (
    INVERT_DIRECTION
  ) {

    choice =

      choice === 'left'

        ? 'right'

        : 'left';

  }


  // ==========================================================
  // DIRECTION CHANGE
  //
  // A → B
  // B → A
  //
  // progress reset
  // ==========================================================

  if (

    activeChoice

    &&

    activeChoice !==
      choice

  ) {

    onProgressCallback?.(
      activeChoice,
      0
    );


    progress =
      0;

  }


  activeChoice =
    choice;


  // ==========================================================
  // ANGLE → SPEED
  // ==========================================================

  const speed =
    angleToSpeed(
      angleDeg
    );


  // ==========================================================
  // ACCUMULATE PROGRESS
  // ==========================================================

  progress =
    clamp(

      progress
      +
      speed
      *
      dt,

      0,

      1

    );


  // ==========================================================
  // SEND PROGRESS TO ORIGINAL UI
  // ==========================================================

  onProgressCallback?.(
    choice,
    progress
  );


  // ==========================================================
  // DEBUG DISPLAY
  // ==========================================================

  const choiceLabel =

    choice === 'left'

      ? 'A / LEFT'

      : 'B / RIGHT';


  ui.input.textContent =
    `输入: ${choiceLabel} ${Math.round(progress * 100)}%`;


  // ==========================================================
  // CONFIRM
  // ==========================================================

  if (
    progress >=
    1
  ) {

    // --------------------------------------------------------
    // Ensure 100%
    // --------------------------------------------------------

    onProgressCallback?.(
      choice,
      1
    );


    // --------------------------------------------------------
    // Send A / B
    // --------------------------------------------------------

    onChoiceCallback?.(
      choice
    );


    // --------------------------------------------------------
    // Lock
    //
    // 必须回到中央
    // --------------------------------------------------------

    choiceArmed =
      false;


    progress =
      0;


    activeChoice =
      null;


    ui.input.textContent =
      '输入: Confirmed — センター';

  }

}


// ============================================================
// ACC BLE PACKET
//
// 12 bytes:
//
// byte 0 - 3
// AX
//
// byte 4 - 7
// AY
//
// byte 8 - 11
// AZ
//
// float32 little endian
// ============================================================

function handleAcceleration(
  event
) {

  const view =
    event
      .target
      .value;


  // ----------------------------------------------------------
  // Packet Check
  // ----------------------------------------------------------

  if (
    view.byteLength <
    12
  ) {

    console.warn(
      'ACC packet too short:',
      view.byteLength
    );


    return;
  }


  // ----------------------------------------------------------
  // AX
  // ----------------------------------------------------------

  const ax =
    view.getFloat32(
      0,
      true
    );


  // ----------------------------------------------------------
  // AY
  // ----------------------------------------------------------

  const ay =
    view.getFloat32(
      4,
      true
    );


  // ----------------------------------------------------------
  // AZ
  // ----------------------------------------------------------

  const az =
    view.getFloat32(
      8,
      true
    );


  // 当前不使用 Z
  void az;


  // ==========================================================
  // RAW ANGLE
  // ==========================================================

  const rawAngle =
    calculateRawAngle(
      ax,
      ay
    );


  lastRawAngleDeg =
    rawAngle;


  // ==========================================================
  // FIRST SAMPLE = TEMPORARY ZERO
  // ==========================================================

  if (
    zeroAngleDeg === null
  ) {

    zeroAngleDeg =
      rawAngle;

  }


  // ==========================================================
  // ZERO CORRECTION
  // ==========================================================

  let corrected =
    rawAngle -
    zeroAngleDeg;


  // ==========================================================
  // NORMALIZE
  //
  // -180° ～ +180°
  // ==========================================================

  if (
    corrected >
    180
  ) {

    corrected -=
      360;

  }


  if (
    corrected <
    -180
  ) {

    corrected +=
      360;

  }


  // ==========================================================
  // LOW-PASS FILTER
  // ==========================================================

  filteredAngleDeg +=

    (
      corrected -
      filteredAngleDeg
    )

    *

    FILTER_ALPHA;


  // ==========================================================
  // DISPLAY ANGLE
  // ==========================================================

  ui.angle.textContent =
    `角度: ${filteredAngleDeg.toFixed(1)}°`;


  // ==========================================================
  // A / B INPUT
  // ==========================================================

  processAngle(
    filteredAngleDeg,
    performance.now()
  );

}


// ============================================================
// CONNECT BLUETOOTH
// ============================================================

async function connectBluetooth() {

  // ==========================================================
  // WEB BLUETOOTH CHECK
  // ==========================================================

  if (
    !navigator.bluetooth
  ) {

    alert(
      'このブラウザは Web Bluetooth に対応していません。Chrome を使用してください。'
    );


    return;

  }


  try {

    // ========================================================
    // STATUS
    // ========================================================

    ui.status.textContent =
      '吊り革：接続中…';


    // ========================================================
    // SELECT DEVICE
    // ========================================================

    device =
      await navigator
        .bluetooth
        .requestDevice({

          filters: [

            {

              services: [
                SERVICE_UUID
              ]

            }

          ]

        });


    // ========================================================
    // DISCONNECT
    // ========================================================

    device.addEventListener(

      'gattserverdisconnected',

      () => {

        ui.status.textContent =
          '吊り革：切断';


        ui.zeroButton.disabled =
          true;


        ui.input.textContent =
          '输入: --';

      }

    );


    // ========================================================
    // CONNECT
    // ========================================================

    const server =
      await device
        .gatt
        .connect();


    // ========================================================
    // GET SERVICE
    // ========================================================

    const service =
      await server
        .getPrimaryService(
          SERVICE_UUID
        );


    // ========================================================
    // ACC CHARACTERISTIC
    // ========================================================

    accCharacteristic =
      await service
        .getCharacteristic(
          ACC_CHARACTERISTIC_UUID
        );


    await accCharacteristic
      .startNotifications();


    accCharacteristic
      .addEventListener(

        'characteristicvaluechanged',

        handleAcceleration

      );


    // ========================================================
    // FORCE + HEIGHT CHARACTERISTIC
    // ========================================================

    forceCharacteristic =
      await service
        .getCharacteristic(
          FORCE_CHARACTERISTIC_UUID
        );


    await forceCharacteristic
      .startNotifications();


    forceCharacteristic
      .addEventListener(

        'characteristicvaluechanged',

        handleForce

      );


    // ========================================================
    // CONNECTED
    // ========================================================

    ui.status.textContent =
      `吊り革：接続済み (${device.name ?? 'Arduino'})`;


    ui.zeroButton.disabled =
      false;


    ui.input.textContent =
      '输入: Ready';


    console.log(
      'Tsurikawa BLE connected.'
    );

  }

  catch (
    error
  ) {

    console.error(
      error
    );


    ui.status.textContent =
      '吊り革：接続失敗';

  }

}


// ============================================================
// ROCKING TRAIN INPUT ADAPTER
// ============================================================

const tsurikawaInput = {

  // ----------------------------------------------------------
  // START
  // ----------------------------------------------------------

  start(
    onChoice,
    onProgress
  ) {

    onChoiceCallback =
      onChoice;


    onProgressCallback =
      onProgress;

  },


  // ----------------------------------------------------------
  // STOP
  // ----------------------------------------------------------

  stop() {

    accCharacteristic
      ?.stopNotifications()
      ?.catch(
        () => {}
      );


    forceCharacteristic
      ?.stopNotifications()
      ?.catch(
        () => {}
      );


    device
      ?.gatt
      ?.disconnect();


    onChoiceCallback =
      null;


    onProgressCallback =
      null;

  }

};


// ============================================================
// KEYBOARD BLOCKING
// ============================================================

function blockKeyboard(
  event
) {

  if (
    !DISABLE_KEYBOARD
  ) {

    return;

  }


  if (

    event.key ===
      'ArrowLeft'

    ||

    event.key ===
      'ArrowRight'

    ||

    event.key ===
      'ArrowDown'

  ) {

    event.preventDefault();


    event.stopImmediatePropagation();

  }

}


// ============================================================
// REGISTER KEYBOARD BLOCK
// ============================================================

if (
  DISABLE_KEYBOARD
) {

  window.addEventListener(

    'keydown',

    blockKeyboard,

    true

  );


  window.addEventListener(

    'keyup',

    blockKeyboard,

    true

  );

}


// ============================================================
// BUTTON EVENTS
// ============================================================

ui.connectButton
  .addEventListener(

    'click',

    connectBluetooth

  );


ui.zeroButton
  .addEventListener(

    'click',

    calibrateZero

  );


// ============================================================
// REGISTER EXTERNAL INPUT
// ============================================================

registerChoiceInput(
  tsurikawaInput
);