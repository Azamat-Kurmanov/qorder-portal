/**
 * Мост в мобильное приложение.
 *
 * Кабинет открывают и в браузере, и внутри WebView. В браузере моста нет —
 * и это нормальный режим, а не деградация: обёртка отвечает «недоступен»,
 * а экраны обходятся без него.
 *
 * Прямых обращений к `window.QOrderBridge` в экранах быть не должно:
 * одна забытая проверка наличия роняет весь кабинет в браузере.
 */
interface QOrderBridge {
  /** Сохранить строку в защищённом хранилище приложения. */
  storeSecret?: (key: string, value: string) => void;
  /** Отдать файл приложению: скачивание внутри WebView иначе не работает. */
  saveFile?: (name: string, base64: string) => void;
  /** Прочитать строку из защищённого хранилища приложения; нет — `null`. */
  readSecret?: (key: string) => Promise<string | null>;
  /** Разрешение на уведомления и токен устройства для push; `null` — push выключен или запрещён. */
  pushToken?: () => Promise<PushDevice | null>;
  /** Уведомление, которого коснулись, — отдаётся один раз; нет — `null`. */
  takeNotification?: () => Promise<OpenedPush | null>;
  /** Открыть нативный сканер; коды приходят событием {@link SCAN_EVENT}. */
  startScan?: () => void;
  /** Закрыть нативный сканер. */
  stopScan?: () => void;
  /** Строка под видоискателем нативного сканера: что вышло из последнего кода. */
  scanStatus?: (tone: 'ok' | 'error', text: string) => void;
}

/** Код от нативного сканера: `CustomEvent`, `detail` — строка кода. */
export const SCAN_EVENT = 'qorder-scan';
/** Человек закрыл нативный сканер сам. */
export const SCAN_CLOSED_EVENT = 'qorder-scan-closed';

/** Устройство для регистрации на сервере (`RegisterDeviceRequest`). */
export interface PushDevice {
  token: string;
  platform: 'ANDROID' | 'IOS';
}

/** Данные push, которого коснулись: повод и предмет, без текста. */
export interface OpenedPush {
  tenantId?: string;
  recipientKind?: string;
  kind?: string;
  subjectId?: string;
  /** Плашка этого push: касание отмечает её прочитанной. */
  notificationId?: string;
}

/** Пришёл push, пока кабинет открыт: перечитать уведомления. */
export const PUSH_RECEIVED_EVENT = 'qorder-notification';
/** Коснулись уведомления: забрать его {@link takeNotification}. */
export const PUSH_OPENED_EVENT = 'qorder-notification-opened';
/** FCM сменил токен устройства: зарегистрировать заново. */
export const PUSH_TOKEN_EVENT = 'qorder-push-token';

declare global {
  interface Window {
    QOrderBridge?: QOrderBridge;
  }
}

/** Есть ли мост: в браузере — нет. */
export function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.QOrderBridge === 'object';
}

/** Сохранить секрет в защищённом хранилище приложения; в браузере ничего не делает. */
export function storeSecret(key: string, value: string): boolean {
  const bridge = window.QOrderBridge;
  if (!bridge?.storeSecret) return false;
  bridge.storeSecret(key, value);
  return true;
}

/**
 * Прочитать секрет из защищённого хранилища приложения.
 *
 * @returns строку или `null`: в браузере, в приложении без метода и при
 *          отказе приложения — веб в любом из этих случаев входит как обычно
 */
export async function readSecret(key: string): Promise<string | null> {
  const bridge = window.QOrderBridge;
  if (!bridge?.readSecret) return null;
  try {
    return (await bridge.readSecret(key)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Отдать файл приложению.
 *
 * @returns удалось ли; ложь означает «моста нет», и экран обязан предложить
 *          обычную ссылку, а не молча ничего не сделать
 */
export function saveFile(name: string, base64: string): boolean {
  const bridge = window.QOrderBridge;
  if (!bridge?.saveFile) return false;
  bridge.saveFile(name, base64);
  return true;
}

/** Токен устройства для push; `null` — в браузере, без push или при отказе приложения. */
export async function pushToken(): Promise<PushDevice | null> {
  try {
    return (await window.QOrderBridge?.pushToken?.()) ?? null;
  } catch {
    return null;
  }
}

/** Уведомление, которого коснулись; `null` — его нет или моста нет. */
export async function takeNotification(): Promise<OpenedPush | null> {
  try {
    return (await window.QOrderBridge?.takeNotification?.()) ?? null;
  } catch {
    return null;
  }
}

/** Есть ли у приложения сканер: в браузере кнопки сканирования нет. */
export function hasNativeScan(): boolean {
  return typeof window !== 'undefined' && typeof window.QOrderBridge?.startScan === 'function';
}

export function startScan(): void {
  window.QOrderBridge?.startScan?.();
}

export function stopScan(): void {
  window.QOrderBridge?.stopScan?.();
}

export function scanStatus(tone: 'ok' | 'error', text: string): void {
  window.QOrderBridge?.scanStatus?.(tone, text);
}
