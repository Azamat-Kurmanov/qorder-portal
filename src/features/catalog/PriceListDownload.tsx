import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadPortalPriceList, type DownloadPortalPriceListFormat } from '../../api/generated';
import { fileNameFrom, saveFile } from '../../shared/download';
import { cn } from '../../ui/cn';
import { ChevronDown, FileText } from '../../ui/icons';
import { useDismiss } from '../../ui/useDismiss';

/**
 * Прайс-лист файлом (R-08): открытый раздел или вся витрина, с ценами этого клиента на сегодня.
 * Его пересылают закупщику и печатают — поэтому PDF и Excel, а не экран.
 *
 * На мониторе — выпадающим меню «Прайс-лист ▾» (просьба владельца 2026-11-05): в нём пояснение,
 * за что указана цена (`note`), и две ссылки для скачивания со значками.
 */
export function PriceListDownload({ categoryId, note }: { categoryId?: string; note?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DownloadPortalPriceListFormat | null>(null);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, useCallback(() => setOpen(false), []), box);

  async function download(format: DownloadPortalPriceListFormat) {
    setBusy(format);
    setFailed(false);
    try {
      const file = await downloadPortalPriceList({ categoryId, format });
      if (file.status !== 200) {
        setFailed(true);
        return;
      }
      await saveFile(file.data as Blob, fileNameFrom(file.headers, `price.${format}`));
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  const item = (format: DownloadPortalPriceListFormat, label: string, badge: string, tone: string, badgeTone: string) => (
    <button type="button" role="menuitem" aria-label={label} disabled={busy !== null} onClick={() => void download(format)}
      className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-2.5 text-left text-body font-bold text-ink hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60">
      <span aria-hidden="true" className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
        <FileText className="size-5" />
        <span className={cn('absolute -bottom-1 -right-1 rounded px-1 text-2xs font-black leading-[0.875rem] text-white', badgeTone)}>{badge}</span>
      </span>
      <span className="flex-1">{busy === format ? t('catalog.priceList.preparing') : label}</span>
    </button>
  );

  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((was) => !was)}
        className={cn('flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border-[1.5px] bg-surface pl-3 pr-2.5 text-sm font-bold text-ink',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', open ? 'border-ink-muted' : 'border-line hover:border-ink-muted')}>
        <FileText aria-hidden="true" className="size-[1.125rem]" />
        {t('catalog.priceList.button')}
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div role="menu" aria-label={t('catalog.priceList.title')} hidden={!open}
        className={cn('absolute right-0 top-[calc(100%+0.5rem)] z-30 w-80 origin-top-right rounded-2xl border border-hairline bg-surface p-3',
          'shadow-[0_18px_40px_-14px_rgba(26,25,23,.35)] animate-[qo-menu-in_160ms_cubic-bezier(0.22,0.61,0.36,1)]')}>
        <p className="m-0 px-1 text-body font-extrabold text-ink">{t('catalog.priceList.title')}</p>
        {note ? <p className="m-0 mt-1 px-1 text-caption leading-snug text-ink-muted">{note}</p> : null}
        <div className="mt-2 flex flex-col gap-0.5">
          {item('pdf', t('catalog.priceList.pdf'), 'PDF', 'bg-sale-soft text-sale-ink', 'bg-sale')}
          {item('xlsx', t('catalog.priceList.excel'), 'XLS', 'bg-ok-soft text-shop-ink', 'bg-shop')}
        </div>
        {failed ? <p role="alert" className="m-0 mt-2 px-1 text-caption text-gone">{t('catalog.priceList.failed')}</p> : null}
      </div>
    </div>
  );
}
