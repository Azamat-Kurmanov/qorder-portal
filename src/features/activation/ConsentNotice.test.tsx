import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConsentNotice } from './ConsentNotice';

/**
 * Уведомление приходит с сервера в разметке Markdown — так объявлено
 * в контракте, и на той же разметке собирается PDF документа о согласии.
 * Показанное как есть, оно встречает человека решётками и звёздочками
 * посреди юридического текста: документ, с которым он соглашается, выглядит
 * недоделанным, и доверия к нему ровно столько же.
 */
describe('уведомление об обработке данных', () => {
  it('заголовки становятся заголовками, а не строкой с решётками', () => {
    render(<ConsentNotice text={'## 1. Кто обрабатывает ваши данные\n\nТекст абзаца.'} />);

    expect(screen.getByRole('heading', { name: '1. Кто обрабатывает ваши данные' })).toBeInTheDocument();
    expect(screen.queryByText(/##/)).not.toBeInTheDocument();
  });

  it('жирное выделение не показывается звёздочками', () => {
    render(<ConsentNotice text={'**Собственник базы** — поставщик, который вас пригласил.'} />);

    expect(screen.getByText('Собственник базы').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('маркированный список становится списком', () => {
    render(<ConsentNotice text={'- номер телефона;\n- имя и фамилия.'} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('номер телефона;')).toBeInTheDocument();
  });

  it('нумерованный список сохраняет номера', () => {
    render(<ConsentNotice text={'1. Знать, какие данные есть.\n2. Требовать блокирования.'} />);

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('перенесённая строка абзаца склеивается, а не рвёт предложение', () => {
    render(<ConsentNotice text={'Согласие действует, пока у вас открыт\nкабинет у этого поставщика.'} />);

    expect(
      screen.getByText('Согласие действует, пока у вас открыт кабинет у этого поставщика.'),
    ).toBeInTheDocument();
  });
});
