import { useOrderMode } from '../cart/orderMode';
import { BackTitle } from '../../ui/BackTitle';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { cn } from '../../ui/cn';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalTemplatesQueryKey,
  useDeletePortalTemplate,
  useFillPortalCartFromTemplate,
  useGetPortalTemplates,
  useSavePortalTemplate,
  type OrderTemplateDto,
} from '../../api/generated';
import { RepeatOrderButton } from '../orders/RepeatOrderButton';
import { TemplateSchedule } from './TemplateSchedule';
import { PastOrders } from './PastOrders';
import { TemplateEditor } from './TemplateEditor';
import { NothingAdded, useStayIfEmpty } from '../orders/stayIfEmpty';
import { useState } from 'react';
import { PenLine, Plus, ShoppingCart, X } from '../../ui/icons';

/**
 * Шаблоны закупки: сохранённая корзина под своим названием.
 *
 * Нужны там, где повтор последнего заказа не помогает: у прораба две стройки,
 * и «как в прошлый раз» означает разное на каждой. Название даёт клиент —
 * составом эти списки для него не различаются.
 *
 * Шаблон наполняет корзину, а не отправляет заявку: цены и наличие с тех пор
 * изменились, и отправить старый список молча значило бы заказать по цене,
 * которой уже нет.
 */
