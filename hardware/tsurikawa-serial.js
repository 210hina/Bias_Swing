import { registerChoiceInput } from '../main.js';

// ============================================================
// Tsurikawa USB Serial Adapter
// Arduino line format:
// DATA,forceKg,heightCm,ax,ay,az,gx,gy,gz
// ============================================================

const BAUD_RATE = 115200;

// Start screen: pull >= 1.0 kgf to start.
const START_FORCE_KG = 1.0;

// Angle input parameters.
const DEAD_ZONE_DEG = 8;
const RESET_ZONE_DEG = 5;
const MAX_ANGLE_DEG = 30;
const MIN_SPEED = 0.33;
const MAX_SPEED = 1.25;
const SPEED_EXPONENT = 1.6;
const FILTER_ALPHA = 0.18;

// Current installation direction.
const INVERT_DIRECTION = true;
const DISABLE_KEYBOARD = true;

let port = null;
let reader = null;
let keepReading = false;

let onChoiceCallback = null;
let onProgressCallback = null;

let lastRawAngleDeg = null;
let zeroAngleDeg = null;
let filteredAngleDeg = 0;

let activeChoice = null;
let progress = 0;
let lastTimestamp = null;
let choiceArmed = true;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateRawAngle(ax, ay) {
  return Math.atan2(ax, ay) * 180 / Math.PI;
}

function angleToSpeed(angleDeg) {
  const magnitude = Math.abs(angleDeg);
  if (magnitude <= DEAD_ZONE_DEG) return 0;

  const normalized = clamp(
    (magnitude - DEAD_ZONE_DEG) /
      (MAX_ANGLE_DEG - DEAD_ZONE_DEG),
    0,
    1,
  );

  return MIN_SPEED +
    (MAX_SPEED - MIN_SPEED) *
    Math.pow(normalized, SPEED_EXPONENT);
}

function createHardwarePanel() {
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '9999',
    display: 'grid',
    gap: '6px',
    minWidth: '190px',
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'rgba(0, 0, 0, 0.78)',
    color: 'white',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '12px',
    lineHeight: '1.5',
  });

  const status = document.createElement('div');
  status.textContent = '吊り革：USB未接続';

  const force = document.createElement('div');
  force.textContent = '拉力: -- kgf';

  const height = document.createElement('div');
  height.textContent = '高度: -- cm';

  const angle = document.createElement('div');
  angle.textContent = '角度: --°';

  const input = document.createElement('div');
  input.textContent = '输入: --';

  const connectButton = document.createElement('button');
  connectButton.textContent = 'USB接続';
  connectButton.style.padding = '6px 10px';
  connectButton.style.cursor = 'pointer';

  const zeroButton = document.createElement('button');
  zeroButton.textContent = '0° 校正';
  zeroButton.disabled = true;
  zeroButton.style.padding = '6px 10px';
  zeroButton.style.cursor = 'pointer';

  panel.append(
    status,
    force,
    height,
    angle,
    input,
    connectButton,
    zeroButton,
  );
  document.body.append(panel);

  return {
    status,
    force,
    height,
    angle,
    input,
    connectButton,
    zeroButton,
  };
}

const ui = createHardwarePanel();

function calibrateZero() {
  if (lastRawAngleDeg === null) return;

  zeroAngleDeg = lastRawAngleDeg;
  filteredAngleDeg = 0;
  progress = 0;
  activeChoice = null;
  choiceArmed = true;
  lastTimestamp = null;

  ui.angle.textContent = '角度: 0.0°';
  ui.input.textContent = '输入: Ready';
}

// Force is used only on the ATTRACT screen.
function checkStartByForce(forceKg) {
  if (forceKg < START_FORCE_KG) return;

  const startButton = document.querySelector('.scene__action');
  if (!startButton) return;

  ui.input.textContent = `START — ${forceKg.toFixed(2)} kgf`;
  startButton.click();
}

function processAngle(angleDeg, timestamp) {
  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
    return;
  }

  const dt = clamp((timestamp - lastTimestamp) / 1000, 0, 0.1);
  lastTimestamp = timestamp;

  const choicePrompt = document.querySelector('.choice-prompt');

  // Outside A/B pages: do not accumulate input.
  // If a choice has just completed, only re-arm after the handle
  // physically returns near center.
  if (!choicePrompt) {
    if (activeChoice) {
      onProgressCallback?.(activeChoice, 0);
    }
    activeChoice = null;
    progress = 0;

    if (!choiceArmed && Math.abs(angleDeg) <= RESET_ZONE_DEG) {
      choiceArmed = true;
      ui.input.textContent = '输入: Ready';
    }
    return;
  }

  if (!choiceArmed) {
    if (Math.abs(angleDeg) <= RESET_ZONE_DEG) {
      choiceArmed = true;
      activeChoice = null;
      progress = 0;
      ui.input.textContent = '输入: Ready';
    }
    return;
  }

  if (Math.abs(angleDeg) <= DEAD_ZONE_DEG) {
    if (activeChoice) {
      onProgressCallback?.(activeChoice, 0);
    }
    activeChoice = null;
    progress = 0;
    ui.input.textContent = '输入: Neutral';
    return;
  }

  let choice = angleDeg < 0 ? 'left' : 'right';
  if (INVERT_DIRECTION) {
    choice = choice === 'left' ? 'right' : 'left';
  }

  if (activeChoice && activeChoice !== choice) {
    onProgressCallback?.(activeChoice, 0);
    progress = 0;
  }
  activeChoice = choice;

  progress = clamp(
    progress + angleToSpeed(angleDeg) * dt,
    0,
    1,
  );

  onProgressCallback?.(choice, progress);

  const label = choice === 'left' ? 'A / LEFT' : 'B / RIGHT';
  ui.input.textContent =
    `输入: ${label} ${Math.round(progress * 100)}%`;

  if (progress >= 1) {
    onProgressCallback?.(choice, 1);
    onChoiceCallback?.(choice);

    choiceArmed = false;
    activeChoice = null;
    progress = 0;
    ui.input.textContent = '输入: Confirmed — 回到中央';
  }
}

