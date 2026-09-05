import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyPortalOrdersQueryKey,
  useConfirmMyPortalOrder,
  useDeclineMyPortalOrder,
  useGetMyPortalOrders,
  type PortalOrderDto,
} from '../../api/generated';
import { OrderStateBadge } from './OrderStateBadge';
import { RevisionDiff } from './RevisionDiff';
import { RepeatOrderButton } from './RepeatOrderButton';
import { orderDay, positions } from './orderText';
import { tenge } from '../../shared/format';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Reveal } from '../../ui/Reveal';
import { cn } from '../../ui/cn';

/**
 * Мои заявки.
 *
 * Список разложен по тому, за кем ход. Плоским он заставлял бы человека
 * просматривать все заявки подряд, чтобы найти ту одну, где ждут его: то,
 * что требует действия, и то, что идёт само, стояли бы вперемешку и весили
 * одинаково.
 *
 * Внутри группы порядок задаёт сервер. Пересортировать его здесь значит
 * завести второе правило о важности, и однажды список в кабинете разойдётся
 * с тем, что считает важным поставщик.
 *
 * Отдельного пустого экрана «заявок нет» с картинкой нет намеренно: человек
 * пришёл сюда за своей заявкой, и строка текста отвечает на его вопрос быстрее.
 */
export function MyOrdersPage() {
  const response = useGetMyPortalOrders();
  const orders: PortalOrderDto[] = response.data?.status === 200 ? response.data.data : [];

  if (response.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            data-testid="order-skeleton"
            className="h-24 animate-pulse rounded-[var(--radius-card)] border border-hairline bg-sunk"
          />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Мои заявки</h1>
        <p className="text-ink-subtle">Заявок пока нет. Соберите корзину в каталоге и отправьте её.</p>
      </div>
    );
  }

  const repeatable = lastAccepted(orders);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Мои заявки</h1>

      {group(orders).map(({ key, title, items }) => (
        <section
          key={key}
          data-testid={`group-${key}`}
          aria-labelledby={`orders-${key}`}
          className="flex flex-col gap-2.5"
        >
          <h2
            id={`orders-${key}`}
            className="px-1 text-[13px] font-medium tracking-tight text-ink-subtle"
          >
            {title}
          </h2>

          {items.map((order, index) => (
            <Reveal key={order.id} delay={Math.min(index, 3) * 0.04}>
              <OrderCard order={order} repeatable={order.id === repeatable} />
            </Reveal>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Группы: за кем ход.
 *
 * Названы не состояниями, а тем, кто сейчас с заявкой что-то делает. «Нужен
 * ваш ответ» — ход клиента; «У продавца» — ждать; «Решённые» — вопрос закрыт,
 * заглядывать туда незачем. Признак ожидания ответа берётся у сервера
 * (`needsAnswer`), а не выводится из состояния: это его решение о том, что
 * требует действия клиента, и второе такое правило здесь однажды разошлось бы
 * с первым.
 */
const GROUPS: { key: string; title: string; holds: (order: PortalOrderDto) => boolean }[] = [
  { key: 'answer', title: 'Нужен ваш ответ', holds: (order) => order.needsAnswer },
  {
    key: 'supplier',
    title: 'У продавца',
    holds: (order) => order.state !== 'ACCEPTED' && order.state !== 'CLOSED',
  },
  { key: 'settled', title: 'Решённые', holds: () => true },
];

/** Раскладка по группам с сохранением порядка сервера внутри каждой. */
function group(orders: PortalOrderDto[]) {
  return GROUPS.map(({ key, title }, index) => ({
    key,
    title,
    items: orders.filter(
      (order) => GROUPS.findIndex((candidate) => candidate.holds(order)) === index,
    ),
  })).filter((section) => section.items.length > 0);
}

/**
 * У какой заявки предлагать повтор.
 *
 * Адрес повтора заявку не принимает: он кладёт в корзину состав последнего
 * заказа клиента. Поэтому кнопка стоит ровно у одной карточки — самой свежей
 * принятой, — и обещает то, что API умеет. У закрытой её нет: за закрытием
 * может стоять отказ, а это набор, от которого отказались.
 */
function lastAccepted(orders: PortalOrderDto[]): string | undefined {
  return orders
    .filter((order) => order.state === 'ACCEPTED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
}

/**
 * Одна заявка строкой.
 *
 * Дата — ссылка, растянутая на всю карточку (`after:inset-0`), а не карточка-
 * кнопка: внутри стоят свои кнопки, а кнопка в кнопке — недопустимая разметка,
 * из которой браузер и диктор делают каждый своё. Так вся карточка остаётся
 * нажимаемой, а «Согласен» и «Отменить» лежат поверх ссылки и срабатывают
 * сами по себе.
 */
function OrderCard({ order, repeatable }: { order: PortalOrderDto; repeatable: boolean }) {
  const day = orderDay(order.createdAt);

  return (
    <Card
      interactive
      data-testid="order-row"
      className={cn(
        'relative flex flex-col gap-2.5 p-3.5',
        // Тёплая рамка — единственная заявка, где ход за клиентом. Цвет здесь
        // повторяет заголовок группы, а не заменяет его.
        order.needsAnswer && 'border-accent/30',
      )}
    >
      {/*
        В первой группе пилюля молчит: то же самое сказано заголовком группы
        над карточкой, а рядом стоят кнопки ответа. В остальных группах она
        нужна — заголовок не отличает принятую от закрытой.
      */}
      {!order.needsAnswer && <OrderStateBadge state={order.state} />}

      <div className="flex items-baseline justify-between gap-3">
        <Link
          to={`/orders/${order.id}`}
          className={cn(
            'rounded-sm text-[15px] font-medium text-ink after:absolute after:inset-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          )}
        >
          Заявка от {day}
        </Link>
        {/* Суммы моноширинными цифрами: в столбце они сравниваются взглядом. */}
        <span className="shrink-0 text-base font-semibold tabular-nums text-ink">
          {tenge(order.total)}
        </span>
      </div>

      {order.needsAnswer && order.diff.length > 0 ? (
        <RevisionDiff diff={order.diff} variant="sentence" />
      ) : (
        <p className="text-xs text-ink-subtle">{positions(order.submitted.length)}</p>
      )}

      {order.needsAnswer && <Answer order={order} day={day} />}

      {repeatable && (
        <div className="relative z-10">
          <RepeatOrderButton variant="outline" className="w-full" />
        </div>
      )}
    </Card>
  );
}

/**
 * Ответ на пересогласование прямо из списка.
 *
 * Оба действия необратимы, поэтому названы вместе с заявкой: в списке из
 * четырёх карточек «Согласен» само по себе не отличить от соседнего — ни на
 * слух, ни в перечне ссылок диктора. Ширина у них общая, а вид разный:
 * равные кнопки не подсказывают, что выбрать, но и не выглядят одной
 * длинной полосой, по которой палец промахивается.
 */
function Answer({ order, day }: { order: PortalOrderDto; day: string }) {
  const queryClient = useQueryClient();

  const refresh = {
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: getGetMyPortalOrdersQueryKey() }),
  };
  const confirm = useConfirmMyPortalOrder({ mutation: refresh });
  const decline = useDeclineMyPortalOrder({ mutation: refresh });
  const busy = confirm.isPending || decline.isPending;

  return (
    // z-10 — кнопки лежат поверх растянутой ссылки: иначе нажатие открывало бы
    // заявку. gap-2 держит между целями зазор, чтобы палец не задевал соседнюю.
    <div className="relative z-10 flex gap-2">
      <Button
        className="flex-1"
        aria-label={`Согласен с изменениями в заявке от ${day}`}
        disabled={busy}
        onClick={() => confirm.mutate({ id: order.id })}
      >
        {confirm.isPending ? 'Отправляем…' : 'Согласен'}
      </Button>
      <Button
        variant="outline"
        className="flex-1"
        aria-label={`Отменить заявку от ${day}`}
        disabled={busy}
        onClick={() => decline.mutate({ id: order.id })}
      >
        {decline.isPending ? 'Отправляем…' : 'Отменить'}
      </Button>
    </div>
  );
}
