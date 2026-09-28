import type { TFunction } from 'i18next';
import type { ShopHours } from '../../api/generated';

/** «07:00» → «7:00»: ведущий ноль в часах читается хуже. */
function clock(value: string): string {
  const [h, m] = value.split(':');
  return `${Number(h)}:${m}`;
}

/**
 * Дни недели по ISO: 1 — понедельник; `null`, если часовой пояс неизвестен.
 * `Intl.DateTimeFormat` бросает `RangeError` на непризнанный часовой пояс —
 * сюда он мог дойти реквизитами продавца без проверки, — и без этой защиты
 * падал весь рендер шапки, хотя часть текста часов пояса вообще не требует.
 */
function isoDay(date: Date, timezone: string): number | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(date);
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name) + 1;
  } catch {
    return null;
  }
}

export function hoursText(hours: ShopHours | undefined, t: TFunction, now = new Date()): string | null {
  if (!hours) return null;
  // Исключение на сегодня сильнее общего вида недели: в праздник «каждый
  // день с 9 до 18» было бы неправдой.
  const local = hours.exceptions?.length ? localNow(now, hours.timezone) : null;
  const special = local ? hours.exceptions.find((item) => item.date === local.date) : undefined;
  if (special) {
    return special.closed || !special.opensAt || !special.closesAt
      ? t('shop.hours.closedToday')
      : t('shop.hours.today', { from: clock(special.opensAt), to: clock(special.closesAt) });
  }
  if (hours.days.length === 0) return t('shop.hours.always');
  const open = hours.days.filter((d) => !d.closed && d.opensAt && d.closesAt);
  if (open.length === 0) return t('shop.hours.closedToday');
  const same = open.every((d) => d.opensAt === open[0].opensAt && d.closesAt === open[0].closesAt);
  const range = { from: clock(open[0].opensAt!), to: clock(open[0].closesAt!) };
  if (same && open.length === 7) return t('shop.hours.everyDay', range);
  const weekdaysToSat = open.length === 6 && open.every((d) => d.dayOfWeek <= 6);
  if (same && weekdaysToSat) return t('shop.hours.monSat', range);
  // Дальше ответ зависит от того, какой сегодня день у этого пояса: без
  // него сказать, открыт ли магазин именно сегодня, нечем — строка «Сегодня …»
  // не строится, а не подменяется наугад.
  const isoWeekday = isoDay(now, hours.timezone);
  if (isoWeekday === null) return null;
  const today = hours.days.find((d) => d.dayOfWeek === isoWeekday);
  if (!today || today.closed || !today.opensAt || !today.closesAt) return t('shop.hours.closedToday');
  return t('shop.hours.today', { from: clock(today.opensAt), to: clock(today.closesAt) });
}

/** Минуты от полуночи: «09:30» → 570. */
function minutes(value: string): number {
  const [h, m] = value.split(':');
  return Number(h) * 60 + Number(m);
}

/** Дата, день недели и минуты от полуночи в поясе магазина; `null`, если пояс не признан. */
function localNow(date: Date, timezone: string): { date: string; day: number; at: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone,
    }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(part('weekday')) + 1;
    return day
      ? { date: `${part('year')}-${part('month')}-${part('day')}`, day, at: Number(part('hour')) * 60 + Number(part('minute')) }
      : null;
  } catch {
    return null;
  }
}

