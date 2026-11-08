import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalTemplatesQueryKey,
  useSavePortalTemplateFromOrder,
  type PortalOrderDto,
} from '../../api/generated';
import { rules } from '../../api/rules.generated';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { LayoutTemplate } from '../../ui/icons';

/**
 * «Сохранить шаблоном» у заявки — любой, отменённой тоже: клиент передумал,
 * а состав хочет держать под рукой в «Шаблонах». Название предлагается сразу —
 * «Как заявка №…», его можно поправить.
 */
export function SaveAsTemplate({ order, className }: { order: PortalOrderDto; className?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const save = useSavePortalTemplateFromOrder({
    mutation: { onSuccess: () => void queryClient.invalidateQueries({ queryKey: getGetPortalTemplatesQueryKey() }) },
  });
  const saved = save.data?.status === 201;
  const failed = save.isError || (save.data !== undefined && !saved);
  // Причину называет сервер на языке клиента (например, «в заявке нет товаров из каталога»).
  const detail = (save.error as { info?: { detail?: unknown } } | null)?.info?.detail;

  if (order.submitted.length === 0) return null;
  if (saved) {
    return (
      <p role="status" className={cn('m-0 text-body text-ink', className)}>
        {t('orders.saveTemplate.done')}{' '}
        <Link to="/templates" className="font-semibold text-accent-ink underline underline-offset-[3px]">{t('orders.saveTemplate.open')}</Link>
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="outline" className={cn('h-12 gap-2 font-extrabold', className)}
        onClick={() => { setName(t('orders.saveTemplate.defaultName', { number: order.orderNumber })); setOpen(true); }}>
        <LayoutTemplate aria-hidden="true" className="size-[18px]" />
        {t('orders.saveTemplate.button')}
      </Button>
    );
  }
  return (
    <div data-testid="save-template" className={cn('flex flex-col gap-2', className)}>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">{t('templates.name')}</span>
        <input
          type="text"
          autoFocus
          value={name}
          maxLength={rules.SaveTemplateRequest.name.maxLength}
          onChange={(event) => setName(event.currentTarget.value)}
          className="h-11 w-full rounded-[var(--radius-control)] border-0 bg-sunk px-3 text-body text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>
      {failed ? (
        <p role="alert" className="m-0 text-sm text-gone">
          {typeof detail === 'string' && detail ? detail : t('orders.saveTemplate.failed')}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!name.trim() || save.isPending}
          onClick={() => save.mutate({ orderId: order.id, data: { name: name.trim() } })}>
          {save.isPending ? t('templates.saving') : t('templates.save')}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>{t('templates.auto.cancel')}</Button>
      </div>
    </div>
  );
}
