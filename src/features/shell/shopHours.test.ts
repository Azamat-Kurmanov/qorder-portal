import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { hoursNow, hoursText, telLink, whatsappLink } from './shopHours';

const t = i18n.getFixedT('ru');
const day = (dayOfWeek: number, opensAt = '07:00', closesAt = '17:00', closed = false) =>
  ({ dayOfWeek, closed, opensAt, closesAt });

describe('часы магазина словами', () => {
  it('пустая неделя — круглосуточно', () => {
    expect(hoursText({ days: [], timezone: 'Asia/Almaty', exceptions: [] }, t)).toBe('Круглосуточно');
  });
  it('одинаковые часы все семь дней — «каждый день»', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d));
    expect(hoursText({ days, timezone: 'Asia/Almaty', exceptions: [] }, t)).toBe('Каждый день с 7:00 до 17:00');
  });
  it('выходной воскресенье — «Пн–Сб»', () => {
    const days = [1, 2, 3, 4, 5, 6].map((d) => day(d, '08:00', '18:00')).concat(day(7, '08:00', '18:00', true));
    expect(hoursText({ days, timezone: 'Asia/Almaty', exceptions: [] }, t)).toBe('Пн–Сб с 8:00 до 18:00');
  });
  it('разные часы — сегодняшний день', () => {
    const days = [1, 2, 3, 4, 5].map((d) => day(d)).concat(day(6, '09:00', '14:00'), day(7, '09:00', '14:00', true));
    // 2026-09-26 — суббота
    expect(hoursText({ days, timezone: 'Asia/Almaty', exceptions: [] }, t, new Date('2026-09-26T06:00:00Z')))
      .toBe('Сегодня с 9:00 до 14:00');
  });
  it('часов нет — строки нет', () => {
    expect(hoursText(undefined, t)).toBeNull();
  });
  it('все семь дней закрыты — «Сегодня закрыто»', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, '07:00', '17:00', true));
    expect(hoursText({ days, timezone: 'Asia/Almaty', exceptions: [] }, t)).toBe('Сегодня закрыто');
  });
  it('закрыт понедельник, открыты вт–вс, сегодня понедельник — «Сегодня закрыто»', () => {
    const days = [day(1, '08:00', '18:00', true), 2, 3, 4, 5, 6, 7].map((d) => typeof d === 'number' ? day(d, '08:00', '18:00') : d);
    // 2026-09-21 — понедельник в Asia/Almaty
    expect(hoursText({ days, timezone: 'Asia/Almaty', exceptions: [] }, t, new Date('2026-09-21T06:00:00Z')))
      .toBe('Сегодня закрыто');
  });
  it('неизвестный часовой пояс и разные часы по дням — null без исключения', () => {
    const days = [1, 2, 3, 4, 5].map((d) => day(d)).concat(day(6, '09:00', '14:00'), day(7, '09:00', '14:00', true));
    expect(() => hoursText({ days, timezone: 'Mars/Olympus', exceptions: [] }, t)).not.toThrow();
    expect(hoursText({ days, timezone: 'Mars/Olympus', exceptions: [] }, t)).toBeNull();
  });
  it('неизвестный часовой пояс, но одинаковые часы все семь дней — пояс не нужен', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d));
    expect(hoursText({ days, timezone: 'Mars/Olympus', exceptions: [] }, t)).toBe('Каждый день с 7:00 до 17:00');
  });
});

describe('ссылки на связь', () => {
  it('WhatsApp из любого вида номера', () => {
    expect(whatsappLink('+7 (701) 000-00-01')).toBe('https://wa.me/77010000001');
    expect(whatsappLink('87010000001')).toBe('https://wa.me/77010000001');
    expect(whatsappLink('звоните')).toBeNull();
  });
  it('телефон — tel: без пробелов', () => {
    expect(telLink('+7 701 000 00 01')).toBe('tel:+77010000001');
    expect(telLink(undefined)).toBeNull();
  });
});

