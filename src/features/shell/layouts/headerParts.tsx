import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from '../../../ui/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../../ui/cn';
import { useSupplier } from '../../../supplier/useSupplier';

/*
 * Части шапки кабинета с опубликованным дизайном: поиск, корзина, значки,
 * знак магазина и полоса графика. Из них собраны все раскладки шаблона —
 * обычная шапка, плавающая панель, шапка дока, шапка по центру и колонка
 * «разворота»: что бы ни нарисовал шаблон, поиск, корзина, уведомления,
 * язык, тема, размер шрифта, магазины и график работы остаются на месте.
 */

/**
 * Поиск шапки: запрос, переход и «/» для курсора в поле.
 *
 * Общий у прежней шапки и шапки шаблона: вести себя по-разному им незачем.
 */
export function useHeaderSearch() {
  const navigate = useNavigate();
  const { pathname, search: addressSearch } = useLocation();
  // Запрос витрины живёт в адресе (`/catalog?q=…`). Витрина снимает его
  // сама — кнопкой баннера, «Показать все товары», — и поле шапки идёт
  // следом, иначе в нём остался бы запрос, которого на витрине уже нет.
  // Другие экраны (карточка товара) адрес витрины не трогают.
  const addressQuery = pathname === '/catalog' ? (new URLSearchParams(addressSearch).get('q') ?? '') : undefined;
  const [query, setQuery] = useState(addressQuery ?? '');
  const [seenAddress, setSeenAddress] = useState(addressQuery);
  if (addressQuery !== undefined && addressQuery !== seenAddress) {
    setSeenAddress(addressQuery);
    setQuery(addressQuery);
  }
  const searchRef = useRef<HTMLInputElement>(null);
  const { supplierId } = useSupplier();
  const [searchedIn, setSearchedIn] = useState(supplierId);

  // Набранное в поиске относится к витрине прежнего магазина: в другом
  // поле начинается пустым, а не с чужим запросом.
  if (searchedIn !== supplierId) {
    setSearchedIn(supplierId);
    setQuery('');
  }

  // «/» ставит курсор в поиск, как подсказывает значок в поле: закупщик
  // с клавиатуры ищет, не беря мышь. Нажатия внутри полей ввода не трогаем.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    // Запрос уезжает адресом, а не поднятым в оболочку состоянием: найденное
    // отправляют ссылкой коллеге и открывают в соседней вкладке.
    navigate(trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : '/catalog');
  }

  return { query, setQuery, search, searchRef };
}

/**
 * Поле поиска шапки шаблона. `grow` — во всю оставшуюся ширину; иначе
 * фиксированной ширины, как у шапки дока и колонки «разворота».
 */
export function SearchField({ grow = true, className, bare = false, autoFocus = false, placeholder, hint = true }: {
  grow?: boolean;
  /** Своя подсказка — короткая на телефоне: длинная обрезалась в узком поле. */
  placeholder?: string;
  /** Значок клавиши «/» — подсказка для клавиатуры; на телефоне её нет. */
  hint?: boolean;
  className?: string;
  /** Поле раскрыто нажатием на значок — курсор сразу в нём. */
  autoFocus?: boolean;
  /** Без рамки и подложки — в шапке по центру поиск стоит словом со значком. */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const { query, setQuery, search, searchRef } = useHeaderSearch();
  return (
    <form
      role="search"
      onSubmit={search}
      className={cn(
        'flex h-[2.625rem] min-w-0 cursor-text items-center gap-2.5',
        bare
          ? 'border-b border-transparent px-0 focus-within:border-accent'
          : 'rounded-[var(--radius-small)] border border-line bg-canvas pl-3.5 pr-1.5 transition-colors duration-200 focus-within:border-accent',
        grow ? 'flex-1' : 'w-[17.5rem] shrink-0',
        className,
      )}
    >
      <Search className="size-[18px] shrink-0 text-ink-muted" aria-hidden="true" />
      <input
        ref={searchRef}
        type="search"
        autoFocus={autoFocus}
        aria-label={t('shell.search')}
        aria-keyshortcuts="/"
        placeholder={placeholder ?? (bare ? t('shell.search') : t('shell.searchPlaceholder'))}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      {bare || !hint ? null : (
        <kbd
          aria-hidden="true"
          className="flex h-6 items-center rounded-[var(--radius-small)] border border-line px-2 font-sans text-xs font-semibold text-ink-subtle"
        >
          /
        </kbd>
      )}
    </form>
  );
}