export function TemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /*
   * Название — на правилах контракта: обязательно и не длиннее 255. Прежде
   * форма держала только «не пусто», а длинное имя узнавала отказом сервера
   * уже после нажатия.
   */
  const form = useFormRules({ schema: rules.SaveTemplateRequest, initial: { name: '' } });

  const [saving, setSaving] = useState(false);
  const response = useGetPortalTemplates();
  const templates: OrderTemplateDto[] = response.data?.status === 200 ? response.data.data : [];

  const reload = () =>
    queryClient.invalidateQueries({ queryKey: getGetPortalTemplatesQueryKey() });

  const save = useSavePortalTemplate({
    mutation: {
      onSuccess: () => {
        form.reset();
        setSaving(false);
        void reload();
      },
    },
  });
  const remove = useDeletePortalTemplate({ mutation: { onSuccess: () => void reload() } });
  // Товар «оптом и в розницу» ложится в заявку, в которой клиент сейчас (решение владельца 2026-11-06).
  const [orderMode] = useOrderMode();
  // Шаблон заменяет корзину; ничего не легло — остаёмся здесь и называем причину у этого шаблона.
  const { done, nothing, start } = useStayIfEmpty();
  const [filled, setFilled] = useState<string | null>(null);
  // Какой шаблон сейчас правят и какой спрашивают «удалить?» — по одному за раз.
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  /** «Удалить шаблон «…»?» — и в карточке, и под правкой: удаление без вопроса легко сделать случайно. */
  const confirmDelete = (template: OrderTemplateDto) => (
    <div role="alertdialog" aria-label={t('templates.deleteAria', { name: template.name })}
      className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-sunk p-3">
      <p className="m-0 text-body text-ink">{t('templates.deleteQuestion', { name: template.name })}</p>
      <div className="flex gap-2">
        <Button className="flex-1 bg-gone text-white hover:bg-gone/90" disabled={remove.isPending}
          onClick={() => remove.mutate({ id: template.id }, { onSuccess: () => { setDeleting(null); setEditing(null); } })}>
          {t('templates.deleteYes')}
        </Button>
        <Button variant="outline" onClick={() => setDeleting(null)}>{t('templates.auto.cancel')}</Button>
      </div>
    </div>
  );
  const fill = useFillPortalCartFromTemplate({ mutation: { onSuccess: done } });

  // Макет К2.13: повтор прошлой заявки строкой, шаблоны карточками с «В корзину»,
  // сохранение текущей корзины — кнопкой внизу, поле названия раскрывается по нажатию.
  const saveForm = (
    <Card className="flex flex-col gap-3 p-4">
      {/*
        Причина отказа стоит вне подписи: подпись здесь оборачивает поле
        целиком, и вложенная в неё причина вошла бы в доступное имя —
        диктор читал бы «Название Не длиннее 255 символов».
      */}
      <FieldFaultText fault={form.faults.name} name="name" />
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t('templates.name')}</span>
          <input
            type="text"
            autoFocus
            placeholder={t('templates.namePlaceholder')}
            value={form.values.name}
            // Потолок приезжает из контракта, а не набирается здесь.
            maxLength={rules.SaveTemplateRequest.name.maxLength}
            aria-invalid={form.faults.name ? 'true' : 'false'}
            onChange={(event) => form.field('name').onChange(event.currentTarget.value)}
            onBlur={form.field('name').onBlur}
            className={cn(
              'h-11 w-full rounded-[var(--radius-control)] border-0 bg-sunk px-3',
              'text-body text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent',
            )}
          />
        </label>
        <Button
          disabled={!form.isValid || save.isPending}
          onClick={() => {
            if (!form.validate()) return;
            save.mutate({ data: { name: form.values.name.trim() } });
          }}
        >
          {save.isPending ? t('templates.saving') : t('templates.save')}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-3">
      <BackTitle title={t('templates.title')} subtitle={t('templates.subtitle')} />

      <RepeatOrderButton row />

      {saving ? saveForm : (
        <Button variant="outline" size="lg" className="h-14 w-full gap-2 text-lead font-extrabold lg:w-auto lg:self-start lg:px-8" onClick={() => setSaving(true)}>
          <Plus aria-hidden="true" className="size-5" />
          {t('templates.saveCurrent')}
        </Button>
      )}

      {templates.length === 0 ? (
        <p className="px-1 text-sm text-ink-subtle">{t('templates.empty')}</p>
      ) : (
        templates.map((template, index) => (
          <Reveal key={template.id} delay={Math.min(index, 3) * 0.04}>
            <Card data-testid="template-row" className="flex flex-col gap-2.5 p-4">
              {editing === template.id ? (
                <>
                  <TemplateEditor template={template} onDone={() => setEditing(null)} />
                  {/* Вошёл в шаблон — удалить его можно и отсюда, не закрывая правку. */}
                  {deleting === template.id ? confirmDelete(template) : (
                    <Button variant="outline" className="h-12 gap-2 text-gone"
                      aria-label={t('templates.deleteAria', { name: template.name })}
                      onClick={() => setDeleting(template.id)}>
                      <X aria-hidden="true" className="size-[18px]" />
                      {t('templates.deleteTemplate')}
                    </Button>
                  )}
                </>
              ) : (<>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-lead font-extrabold text-ink">{template.name}</span>
                <span className="text-body text-ink-muted">{t('templates.lineCount', { count: template.lineCount })}</span>
              </div>
              <TemplateSchedule template={template} />
              <div className="flex gap-2">
                <Button
                  className="h-14 flex-[2] gap-2 text-lead font-extrabold"
                  disabled={fill.isPending}
                  onClick={() => { start(); setFilled(template.id); fill.mutate({ templateId: template.id, params: { mode: orderMode } }); }}
                >
                  <ShoppingCart aria-hidden="true" className="size-[18px]" />
                  {fill.isPending ? t('templates.adding') : t('templates.toCart')}
                </Button>
              </div>
              {filled === template.id ? <NothingAdded skipped={nothing} /> : null}
              {deleting === template.id ? confirmDelete(template) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="h-12 flex-1 gap-2" onClick={() => { setDeleting(null); setEditing(template.id); }}>
                    <PenLine aria-hidden="true" className="size-[18px]" />
                    {t('templates.edit.button')}
                  </Button>
                  <Button variant="outline" className="h-12 flex-1 gap-2 text-gone"
                    aria-label={t('templates.deleteAria', { name: template.name })}
                    onClick={() => { setEditing(null); setDeleting(template.id); }}>
                    <X aria-hidden="true" className="size-[18px]" />
                    {t('templates.delete')}
                  </Button>
                </div>
              )}
              </>)}
            </Card>
          </Reveal>
        ))
      )}

      <PastOrders />
    </div>
  );
}
