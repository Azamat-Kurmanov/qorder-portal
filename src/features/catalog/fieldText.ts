import i18n from 'i18next';
import type { CustomerFieldDto } from '../../api/generated';
import { intlLocale } from '../../i18n';

/**
 * Значение характеристики в том виде, в каком его читает клиент.
 * <p>
 * Сервер присылает значение уже разобранным — подпись варианта вместо кода,
 * число без хвостовых нулей, дату в машинной записи, — но показывать его
 * как есть нельзя: «true» ничего не говорит человеку, а дата по стандарту
 * читается хуже местной. Единица и конец диапазона приезжают отдельными
 * полями, чтобы их не пришлось выковыривать из строки обратно.
 *
 * Пустая строка означает «показывать нечего»: строку с подписью и пустотой
 * карточка не рисует вовсе.
 */
export function fieldText(field: CustomerFieldDto): string {
  switch (field.type) {
    case 'OPTION_MULTI':
      return (field.values ?? []).join(', ');

    case 'BOOLEAN':
      if (field.value !== 'true' && field.value !== 'false') return '';
      return i18n.t(`catalog.field.${field.value === 'true' ? 'yes' : 'no'}`);

    case 'DATE':
      return field.value ? localDate(field.value) : '';

    case 'RANGE': {
      const from = field.value?.trim() ?? '';
      const to = field.valueTo?.trim() ?? '';
      if (from === '' && to === '') return '';
      // Полудиапазон показывается тем, что есть: продавец мог назвать только
      // нижнюю границу, и «10–» читалось бы обрывом, а не «от десяти».
      const range = from !== '' && to !== '' ? `${from}–${to}` : from || to;
      return withUnit(range, field.unit);
    }

    case 'NUMBER':
      return field.value ? withUnit(field.value, field.unit) : '';

    default:
      return field.value ?? '';
  }
}

function withUnit(value: string, unit?: string): string {
  return unit ? `${value} ${unit}` : value;
}

/**
 * Дата на языке клиента. Неразобранная строка отдаётся как есть: показать
 * «Invalid Date» хуже, чем показать то, что прислал сервер.
 */
function localDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(intlLocale()).format(parsed);
}