describe('состояние магазина прямо сейчас', () => {
  // Четверг, 24.09.2026: 12:00 по Алматы (UTC+5) — это 07:00 UTC.
  const at = (hhmm: string) => new Date(`2026-09-24T${hhmm}:00+05:00`);
  const week = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, '09:00', '18:00'));
  const hours = { days: week, timezone: 'Asia/Almaty', exceptions: [] };

  it('днём — «Открыто до 18:00»', () => {
    expect(hoursNow(hours, t, at('12:00'))).toEqual({
      open: true, text: 'Открыто до 18:00 — заявки обработаем сегодня', short: 'Открыто до 18:00',
    });
  });
  it('утром до открытия — «Откроется сегодня в 9:00»', () => {
    const status = hoursNow(hours, t, at('07:30'));
    expect(status?.open).toBe(false);
    expect(status?.text).toBe('Откроется сегодня в 9:00 — заявки принимаются уже сейчас');
  });
  it('вечером после закрытия — «Уже закрыто»', () => {
    expect(hoursNow(hours, t, at('19:00'))?.short).toBe('Уже закрыто · заявки принимаются');
  });
  it('в выходной — «Сегодня закрыто», как в макете', () => {
    const days = week.map((d) => (d.dayOfWeek === 4 ? day(4, undefined, undefined, true) : d));
    expect(hoursNow({ days, timezone: 'Asia/Almaty', exceptions: [] }, t, at('12:00'))?.text)
      .toBe('Сегодня закрыто — заявки принимаются, обработаем в ближайший рабочий день');
  });
  it('часы считаются в поясе магазина, а не покупателя', () => {
    // 17:30 по Алматы — это 21:30 во Владивостоке: магазин во Владивостоке уже закрыт.
    expect(hoursNow({ days: week, timezone: 'Asia/Vladivostok', exceptions: [] }, t, at('17:30'))?.open).toBe(false);
    expect(hoursNow(hours, t, at('17:30'))?.open).toBe(true);
  });
  it('ночная смена открыта и после полуночи', () => {
    const night = { days: [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, '20:00', '04:00')), timezone: 'Asia/Almaty', exceptions: [] };
    expect(hoursNow(night, t, at('02:00'))?.short).toBe('Открыто до 4:00');
    expect(hoursNow(night, t, at('23:00'))?.open).toBe(true);
  });
  it('круглосуточно и неизвестный пояс', () => {
    expect(hoursNow({ days: [], timezone: 'Asia/Almaty', exceptions: [] }, t)?.open).toBe(true);
    expect(hoursNow({ days: week, timezone: 'Нет/Такого', exceptions: [] }, t)).toBeNull();
    expect(hoursNow(undefined, t)).toBeNull();
  });
});

describe('исключения по датам', () => {
  // Четверг, 24.09.2026, по Алматы.
  const at = (hhmm: string) => new Date(`2026-09-24T${hhmm}:00+05:00`);
  const week = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, '09:00', '18:00'));
  const shop = (exceptions: { date: string; closed: boolean; opensAt?: string; closesAt?: string; title?: string }[]) =>
    ({ days: week, timezone: 'Asia/Almaty', exceptions });

  it('праздник закрывает рабочий по сетке день и называется в полосе', () => {
    const status = hoursNow(shop([{ date: '2026-09-24', closed: true, title: 'День Независимости' }]), t, at('12:00'));
    expect(status).toEqual({
      open: false,
      text: 'День Независимости · Сегодня закрыто — заявки принимаются, обработаем в ближайший рабочий день',
      short: 'Сегодня закрыто · заявки принимаются',
    });
  });
  it('сокращённый день — «Открыто до 15:00», потом «Уже закрыто»', () => {
    const hours = shop([{ date: '2026-09-24', closed: false, opensAt: '10:00', closesAt: '15:00' }]);
    expect(hoursNow(hours, t, at('12:00'))?.short).toBe('Открыто до 15:00');
    expect(hoursNow(hours, t, at('16:00'))?.open).toBe(false);
    expect(hoursNow(hours, t, at('09:30'))?.short).toBe('Откроется в 10:00 · заявки принимаются');
  });
  it('рабочий выходной открывает день, закрытый по сетке', () => {
    const closedWeek = { days: [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, undefined, undefined, true)), timezone: 'Asia/Almaty',
      exceptions: [{ date: '2026-09-24', closed: false, opensAt: '11:00', closesAt: '14:00' }] };
    expect(hoursNow(closedWeek, t, at('12:00'))?.short).toBe('Открыто до 14:00');
  });
  it('исключение другой даты не трогает сегодняшний день', () => {
    expect(hoursNow(shop([{ date: '2026-09-25', closed: true }]), t, at('12:00'))?.open).toBe(true);
  });
  it('ночная смена по вчерашнему исключению идёт и после полуночи', () => {
    const hours = shop([{ date: '2026-09-23', closed: false, opensAt: '20:00', closesAt: '03:00' }]);
    expect(hoursNow(hours, t, at('01:00'))?.short).toBe('Открыто до 3:00');
  });
  it('у круглосуточного магазина праздник всё равно закрывает день', () => {
    const always = { days: [], timezone: 'Asia/Almaty', exceptions: [{ date: '2026-09-24', closed: true }] };
    expect(hoursNow(always, t, at('12:00'))?.open).toBe(false);
    expect(hoursNow({ ...always, exceptions: [] }, t, at('12:00'))?.open).toBe(true);
  });
  it('общий вид часов в праздник говорит «Сегодня закрыто», а не «каждый день»', () => {
    expect(hoursText(shop([{ date: '2026-09-24', closed: true }]), t, at('12:00'))).toBe('Сегодня закрыто');
    expect(hoursText(shop([]), t, at('12:00'))).toBe('Каждый день с 9:00 до 18:00');
  });
});
