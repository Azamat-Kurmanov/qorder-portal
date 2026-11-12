import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchPortalPlaces, type SetPortalCityRequest } from '../../api/generated';
import { cn } from '../../ui/cn';
import { countryOptions } from './countries';

const FIELD = cn('h-12 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-body text-ink',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent');
const ROW = cn('flex min-h-11 w-full cursor-pointer items-center rounded-[var(--radius-control)] border-0 bg-transparent px-3',
  'text-left text-body text-ink hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  'disabled:cursor-wait disabled:opacity-60');

/**
 * Выбор страны и города: общий для окна «Откуда вы?» и профиля.
 *
 * Страна — своим списком с поиском, а не `<select>`: системный список Chrome под Linux
 * закрывался, едва отпускали кнопку мыши, — выбрать можно было, только не отпуская её.
 * Город — поиском по справочнику; пока ничего не вписано — крупнейшие города страны;
 * нет в справочнике — записывается как вписан.
 */
export function CityPicker({ country: initialCountry = 'KZ', onPick, busy = false }: {
  country?: string;
  onPick: (request: SetPortalCityRequest) => void;
  busy?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'ru';
  const countries = useMemo(() => countryOptions(language), [language]);
  const [country, setCountry] = useState(initialCountry);
  const [choosing, setChoosing] = useState(false);
  const [filter, setFilter] = useState('');
  const labelId = useId();
  const needle = filter.trim().toLocaleLowerCase(language);
  const shownCountries = needle === '' ? countries
    : countries.filter((option) => option.name.toLocaleLowerCase(language).includes(needle));
  const countryLabel = countries.find((option) => option.code === country)?.name ?? country;
  const chooseCountry = (code: string) => {
    setCountry(code);
    setChoosing(false);
    setFilter('');
    // Город прежней страны в новой не ищется: поле — с чистого листа, ниже — города новой страны.
    setTyped('');
    setQuery('');
  };
  const [typed, setTyped] = useState('');
  // Поиск — после паузы в наборе, а не на каждую букву.
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), 250);
    return () => clearTimeout(timer);
  }, [typed]);

  const search = useSearchPortalPlaces({ country, q: query }, { query: { staleTime: 60_000 } });
  const places = search.data?.status === 200 ? search.data.data : [];
  const settled = !search.isFetching && query === typed.trim();
  // Вписанное — запасной выход, пока в списке нет ровно этого названия: «Ал» нашло Алматы, а человеку нужен Алга.
  const exact = places.some((place) => place.name?.toLocaleLowerCase(language) === query.toLocaleLowerCase(language));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${labelId}-input`} id={labelId} className="text-caption font-bold text-ink-muted">{t('city.country')}</label>
        {/* Одно поле: щелчок раскрывает список, набор — ищет, выбор вписывает страну и закрывает список. */}
        <input id={`${labelId}-input`} type="text" role="combobox" aria-expanded={choosing} aria-controls={`${labelId}-list`}
          aria-autocomplete="list" autoComplete="off"
          value={choosing ? filter : countryLabel} placeholder={countryLabel}
          onClick={() => setChoosing(true)}
          onChange={(event) => { setFilter(event.target.value); setChoosing(true); }}
          onBlur={() => { setChoosing(false); setFilter(''); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && choosing) { event.preventDefault(); event.stopPropagation(); setChoosing(false); setFilter(''); }
            if (event.key === 'Enter' && choosing && shownCountries[0]) { event.preventDefault(); chooseCountry(shownCountries[0].code); }
          }}
          className={cn(FIELD, 'cursor-pointer')} />
        {choosing ? (
          <div id={`${labelId}-list`} role="listbox" aria-labelledby={labelId}
            className="flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-control)] border border-hairline bg-surface p-1">
            {shownCountries.map((option) => (
              // mousedown без фокуса: иначе поле теряет фокус и закрывает список раньше, чем выбор дойдёт.
              <button key={option.code} type="button" role="option" aria-selected={option.code === country} tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseCountry(option.code)}
                className={cn(ROW, option.code === country && 'font-bold')}>
                {option.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {/* Пока выбирают страну — города не видно: два списка подряд путают. */}
      {choosing ? null : (<>
      <label className="flex flex-col gap-1 text-caption font-bold text-ink-muted">
        {t('city.city')}
        <input type="text" value={typed} onChange={(event) => setTyped(event.target.value)}
          placeholder={t('city.placeholder')} autoComplete="address-level2" className={FIELD} />
      </label>
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {places.map((place) => (
          <button key={place.placeId} type="button" disabled={busy} className={ROW}
            onClick={() => onPick({ country, placeId: place.placeId })}>
            {place.name}
          </button>
        ))}
        {settled && query !== '' && !exact ? (
          <button type="button" disabled={busy} className={cn(ROW, 'font-bold text-accent-ink')}
            onClick={() => onPick({ country, cityName: query })}>
            {t('city.typed', { q: query })}
          </button>
        ) : null}
      </div>
      </>)}
    </div>
  );
}
