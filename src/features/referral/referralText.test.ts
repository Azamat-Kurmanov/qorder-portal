import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import ru from '../../i18n/ru.json';
import kk from '../../i18n/kk.json';
import en from '../../i18n/en.json';
import { referralMessage, whatsappHref } from './referralText';

const LINK = 'https://q-order.kz/join/AbC123xyz';

describe('referralMessage', () => {
  it.each([['ru', ru], ['kk', kk], ['en', en]])('текст на %s содержит ссылку целиком', async (lang, bundle) => {
    const instance = i18n.createInstance();
    await instance.init({ lng: lang, resources: { [lang]: { translation: bundle } } });

    expect(referralMessage(LINK, instance.t)).toContain(LINK);
  });

  it('ссылка в wa.me закодирована', () => {
    expect(whatsappHref('a b&c')).toBe('https://wa.me/?text=a%20b%26c');
  });
});
