/**
 * Мост в мобильное приложение.
 *
 * Кабинет открывают и в браузере, и внутри WebView. В браузере моста нет —
 * и это нормальный режим, а не деградация: обёртка отвечает «недоступен»,
 * а экраны обходятся без него.
 *
 * Прямых обращений к `window.FastOrdersBridge` в экранах быть не должно:
 * одна забытая проверка наличия роняет весь кабинет в браузере.
 */
interface FastOrdersBridge {
  /** Сохранить строку в защищённом хранилище приложения. */
  storeSecret?: (key: string, value: string) => void;
  /** Отдать файл приложению: скачивание внутри WebView иначе не работает. */
  saveFile?: (name: string, base64: string) => void;
}

declare global {
  interface Window {
    FastOrdersBridge?: FastOrdersBridge;
  }
}

/** Есть ли мост: в браузере — нет. */
export function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.FastOrdersBridge === 'object';
}

/** Сохранить секрет в защищённом хранилище приложения; в браузере ничего не делает. */
export function storeSecret(key: string, value: string): boolean {
  const bridge = window.FastOrdersBridge;
  if (!bridge?.storeSecret) return false;
  bridge.storeSecret(key, value);
  return true;
}

/**
 * Отдать файл приложению.
 *
 * @returns удалось ли; ложь означает «моста нет», и экран обязан предложить
 *          обычную ссылку, а не молча ничего не сделать
 */
export function saveFile(name: string, base64: string): boolean {
  const bridge = window.FastOrdersBridge;
  if (!bridge?.saveFile) return false;
  bridge.saveFile(name, base64);
  return true;
}
