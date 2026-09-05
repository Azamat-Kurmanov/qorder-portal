import { useState } from 'react';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const response = useGetPortalTemplates();
  const templates: OrderTemplateDto[] = response.data?.status === 200 ? response.data.data : [];

  const reload = () =>
    queryClient.invalidateQueries({ queryKey: getGetPortalTemplatesQueryKey() });

  const save = useSavePortalTemplate({
    mutation: {
      onSuccess: () => {
        setName('');
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
      <h1 className="text-xl font-semibold tracking-tight text-ink">Шаблоны</h1>

      <RepeatOrderButton />

      <Card className="flex flex-col gap-3 p-4">
        <p className="font-semibold text-ink">Сохранить текущую корзину</p>
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Название</span>
            <input
              type="text"
              placeholder="Например: объект на Абая"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              className={cn(
                'h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3',
                'text-[15px] text-ink placeholder:text-ink-faint',
                'transition-all duration-300 focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
              )}
            />
          </label>
          <Button
            disabled={name.trim().length === 0 || save.isPending}
            onClick={() => save.mutate({ data: { name: name.trim() } })}
          >
            {save.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </Card>

      {templates.length === 0 ? (
        <p className="text-ink-subtle">
          Шаблонов пока нет. Соберите корзину и сохраните её под названием.
        </p>
      ) : (
        templates.map((template, index) => (
          <Reveal key={template.id} delay={Math.min(index, 3) * 0.04}>
            <Card interactive data-testid="template-row" className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold text-ink">{template.name}</span>
                <span className="text-sm text-ink-subtle">позиций: {template.lineCount}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="chip"
                  variant="soft"
                  disabled={fill.isPending}
                  onClick={() => fill.mutate({ templateId: template.id })}
                >
                  {fill.isPending ? 'Кладём…' : 'В корзину'}
                </Button>
                <button
                  type="button"
                  aria-label={`Удалить шаблон ${template.name}`}
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