function handleSensorData(forceKg, heightCm, ax, ay, az) {
  void az;

  ui.force.textContent = `拉力: ${forceKg.toFixed(2)} kgf`;
  ui.height.textContent = `高度: ${heightCm.toFixed(1)} cm`;

  checkStartByForce(forceKg);

  const rawAngle = calculateRawAngle(ax, ay);
  lastRawAngleDeg = rawAngle;

  if (zeroAngleDeg === null) {
    zeroAngleDeg = rawAngle;
    filteredAngleDeg = 0;
  }

  let corrected = rawAngle - zeroAngleDeg;
  if (corrected > 180) corrected -= 360;
  if (corrected < -180) corrected += 360;

  filteredAngleDeg +=
    (corrected - filteredAngleDeg) * FILTER_ALPHA;

  ui.angle.textContent = `角度: ${filteredAngleDeg.toFixed(1)}°`;
  processAngle(filteredAngleDeg, performance.now());
}

function handleSerialLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('DATA,')) return;

  const parts = trimmed.split(',');
  if (parts.length < 6) return;

  const forceKg = Number(parts[1]);
  const heightCm = Number(parts[2]);
  const ax = Number(parts[3]);
  const ay = Number(parts[4]);
  const az = Number(parts[5]);

  if (
    !Number.isFinite(forceKg) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(ax) ||
    !Number.isFinite(ay) ||
    !Number.isFinite(az)
  ) return;

  handleSensorData(forceKg, heightCm, ax, ay, az);
}

async function readSerialLoop() {
  if (!port?.readable) return;

  const decoder = new TextDecoder();
  let buffer = '';
  keepReading = true;
  reader = port.readable.getReader();

  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        handleSerialLine(line);
      }
    }
  } catch (error) {
    if (keepReading) {
      console.error('USB Serial read error:', error);
      ui.status.textContent = '吊り革：USB通信エラー';
    }
  } finally {
    try {
      reader?.releaseLock();
    } catch {
      // ignore
    }
    reader = null;
  }
}

async function openSerialPort(selectedPort) {
  if (!selectedPort) return;

  try {
    ui.status.textContent = '吊り革：USB接続中…';

    await selectedPort.open({ baudRate: BAUD_RATE });
    port = selectedPort;

    lastRawAngleDeg = null;
    zeroAngleDeg = null;
    filteredAngleDeg = 0;
    activeChoice = null;
    progress = 0;
    lastTimestamp = null;
    choiceArmed = true;

    ui.status.textContent = '吊り革：USB接続済み';
    ui.connectButton.textContent = 'USB接続済み';
    ui.zeroButton.disabled = false;
    ui.input.textContent = '输入: Ready';

    void readSerialLoop();
  } catch (error) {
    console.error('USB Serial open error:', error);
    ui.status.textContent = '吊り革：USB接続失敗';
    ui.connectButton.textContent = 'USB接続';
  }
}

async function connectSerial() {
  if (!('serial' in navigator)) {
    alert('このブラウザは Web Serial に対応していません。Chrome を使用してください。');
    return;
  }

  if (port?.readable) return;

  try {
    const selectedPort = await navigator.serial.requestPort();
    await openSerialPort(selectedPort);
  } catch (error) {
    if (error?.name === 'NotFoundError') return;
    console.error('USB Serial selection error:', error);
    ui.status.textContent = '吊り革：USB接続失敗';
  }
}

// Reconnect automatically after the browser has been granted permission once.
async function tryAutoConnect() {
  if (!('serial' in navigator)) {
    ui.status.textContent = '吊り革：Web Serial非対応';
    return;
  }

  try {
    const ports = await navigator.serial.getPorts();
    if (!ports.length) return;

    const preferred = ports.find((candidate) => {
      const info = candidate.getInfo?.() ?? {};
      return info.usbVendorId === 0x2341 || info.usbVendorId === 0x2A03;
    }) ?? ports[0];

    await openSerialPort(preferred);
  } catch (error) {
    console.warn('USB Serial auto-connect skipped:', error);
  }
}

if ('serial' in navigator) {
  navigator.serial.addEventListener('disconnect', () => {
    keepReading = false;
    port = null;

    ui.status.textContent = '吊り革：USB切断';
    ui.connectButton.textContent = 'USB接続';
    ui.zeroButton.disabled = true;
    ui.input.textContent = '输入: --';
  });
}

const tsurikawaInput = {
  start(onChoice, onProgress) {
    onChoiceCallback = onChoice;
    onProgressCallback = onProgress;
  },

  stop() {
    onChoiceCallback = null;
    onProgressCallback = null;
  },
};

function blockKeyboard(event) {
  if (!DISABLE_KEYBOARD) return;

  if (
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === 'ArrowDown'
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

if (DISABLE_KEYBOARD) {
  window.addEventListener('keydown', blockKeyboard, true);
  window.addEventListener('keyup', blockKeyboard, true);
}

ui.connectButton.addEventListener('click', connectSerial);
ui.zeroButton.addEventListener('click', calibrateZero);

registerChoiceInput(tsurikawaInput);
void tryAutoConnect();
