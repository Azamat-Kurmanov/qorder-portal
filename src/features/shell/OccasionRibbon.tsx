import { useTranslation } from 'react-i18next';

/**
 * Праздничная плашка под шапкой: поздравление магазина в дни повода.
 *
 * Цвет — второй цвет праздничного оформления (`--color-accent2`), так что
 * плашка и фактура фона говорят об одном празднике. Уходит сама вместе с
 * праздником: её показывает только `resolveDesign` в дни повода.
 */
export function OccasionRibbon({ occasion }: { occasion: string }) {
  const { t } = useTranslation();
  return (
    <p
      data-testid="occasion-ribbon"
      className="m-0 bg-accent2 px-4 py-2 text-center text-sm font-semibold text-accent2-ink"
    >
      {t(`shell.occasion.${occasion}`)}
    </p>
  );
}
