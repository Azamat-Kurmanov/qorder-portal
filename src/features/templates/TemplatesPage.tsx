import { SectionHead } from '../shell/SectionHead';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import { FieldFaultText } from '../../ui/Field';
import { useFormRules } from '../../ui/forms/useFormRules';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { cn } from '../../ui/cn';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPortalCartQueryKey,
  getGetPortalTemplatesQueryKey,
  useDeletePortalTemplate,
  useFillPortalCartFromTemplate,
  useGetPortalTemplates,
  useSavePortalTemplate,
  type OrderTemplateDto,
} from '../../api/generated';
import { RepeatOrderButton } from '../orders/RepeatOrderButton';
import { useState } from 'react';
import { Plus, ShoppingCart, X } from '../../ui/icons';

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
  const navigate = useNavigate();
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
  const fill = useFillPortalCartFromTemplate({
    mutation: {
      onSuccess: (result) => {
        if (result.status !== 200) return;
        queryClient.setQueryData(getGetPortalCartQueryKey(), result);
        navigate('/checkout');
      },
    },
  });

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
      <SectionHead title={t('templates.title')} subtitle={t('templates.subtitle')} />

      <RepeatOrderButton row />

      {templates.length === 0 ? (
        <p className="px-1 text-sm text-ink-subtle">{t('templates.empty')}</p>
      ) : (
        templates.map((template, index) => (
          <Reveal key={template.id} delay={Math.min(index, 3) * 0.04}>
            <Card data-testid="template-row" className="flex flex-col gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-bold text-ink">{template.name}</span>
                <span className="text-[0.8125rem] text-ink-subtle">{t('templates.lineCount', { count: template.lineCount })}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  className="h-11 flex-1 gap-2"
                  disabled={fill.isPending}
                  onClick={() => fill.mutate({ templateId: template.id })}
                >
                  <ShoppingCart aria-hidden="true" className="size-[18px]" />
                  {fill.isPending ? t('templates.adding') : t('templates.toCart')}
                </Button>
                <button
                  type="button"
                  aria-label={t('templates.deleteAria', { name: template.name })}
                  onClick={() => remove.mutate({ id: template.id })}
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-muted',
                    'shadow-[inset_0_0_0_1.5px_var(--color-line)] transition-colors hover:text-gone',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  )}
                >
                  <X aria-hidden="true" className="size-[18px]" />
                </button>
              </div>
            </Card>
          </Reveal>
        ))
      )}

      {saving ? saveForm : (
        <Button variant="soft" size="lg" className="w-full gap-2" onClick={() => setSaving(true)}>
          <Plus aria-hidden="true" className="size-5" />
          {t('templates.saveCurrent')}
        </Button>
      )}
    </div>
  );
}
