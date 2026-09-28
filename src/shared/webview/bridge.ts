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
}

declare global {
  interface Window {
    QOrderBridge?: QOrderBridge;
  }
}

/** Есть ли мост: в браузере — нет. */
export function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.QOrderBridge === 'object';
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
