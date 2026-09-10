/**
 * Уведомление об обработке данных, разобранное из разметки.
 *
 * Сервер отдаёт текст в Markdown — так объявлено в контракте, и на той же
 * разметке собирается PDF, который клиент потом скачивает из кабинета.
 * Показанный как есть, он встречает человека решётками и звёздочками посреди
 * юридического текста: документ, с которым он соглашается, выглядит
 * недоделанным, и доверия к нему ровно столько же.
 *
 * Разбирается ровно то, что в документе есть: заголовки двух уровней, абзацы,
 * оба вида списков и выделение внутри строки. Готовой библиотеки здесь нет
 * намеренно — она принесла бы разбор произвольной разметки, включая ссылки
 * и встроенный HTML, а текст сюда приходит с нашего же сервера и составом
 * ограничен. Незнакомая разметка на сервере отвергается проверкой при сборке
 * документа, поэтому дойти сюда она не может.
 */

/*
 * Каждый вид блока — свой вариант, а не общий с перечислением признаков:
 * объединение, где у варианта три значения признака, не сужается по одной
 * проверке, и обращение к полям списка перестаёт проверяться типами.
 */
type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

/** Строки склеиваются в абзац: перенос в исходнике — верстка, а не конец мысли. */
function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    if (line === '') {
      flushAll();
      continue;
    }
    if (line.startsWith('## ')) {
      flushAll();
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith('# ')) {
      flushAll();
      blocks.push({ kind: 'h1', text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      if (list?.kind !== 'ul') {
        flushList();
        list = { kind: 'ul', items: [] };
      }
      list.items.push(line.slice(2).trim());
      continue;
    }
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (list?.kind !== 'ol') {
        flushList();
        list = { kind: 'ol', items: [] };
      }
      list.items.push(numbered[2].trim());
      continue;
    }
    // Продолжение пункта списка переносом строки принадлежит пункту,
    // а не начинает абзац посреди перечисления.
    if (list) {
      list.items[list.items.length - 1] += ' ' + line;
      continue;
    }
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

/** Выделение внутри строки: `**так**`. */
function inline(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${index}`} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${index}`}>{part}</span>
    ),
  );
}

export function ConsentNotice({ text }: { text: string }) {
  const blocks = parse(text);

  return (
    <div className="flex flex-col gap-3 text-sm leading-6 text-ink-muted">
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        if (block.kind === 'h1') {
          return (
            <h3 key={key} className="text-base font-semibold leading-6 text-ink">
              {block.text}
            </h3>
          );
        }
        if (block.kind === 'h2') {
          return (
            <h4 key={key} className="mt-2 text-sm font-semibold leading-6 text-ink">
              {block.text}
            </h4>
          );
        }
        if (block.kind === 'p') {
          return <p key={key}>{inline(block.text, key)}</p>;
        }

        const items = block.items.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`} className="pl-1">
            {inline(item, `${key}-${itemIndex}`)}
          </li>
        ));

        return block.kind === 'ul' ? (
          <ul key={key} className="flex list-disc flex-col gap-1 pl-5">
            {items}
          </ul>
        ) : (
          <ol key={key} className="flex list-decimal flex-col gap-1 pl-5">
            {items}
          </ol>
        );
      })}
    </div>
  );
}
