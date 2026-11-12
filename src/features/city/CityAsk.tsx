import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useGuessPortalCity, type SetPortalCityRequest } from '../../api/generated';
import { cn } from '../../ui/cn';
import { useAccountCity } from './accountCity';
import { CityPicker } from './CityPicker';

/**
 * «Откуда вы?» — один раз после входа, пока город не выбран.
 *
 * Город по IP только подсказывает: клиент мог уехать, сидеть через VPN или
 * открыть кабинет из другой страны, поэтому выбор вручную доступен всегда.
 * Закрыть окно без ответа нельзя — город нужен магазинам (доставка, филиал);
 * но и запереть некого: выбрать можно любой город любой страны.
 */
export function CityAsk() {
  const { t } = useTranslation();
  const { city, save } = useAccountCity();
  const asking = city?.ask === true;
  const guessQuery = useGuessPortalCity({ query: { enabled: asking, staleTime: Infinity, retry: false } });
  const guess = guessQuery.data?.status === 200 ? guessQuery.data.data : undefined;
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const answer = async (request: SetPortalCityRequest) => {
    setBusy(true);
    setFailed(false);
    const ok = await save(request);
    setBusy(false);
    if (!ok) setFailed(true);
  };

  const suggested = guess?.country && guess.placeId !== undefined && guess.name ? guess : undefined;

  return (
    <Dialog.Root open={asking}>
      <Dialog.Portal>
        <Dialog.Overlay className="qo-scrim fixed inset-0 z-40 bg-ink/40 dark:bg-black/60" />
        <Dialog.Content
          // Без ответа не закрывается: ни Escape, ни нажатием мимо.
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          // Пояснения под заголовком нет — вопрос «Откуда вы?» понятен сам.
          aria-describedby={undefined}
          className={cn(
            'qo-dialog fixed z-50 border border-hairline bg-surface p-5 shadow-lg',
            // Телефон — окно снизу, под палец; монитор — по центру.
            'inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-[var(--radius-gallery)]',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(26rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-gallery)]',
          )}
        >
          <Dialog.Title className="m-0 text-base font-semibold text-ink">{t('city.title')}</Dialog.Title>

          <div className="mt-4">
            {suggested && !picking ? (
              <div className="flex flex-col gap-2">
                <p className="m-0 text-body text-ink">{t('city.guess', { name: suggested.name })}</p>
                <button type="button" disabled={busy}
                  onClick={() => void answer({ country: suggested.country!, placeId: suggested.placeId })}
                  className="h-12 cursor-pointer rounded-[var(--radius-control)] border-0 bg-accent px-4 text-body font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60">
                  {t('city.confirm')}
                </button>
                <button type="button" onClick={() => setPicking(true)}
                  className="h-12 cursor-pointer rounded-[var(--radius-control)] border border-hairline bg-transparent px-4 text-body font-medium text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {t('city.other')}
                </button>
              </div>
            ) : guessQuery.isPending && !picking ? null : (
              <CityPicker country={guess?.country ?? 'KZ'} busy={busy} onPick={(request) => void answer(request)} />
            )}
          </div>
          {failed ? <p role="alert" className="m-0 mt-3 text-caption text-gone">{t('city.failed')}</p> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
