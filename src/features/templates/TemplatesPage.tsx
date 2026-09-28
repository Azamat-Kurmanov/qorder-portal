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

  const response = useGetPortalTemplates();
  const templates: OrderTemplateDto[] = response.data?.status === 200 ? response.data.data : [];

  const reload = () =>
    queryClient.invalidateQueries({ queryKey: getGetPortalTemplatesQueryKey() });

  const save = useSavePortalTemplate({
    mutation: {
      onSuccess: () => {
        form.reset();
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="qo-page-title">{t('templates.title')}</h1>

      <RepeatOrderButton />

      <Card className="flex flex-col gap-3 p-4">
        <p className="font-semibold text-ink">{t('templates.saveCurrent')}</p>
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
              placeholder={t('templates.namePlaceholder')}
              value={form.values.name}
              // Потолок приезжает из контракта, а не набирается здесь: своего
              // мнения о длине названия у формы нет, и разойтись с сервером
              // ей нечем.
              maxLength={rules.SaveTemplateRequest.name.maxLength}
              aria-invalid={form.faults.name ? 'true' : 'false'}
              onChange={(event) => form.field('name').onChange(event.currentTarget.value)}
              onBlur={form.field('name').onBlur}
              className={cn(
                'h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3',
                'text-body text-ink placeholder:text-ink-faint',
                'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
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

      {templates.length === 0 ? (
        <p className="text-ink-subtle">
          {t('templates.empty')}
        </p>
      ) : (
        templates.map((template, index) => (
          <Reveal key={template.id} delay={Math.min(index, 3) * 0.04}>
            <Card interactive data-testid="template-row" className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold text-ink">{template.name}</span>
                <span className="text-sm text-ink-subtle">
                  {t('templates.lineCount', { count: template.lineCount })}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="chip"
                  variant="soft"
                  disabled={fill.isPending}
                  onClick={() => fill.mutate({ templateId: template.id })}
                >
                  {fill.isPending ? t('templates.adding') : t('templates.toCart')}
                </Button>
                <button
                  type="button"
                  aria-label={t('templates.deleteAria', { name: template.name })}
                  onClick={() => remove.mutate({ id: template.id })}
                  className={cn(
                    'flex size-11 items-center justify-center rounded-[var(--radius-control)]',
                    'text-ink-faint transition-all duration-300 hover:bg-gone/10 hover:text-gone',
                    'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  )}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
                    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </Card>
          </Reveal>
        ))
      )}
    </div>
  );
}