/** Предыдущая дата календаря: «2026-09-01» → «2026-08-31». */
function dayBefore(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Часы конкретной даты: `hours` пусто — закрыто весь день; `title` — у исключения с названием. */
interface DateHours {
  hours: { from: string; to: string } | null;
  title?: string;
  /** Работает круглосуточно: сетка пуста и исключения на дату нет. */
  always?: boolean;
}

/**
 * Часы магазина в дату: исключение по дате сильнее недельной сетки — так же
 * решает и сервер (`BusinessCalendarServiceImpl.resolveDay`). Праздник в среду
 * закрывает магазин, рабочая суббота открывает.
 */
function hoursOn(hours: ShopHours, date: string, weekday: number): DateHours {
  const exception = hours.exceptions?.find((item) => item.date === date);
  if (exception) {
    return {
      hours: exception.closed || !exception.opensAt || !exception.closesAt ? null : { from: exception.opensAt, to: exception.closesAt },
      title: exception.title || undefined,
    };
  }
  if (hours.days.length === 0) return { hours: null, always: true };
  const day = hours.days.find((d) => d.dayOfWeek === weekday && !d.closed && d.opensAt && d.closesAt);
  return { hours: day ? { from: day.opensAt!, to: day.closesAt! } : null };
}

/** Состояние магазина прямо сейчас — для полосы графика под шапкой. */
export interface HoursNow {
  /** Открыт ли приём в эту минуту: зелёная точка или янтарная. */
  open: boolean;
  /** Полная строка — полоса на мониторе. */
  text: string;
  /** Короткая — подпись под названием магазина на телефоне. */
  short: string;
}

/**
 * «Открыто до 18:00», «Откроется в 9:00», «Сегодня закрыто» — по часам
 * магазина в его поясе, а не в поясе покупателя: покупатель из Астаны,
 * заказывающий в алматинском магазине, должен видеть часы магазина.
 *
 * Исключения по датам сильнее недельной сетки; у праздника с названием
 * оно стоит в начале строки: «День Независимости · Сегодня закрыто — …».
 *
 * Смена, переходящая через полночь (закрывается раньше, чем открылась),
 * считается открытой от начала до полуночи и от полуночи до конца —
 * вторую половину даёт вчерашний день.
 *
 * @return `null`, если часов нет или пояс не признан: гадать о «сейчас» нечем
 */
export function hoursNow(hours: ShopHours | undefined, t: TFunction, now = new Date()): HoursNow | null {
  if (!hours) return null;
  const local = localNow(now, hours.timezone);
  if (!local) {
    return hours.days.length === 0 && !hours.exceptions?.length
      ? { open: true, text: t('shop.hours.now.always'), short: t('shop.hours.now.always') }
      : null;
  }
  const today = hoursOn(hours, local.date, local.day);
  const titled = (text: string) => (today.title ? t('shop.hours.now.titled', { title: today.title, text }) : text);
  const result = (open: boolean, key: string, values: Record<string, string> = {}): HoursNow => ({
    open, text: titled(t(`shop.hours.now.${key}`, values)), short: t(`shop.hours.now.${key}Short`, values),
  });

  const yesterday = hoursOn(hours, dayBefore(local.date), local.day === 1 ? 7 : local.day - 1).hours;
  if (yesterday && minutes(yesterday.to) <= minutes(yesterday.from) && local.at < minutes(yesterday.to)) {
    return { open: true, text: t('shop.hours.now.open', { to: clock(yesterday.to) }), short: t('shop.hours.now.openShort', { to: clock(yesterday.to) }) };
  }
  if (today.always) return { open: true, text: t('shop.hours.now.always'), short: t('shop.hours.now.always') };
  if (!today.hours) return result(false, 'closedToday');
  const from = minutes(today.hours.from);
  const to = minutes(today.hours.to);
  if (local.at < from) return result(false, 'later', { from: clock(today.hours.from) });
  if (to <= from || local.at < to) return result(true, 'open', { to: clock(today.hours.to) });
  return result(false, 'over');
}

/** Казахстанский номер к виду 7XXXXXXXXXX; иначе — null. */
function digits(value: string | undefined): string | null {
  const raw = (value ?? '').replace(/\D/g, '');
  const normalized = raw.length === 11 && raw.startsWith('8') ? `7${raw.slice(1)}` : raw;
  return normalized.length === 11 && normalized.startsWith('7') ? normalized : null;
}

export function whatsappLink(value: string | undefined): string | null {
  const number = digits(value);
  return number ? `https://wa.me/${number}` : null;
}

export function telLink(value: string | undefined): string | null {
  const number = digits(value);
  return number ? `tel:+${number}` : null;
}
