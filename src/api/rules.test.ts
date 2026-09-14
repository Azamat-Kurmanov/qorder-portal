import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rules } from './rules.generated';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (/\.generated\.tsx?$/.test(entry.name)) return [];
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Правило поля живёт в контракте, а не в разметке.
 *
 * Ровно этим механизмом однажды разошлись сервер и Keycloak: правило было
 * записано дважды, и синхронность держалась на дисциплине. Здесь она держится
 * на прогоне.
 */
describe('правила полей', () => {
  it('приезжают из контракта: потолки полей кабинета известны', () => {
    expect(rules.AskQuestionRequest.text.maxLength).toBe(2000);
    expect(rules.SubmitReviewRequest.text.maxLength).toBe(2000);
    expect(rules.SubmitOrderRequest.note.maxLength).toBe(1000);
    expect(rules.SaveTemplateRequest.name.maxLength).toBe(255);
  });

  /*
   * Потолок, набранный числом в разметке, — вторая запись того же правила.
   * Разойдётся она молча: сервер отвергнет то, что форма пустила, и человек
   * увидит общий отказ вместо подсказки.
   */
  it('ни одно поле не объявляет свой потолок числом', () => {
    const literal = /maxLength=\{\s*\d+\s*\}/;

    const offenders = sourceFiles(SRC)
      .filter((file) => literal.test(readFileSync(file, 'utf8')))
      .map((file) => `${file}: потолок записан числом — возьми его из rules.generated`);

    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });

  /*
   * Причина отказа не должна лежать внутри <label>.
   *
   * Подпись, обёрнутая вокруг поля, отдаёт диктору всё своё содержимое как имя
   * поля: с вложенной причиной он читает «Название Не длиннее 255 символов»,
   * и искать поле приходится по этой же строке. Ровно так и вышло, когда
   * проверку подключали к справочникам доставки первый раз — поймал тест,
   * который перестал находить поле по подписи.
   */
  it('ни одна причина отказа не стоит внутри подписи поля', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const block of source.match(/<label[\s\S]*?<\/label>/g) ?? []) {
        if (block.includes('<FieldFaultText')) {
          offenders.push(`${file}: причина отказа внутри <label> — вынеси её наружу`);
        }
      }
    }

    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });
});
