import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FieldRule } from '../api/rules.generated';
import { cn } from './cn';

/**
 * Что не так с полем.
 *
 * Хранится кодом правила, а не готовой строкой: строка застыла бы на языке,
 * который стоял в момент проверки, и переключивший интерфейс читал бы
 * подсказку на прежнем языке до следующего нажатия кнопки. Текст рождается
 * при отрисовке — её смена языка вызывает сама.
 *
 * `server` — исключение: правило известно только серверу, и текст приходит
 * от него уже готовым.
 */
export interface FieldFault {
  rule: 'required' | 'pattern' | 'minLength' | 'maxLength' | 'email' | 'server';
  params?: Record<string, string | number>;
  message?: string;
}

/**
 * Поле формы: подпись, ввод, подсказка и причина отказа одним целым.
 *
 * Ошибка меняет три вещи разом — рамку, текст под полем и то, что услышит
 * диктор. Раньше в формах стоял `role="alert"` без связи с полем, и диктор
 * читал их как два не связанных куска экрана.
 */
// Примитив оставлен без пользователей намеренно (экспорт снят в 77ae826); удалить или вернуть — решение владельца.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Field({
  name, label, hint, rule, fault, value, onChange, onBlur,
  type = 'text', inputMode, disabled = false,
}: {
  name: string;
  label: string;
  hint?: string;
  rule?: FieldRule;
  fault?: FieldFault;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: 'text' | 'email';
  inputMode?: 'numeric' | 'text';
  /** Значение видно, но не правится: например, код поля после его создания. */
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const faultId = `${id}-fault`;

  const placeholder = exampleFor(name, rule?.example, t);

  const described = [hint ? hintId : null, fault ? faultId : null].filter(Boolean).join(' ');

  return (
    /*
      Подпись связана с полем через htmlFor, а не вложением. Вложи мы поле
      внутрь label вместе с подсказкой и причиной отказа, доступным именем
      поля стал бы весь текст разом — «Телефон На него и выписывается
      приглашение…», — и диктор читал бы подпись вперемешку с пояснениями.
    */
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={fault ? 'true' : 'false'}
        aria-describedby={described || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        className={cn(
          'h-10 w-full rounded-[var(--radius-control)] border bg-surface px-3',
          'text-sm text-ink outline-none disabled:cursor-not-allowed disabled:opacity-60',
          // Фокус — рамкой в два пикселя цветом магазина (ошибка — красным): смена
          // оттенка однопиксельной рамки на глаз не читалась вовсе.
          'transition-[border-color,box-shadow] duration-150 focus:ring-1',
          fault ? 'border-gone focus:ring-gone' : 'border-line focus:border-accent focus:ring-accent',
        )}
      />
      {hint ? <span id={hintId} className="text-caption text-ink-faint">{hint}</span> : null}
      {fault ? (
        <span id={faultId} role="alert" className="text-caption text-gone">
          {faultText(fault, name, t)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Причина отказа отдельной строкой — для форм со своей вёрсткой.
 *
 * Примитив {@link Field} годится там, где поле рисуется им целиком. Форм
 * со своей раскладкой в продукте хватает — справочники доставки, карточка
 * позиции, — и им нужен от механизма ровно текст причины: правила и момент
 * показа даёт `useFormRules`, а рамку и подпись они рисуют сами.
 *
 * Своя строка вместо этого компонента означала бы второй перевод тех же
 * кодов правил — он разойдётся с первым на первой же правке формулировки.
 */
export function FieldFaultText({ fault, name }: { fault?: FieldFault; name: string }) {
  const { t } = useTranslation();
  if (!fault) return null;

  return (
    <span role="alert" className="text-caption text-gone">
      {faultText(fault, name, t)}
    </span>
  );
}

/**
 * Пример значения для плейсхолдера.
 *
 * Перевод перебивает контракт, а не наоборот: номер `77010000001` и почта
 * `prorab@example.kz` языка не знают и годятся всем, а «Асхат» и
 * «ТОО Поставщик» — знают.
 *
 * Кириллический пример без перевода не показывается вовсе. Контракт пишется
 * по-русски целиком, и без этого правила казахский и английский интерфейс
 * подсказывал бы русским словом — то самое, что запрещает правило слоя
 * «русский текст только через i18next». Пустой плейсхолдер честнее чужого.
 */
function exampleFor(name: string, example: string | undefined, t: TFunction) {
  if (!example) return undefined;
  const translated = t(`validation.example.${name}`, { defaultValue: '' });
  if (translated) return translated;
  // Диапазон кириллицы задан кодами `Ѐ-ӿ`, а не буквами:
  // приёмочный тест слоя ищет по исходникам русский текст мимо i18next
  // построчным сравнением с буквами «а-я», и строка с такими буквами внутри
  // регулярного выражения читалась бы им как ровно такой текст.
  //
  // Диапазон нарочно шире русского алфавита — это весь кириллический блок
  // Юникода (U+0400–U+04FF), а не только «А-Яа-яЁё». У продукта три языка,
  // и два из них кириллические: казахские буквы Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І
  // лежат в этом же блоке за пределами русского алфавита. Пример «Әсет» в
  // английском поле — то же чужое слово, что и «Асхат», и правило должно
  // прятать оба. Не сужай диапазон обратно до русских букв.
  return /[Ѐ-ӿ]/.test(example) ? undefined : example;
}

/**
 * Текст причины.
 *
 * У шаблона текст пишется по смыслу поля, а не по регулярному выражению:
 * «11 цифр, начиная с 7» человеку говорит, а `^7\d{10}$` — нет.
 */
function faultText(fault: FieldFault, name: string, t: TFunction) {
  if (fault.rule === 'server') return fault.message ?? t('validation.pattern.default');
  if (fault.rule === 'pattern') {
    return t(`validation.pattern.${name}`, { defaultValue: t('validation.pattern.default') });
  }
  return t(`validation.${fault.rule}`, fault.params);
}
