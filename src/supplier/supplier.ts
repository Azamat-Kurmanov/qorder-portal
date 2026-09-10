/**
 * Выбранный поставщик — мост между состоянием React и мутатором запросов.
 *
 * apiRequest (src/api/client.ts) живёт вне дерева компонентов и к контексту
 * доступа не имеет. SupplierProvider синхронизирует значение сюда при каждой
 * смене, а мутатор читает его напрямую.
 *
 * Выбор переживает перезагрузку страницы: клиент, закупающийся у двоих,
 * не должен выбирать поставщика заново после каждого обновления. Хранилище
 * может быть недоступно (приватный режим, запрет данных сайта) — тогда выбор
 * живёт до конца вкладки, и это рабочий режим, а не поломка.
 */
const STORAGE_KEY = 'qo.portal.supplier';

let current: string | null = readStored();

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function currentSupplierId(): string | null {
  return current;
}

export function setCurrentSupplierId(supplierId: string | null): void {
  current = supplierId;
  try {
    if (supplierId === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, supplierId);
  } catch {
    // Хранилище недоступно: выбор живёт до конца вкладки.
  }
}
