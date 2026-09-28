import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { useGetPortalCatalog, type ItemSaleTerms } from '../../api/generated';
import { useAddToCart } from '../cart/ageGate';
import { fitQuantity } from '../cart/saleTerms';

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
  const [chosen, setChosen] = useState<{ id: string; name: string; terms?: ItemSaleTerms } | null>(null);
  // Одна — по умолчанию, как в макете: чаще всего берут штуку, и пустое
  // поле заставляло бы набирать «1» перед каждым «Добавить».
  const [quantity, setQuantity] = useState<number | string>(1);
  const { add: addToCart } = useAddToCart();

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
    // Те же условия, что у кнопки на витрине: 21+ — после вопроса о возрасте,
    // количество — поднятым до минимума и кратности продавца.
    void addToCart(chosen, fitQuantity(amount, chosen.terms));
    setText('');
    setChosen(null);
    setQuantity(1);
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
            setChosen(found ? { id: found.id, name: found.name, terms: found.terms } : null);
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
  'text-body text-ink placeholder:text-ink-faint',
  'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
);
