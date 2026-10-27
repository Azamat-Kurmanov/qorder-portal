import { dayMonth } from '../../shared/format';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import {
  downloadMyConsent,
  useGetMyPortalConsents,
  type ConsentRecordDto,
} from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { fileNameFrom, saveFile } from '../../shared/download';

/**
 * Согласия клиента: с чем он согласился, когда и на каком языке читал.
 *
 * Запись о согласии в базе доказывает нажатие кнопки, но не текст: через год
 * человек вправе спросить, с чем именно соглашался, а действующая сегодня
 * редакция ответом на этот вопрос не является. Документ поэтому скачивается,
 * а не пересказывается на экране — сервер собирает его из той редакции,
 * которую человек читал.
 *
 * Строк бывает несколько: новая редакция уведомления заводит новое согласие,
 * а прежнее остаётся своей редакции и своего языка.
 */
export function ConsentsBlock() {
  const { t } = useTranslation();
  const { supplierId } = useSupplier();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Согласие принадлежит паре «клиент — поставщик», и запрос без выбранного
  // поставщика получил бы отказ, а не пустой список.
  const consents = useGetMyPortalConsents({ query: { enabled: supplierId !== null } });

  if (supplierId === null) return null;

  const list = consents.data?.status === 200 ? consents.data.data : [];

  // Порядок задаётся здесь, а не принимается на веру: экран отвечает за то,
  // что свежее согласие человек видит первым, независимо от того, в каком
  // порядке строки пришли.
  const rows = [...list].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));

  async function download(consent: ConsentRecordDto) {
    setBusyId(consent.id);
    setFailed(false);
    try {
      const response = await downloadMyConsent(consent.id);
      if (response.status !== 200) {
        setFailed(true);
        return;
      }
      await saveFile(
        response.data,
        fileNameFrom(response.headers, `consent-${consent.version}.pdf`),
      );
    } catch {
      // Молчаливая кнопка хуже отказа: человек нажимает второй раз и решает,
      // что кабинет сломан. Что именно ответил сервер, ему здесь не поможет.
      setFailed(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="consents-title">
      <h2 id="consents-title" className="text-lg font-semibold tracking-tight text-ink">
        {t('profile.consents.title')}
      </h2>

      {consents.isPending && (
        <div className="h-16 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk" />
      )}

      {/*
        Пустой список — обычное состояние: вошедший не по приглашению ничего
        не подписывал, и пустая таблица читалась бы как потерянные данные.
      */}
      {!consents.isPending && rows.length === 0 && (
        <p data-testid="consents-empty" className="text-ink-subtle">
          {t('profile.consents.empty')}
        </p>
      )}

      {rows.map((consent) => (
        <Card
          key={consent.id}
          data-testid="consent-row"
          className="flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="font-medium text-ink">{consentDay(consent.acceptedAt)}</span>
            <span className="text-sm text-ink-muted">
              {t('profile.consents.details', {
                version: consent.version,
                language: languageName(consent.language, t),
              })}
            </span>
          </div>

          {/*
            Редакция стоит в названии кнопки для экранного диктора: строк
            бывает несколько, и подряд идущие «Скачать PDF» между собой
            не различаются вовсе.
          */}
          <Button
            variant="soft"
            disabled={busyId === consent.id}
            aria-label={t('profile.consents.downloadAria', { version: consent.version })}
            onClick={() => void download(consent)}
          >
            {busyId === consent.id
              ? t('profile.consents.preparing')
              : t('profile.consents.download')}
          </Button>
        </Card>
      ))}

      {failed && (
        <p data-testid="consents-failed" role="alert" className="text-sm text-gone">
          {t('profile.consents.failed')}
        </p>
      )}
    </section>
  );
}

/**
 * Язык — словом на себе самом: «ru» в списке собственных документов
 * не говорит человеку ничего, а перевод названия языка на язык интерфейса
 * скрыл бы, что читал он другой текст.
 *
 * Незнакомый код показывается как есть: выдуманное название хуже кода.
 */
function languageName(code: string, t: (key: string) => string): string {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
    ? t(`language.full.${code}`)
    : code;
}

/**
 * Дата с годом, в отличие от остального кабинета: заявки живут неделями,
 * а согласие — годами, и «02.04» без года в справке о себе бесполезно.
 */
function consentDay(iso: string): string {
  return dayMonth(iso, true);
}
