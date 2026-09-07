import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { useGetPortalCatalog } from '../../api/generated';
import { useSetCartLine } from '../cart/useCart';

/**
 * Быстрый ввод: одно поле с автоподбором.
 *
 * Тот, кто знает, что берёт, набирает «цем», выбирает позицию, вводит
 * количество и жмёт «Добавить» — фокус возвращается в поле, и следующая
 * позиция набирается сразу. Это не второй способ оформить заявку, а второй
 * вход в ту же корзину.
 *
 * Подбор идёт по тому же поиску, что и витрина: искать здесь иначе значило бы
 * находить не то, что показывает каталог.
 */
export function QuickInput() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [quantity, setQuantity] = useState<number | string>('');
  const setLine = useSetCartLine();

  const suggestions = useGetPortalCatalog(
    { query: text.trim(), page: 0, size: 10 },
    // Пока набрано меньше двух букв, подбирать не по чему: запрос вернул бы
    // начало каталога и выглядел бы как случайные подсказки.
    { query: { enabled: text.trim().length >= 2 } },
  );

  const items = suggestions.data?.status === 200 ? (suggestions.data.data.items ?? []) : [];

  const add = () => {
    const amount = typeof quantity === 'number' ? quantity : Number(quantity);
    if (!chosen || !Number.isFinite(amount) || amount <= 0) return;
    setLine.mutate({ itemId: chosen.id, data: { quantity: amount } });
    setText('');
    setChosen(null);
    setQuantity('');
  };

  return (
    <div className="flex items-end gap-2">
      {/*
        Список подсказок — нативный datalist, а не выпадающий компонент:
        на телефоне он открывается системным списком, который не спорит
        с клавиатурой за нижнюю половину экрана и не требует своей ловушки
        фокуса. Ради одного поля тянуть комбобокс не за что.
      */}
      <div className="min-w-0 flex-1">
        <input
          type="text"
          aria-label={t('catalog.quickInput')}
          placeholder={t('catalog.quickInputPlaceholder')}
          list="quick-input-options"
          value={text}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setText(value);
            const found = items.find((item) => item.name === value);
            setChosen(found ? { id: found.id, name: found.name } : null);
          }}
          className={FIELD}
        />
        <datalist id="quick-input-options">
          {items.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </div>

      <input
        type="number"
        inputMode="numeric"
        aria-label={t('catalog.quickInputQuantity')}
        placeholder="0"
        min={0}
        value={quantity}
        onChange={(event) => setQuantity(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') add();
        }}
        className={cn(FIELD, 'w-20 text-center tabular-nums')}
      />

      <Button onClick={add} disabled={!chosen}>{t('catalog.add')}</Button>
    </div>
  );
}

const FIELD = cn(
  'h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3',
  'text-[15px] text-ink placeholder:text-ink-faint',
  'transition-all duration-300 focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-brand/30',
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
);
