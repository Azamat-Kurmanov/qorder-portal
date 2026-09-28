import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { chooseTheme, useTheme } from '../../ui/theme';
import { cn } from '../../ui/cn';

/**
 * Светлая или тёмная тема — одной кнопкой рядом с размером шрифта.
 *
 * Рядом, потому что это настройки одного рода: как кабинет читается.
 * Кнопка-переключатель (`aria-pressed`), а не меню: вариантов два, и меню
 * ради них — лишнее нажатие. Имя постоянное («Тёмная тема»), а состояние
 * говорит нажатость: диктор прочтёт «Тёмная тема, нажата», и человеку
 * не придётся гадать, что сделает кнопка с именем «Светлая».
 *
 * Выбор покупателя главнее темы, которую задал продавец, и запоминается
 * (`src/ui/theme.ts`); до первого кадра следующего захода его ставит
 * скрипт в `index.html`.
 */
export function ThemeToggle({
  className,
  onBrand = false,
  boxed = false,
  compact = false,
}: {
  className?: string;
  /** Один значок, без подписи, — в шапке шаблона продавца, рядом с корзиной. */
  compact?: boolean;
  /** На фирменной полосе шапки — белым по цвету магазина. */
  onBrand?: boolean;
  /** Квадратная кнопка с обводкой — в строке поиска телефона, рядом с «Аа». */
  boxed?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dark = theme === 'dark';
  const Icon = dark ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label={t('theme.label')}
      aria-pressed={dark}
      onClick={() => chooseTheme(dark ? 'light' : 'dark')}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] px-3',
        'text-sm font-medium transition-all duration-300 ease-out active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2',
        boxed && 'size-13 shrink-0 justify-center rounded-[16px] border-2 border-bar-line bg-surface px-0 text-ink',
        onBrand
          ? 'h-10 text-white hover:bg-white/15 focus-visible:ring-white'
          : 'text-ink-muted hover:bg-ink/5 focus-visible:ring-brand',
        className,
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {/* Подпись называет тему, которая сейчас на экране, — там, где есть ширина. */}
      {!boxed && !compact && <span className="hidden sm:inline">{t(dark ? 'theme.dark' : 'theme.light')}</span>}
    </button>
  );
}
