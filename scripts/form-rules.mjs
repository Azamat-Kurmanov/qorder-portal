/**
 * Правила проверки полей — из контракта, а не из головы.
 *
 * Правило записано один раз: в аннотации на бэкенде. Сюда оно приезжает
 * тем же путём, что и типы, и здесь ничего не «исправляется» — разошедшееся
 * правило чинится там, где оно объявлено.
 */

/** Схемы, по которым строятся формы: тела запросов и ничто иное. */
const REQUEST_SCHEMA = /Request$/;

/**
 * Правило одного поля.
 *
 * Шаблон якорится и заворачивается в группу. Без якорей он совпал бы
 * с подстрокой, а без группы якоря разошлись бы по краям чередования:
 * `^\d{12}|$` — это «двенадцать цифр в начале ИЛИ пустой конец», то есть
 * что угодно.
 */
export function fieldRule(property, { required }) {
  const rule = { required };
  if (property.pattern) {
    // Флаг `u` — только когда шаблон и правда просит юникод-свойство символа
    // (`\p{...}`/`\P{...}`, как у `\p{L}` — «буква на любом языке»). Без него
    // `\p{L}` в JS без `u` не значит ничего особого — совпадёт с буквальными
    // символами «p», «{», «L», «}», а не с буквами. Ставить `u` всегда нельзя:
    // он запрещает лишние экранирования, которые другие шаблоны уже используют
    // (например, экранированные ASCII-знаки, допустимые только без `u`).
    const needsUnicodeFlag = /\\[pP]\{/.test(property.pattern);
    rule.pattern = new RegExp(`^(?:${property.pattern})$`, needsUnicodeFlag ? 'u' : undefined);
  }
  if (typeof property.minLength === 'number' && property.minLength > 0) {
    rule.minLength = property.minLength;
  }
  if (typeof property.maxLength === 'number') rule.maxLength = property.maxLength;
  if (property.format === 'email') rule.format = 'email';
  if (property.example !== undefined) rule.example = String(property.example);
  return rule;
}

/** Исходный текст модуля правил. */
export function buildRules(schemas) {
  const entries = Object.entries(schemas)
    .filter(([name, schema]) => REQUEST_SCHEMA.test(name) && schema.properties)
    .map(([name, schema]) => {
      const required = new Set(schema.required ?? []);
      const fields = Object.entries(schema.properties)
        // Правило есть только у строк: набор ролей и признаки формой
        // не проверяются, их решает сервер.
        .filter(([, property]) => property.type === 'string')
        .map(([field, property]) => {
          const rule = fieldRule(property, { required: required.has(field) });
          return `    ${field}: ${literal(rule)},`;
        });
      return `  ${name}: {\n${fields.join('\n')}\n  },`;
    });

  return `${HEADER}\nexport const rules = {\n${entries.join('\n')}\n} as const satisfies Record<string, Record<string, FieldRule>>;\n`;
}

/** Значение правила как исходный текст: регулярное выражение — литералом. */
function literal(rule) {
  const parts = Object.entries(rule).map(([key, value]) => {
    if (value instanceof RegExp) return `${key}: ${value.toString()}`;
    return `${key}: ${JSON.stringify(value)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

const HEADER = `/**
 * Создано автоматически: npm run api:generate. Руками не править.
 *
 * Правила приезжают из openapi.json — того же файла, из которого сделаны
 * типы. Разойтись с сервером форма не может: своего мнения о длине телефона
 * у неё нет.
 */

export interface FieldRule {
  required: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  format?: 'email';
  example?: string;
}
`;
