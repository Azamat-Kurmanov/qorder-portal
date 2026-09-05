import type { SnapshotDiffDto } from '../../api/generated';
import { money, tenge } from '../../shared/format';

/**
 * Чем предложенное отличается от отправленного.
 *
 * Отличия названы словами, а не подсвечены цветом: цвет не читается вслух,
 * не переживает чёрно-белую печать и ничего не значит для человека, который
 * смотрит в телефон на солнце. Показать два состава рядом и не сказать, что
 * именно изменилось, — значит просить сравнивать построчно.
 *
 * Вид один, а мест два. В самой заявке отличия стоят списком: там на них
 * смотрят перед тем, как согласиться. В списке заявок — одной фразой в
 * строке: там достаточно узнать, что случилось, а разбираться человек идёт
 * внутрь. Формулировка при этом общая — разойдись она, в списке и в заявке
 * оказалось бы написано разное про одну и ту же правку.
 */
export function RevisionDiff({ diff, variant = 'list' }: {
  diff: SnapshotDiffDto[];
  variant?: 'list' | 'sentence';
}) {
  if (diff.length === 0) return null;

  if (variant === 'sentence') {
    return (
      <p className="text-xs leading-relaxed text-ink-muted" data-testid="diff">
        Продавец изменил состав: {diff.map(describe).join(', ')}
      </p>
    );
  }

  return (
    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5" data-testid="diff">
      {diff.map((change, index) => (
        <li key={`${change.kind}-${change.name}-${index}`} className="text-sm text-ink">
          {describe(change)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Одно отличие человеческой фразой.
 *
 * Позиция отделена тире, а не двоеточием: в строке списка фразы идут подряд
 * через запятую, и двоеточие внутри каждой превратило бы предложение
 * в перечень оговорок.
 */
function describe(change: SnapshotDiffDto): string {
  switch (change.kind) {
    case 'LINE_ADDED':
      return `Добавлено: ${change.name}${change.now === undefined ? '' : `, ${money(change.now)}`}`;
    case 'LINE_REMOVED':
      return `Убрано: ${change.name}`;
    case 'QUANTITY_CHANGED':
      return `${change.name} — количество ${money(change.was ?? 0)} → ${money(change.now ?? 0)}`;
    case 'PRICE_CHANGED':
      return `${change.name} — цена ${tenge(change.was ?? 0)} → ${tenge(change.now ?? 0)}`;
    case 'DELIVERY_CHANGED':
      return `Доставка: ${change.name}${
        change.now === undefined ? '' : `, ${tenge(change.now)}`
      }`;
  }
}
