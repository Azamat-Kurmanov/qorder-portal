import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountCity } from '../city/accountCity';
import { CityPicker } from '../city/CityPicker';
import { countryName } from '../city/countries';
import { MapPin } from '../../ui/icons';

/**
 * «Город» в профиле: тот, что клиент выбрал в окне «Откуда вы?», и смена его.
 * Сотруднику, открывшему витрину, блока нет — города у него не спрашивают.
 */
export function ProfileCity() {
  const { t, i18n } = useTranslation();
  const { city, save } = useAccountCity();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!city || (!city.ask && !city.country)) return null;

  const shown = city.country && city.name
    ? `${city.name}, ${countryName(city.country, i18n.resolvedLanguage ?? 'ru')}`
    : t('city.none');

  return (
    <section className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border-2 border-solid border-hairline bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="flex items-center gap-1.5 text-lead font-extrabold text-ink">
            <MapPin aria-hidden="true" className="size-5 text-shop-ink" />{t('city.label')}
          </b>
          <span className="truncate text-body text-ink-muted">{shown}</span>
        </span>
        <button type="button" aria-expanded={editing} onClick={() => setEditing((was) => !was)}
          className="min-h-11 shrink-0 cursor-pointer rounded-[var(--radius-control)] border-2 border-solid border-line bg-surface px-3.5 text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {t('city.change')}
        </button>
      </div>
      {editing ? (
        <CityPicker country={city.country ?? 'KZ'} busy={busy} onPick={async (request) => {
          setBusy(true);
          setFailed(false);
          const ok = await save(request);
          setBusy(false);
          if (ok) setEditing(false);
          else setFailed(true);
        }} />
      ) : null}
      {failed ? <p role="alert" className="m-0 text-caption text-gone">{t('city.failed')}</p> : null}
    </section>
  );
}
