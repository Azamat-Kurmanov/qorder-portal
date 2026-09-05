import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskQuestionForm } from './AskQuestionForm';
import { QuestionsPage } from './QuestionsPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

const ANSWERED = {
  id: 'q1',
  number: 'ОБР-12',
  itemId: 'item-1',
  itemName: 'Цемент М400',
  question: 'Есть ли доставка до Талгара?',
  askedAt: '2026-09-01T10:00:00Z',
  answer: 'Возим, 4000 ₸ за рейс.',
  answeredAt: '2026-09-01T12:00:00Z',
  answered: true,
};

const WAITING = {
  id: 'q2',
  number: 'ОБР-13',
  question: 'Когда будет М500?',
  askedAt: '2026-09-02T10:00:00Z',
  answered: false,
};

const CARD = {
  id: 'item-1',
  name: 'Цемент М400',
  unit: 'мешок',
  price: 2500,
  media: [],
  attributes: [],
  favorite: false,
  canReview: false,
};

describe('вопросы продавцу', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('вопрос о товаре уходит вместе с позицией, о которой спрашивают', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions', { ...WAITING, itemId: 'item-1', question: 'Сколько сохнет?' }, 201),
      get('/api/portal/questions', []),
    ]);

    renderScreen(<AskQuestionForm itemId="item-1" itemName="Цемент М400" />);

    await userEvent.click(screen.getByRole('button', { name: 'Спросить продавца' }));
    await userEvent.type(screen.getByLabelText('Вопрос'), 'Сколько сохнет?');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent).toBeDefined();
      // Позиция уезжает вместе с вопросом: без неё менеджер читает «сколько
      // сохнет?» и не знает, о чём речь.
      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        itemId: 'item-1',
        text: 'Сколько сохнет?',
      });
    });

    expect(await screen.findByText(/вопрос отправлен/i)).toBeInTheDocument();
  });

  it('переписка идёт двумя голосами: вопрос клиента и ответ продавца', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions', [ANSWERED, WAITING]),
    ]);

    renderScreen(<QuestionsPage />);

    const question = await screen.findByText('Есть ли доставка до Талгара?');
    const answer = screen.getByText('Возим, 4000 ₸ за рейс.');
    // Разные пузыри, а не два абзаца подряд: одинаковые превратили бы
    // переписку в монолог, в котором не видно, кто что сказал.
    expect(question).not.toBe(answer);
    expect(screen.getByTestId('thread-q1')).toContainElement(question);
    // Имени менеджера в контракте нет — подпись говорит ровно то, что известно.
    expect(screen.getByText(/ответ продавца/i)).toBeInTheDocument();
    expect(screen.getByText(/ждёт ответа/i)).toBeInTheDocument();
    expect(screen.getByText('ОБР-12')).toBeInTheDocument();
  });

  it('над перепиской стоит обсуждаемая позиция и дата вопроса', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions', [ANSWERED]),
    ]);

    renderScreen(<QuestionsPage />);

    // Без позиции и даты три разговора о трёх товарах читаются как один.
    const subject = await screen.findByTestId('thread-subject-q1');
    expect(subject).toHaveTextContent('Цемент М400');
    expect(subject).toHaveTextContent('01.09');
  });

  it('обсуждаемая позиция кладётся в заявку прямо из переписки', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/cart/lines/item-1', { lines: [], total: 0, skipped: [] }),
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions', [ANSWERED]),
    ]);

    renderScreen(<QuestionsPage />);

    // Цена берётся из карточки позиции: в переписке её нет, а решают по ней.
    expect(await screen.findByText(/2 500 ₸/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в заявку' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 1 });
    });
  });

  it('поле внизу отправляет продавцу новое сообщение', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions', { ...WAITING, question: 'Когда привезёте?' }, 201),
      get('/api/portal/questions', []),
    ]);

    renderScreen(<QuestionsPage />);

    await userEvent.type(
      await screen.findByPlaceholderText('Написать сообщение'),
      'Когда привезёте?',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Отправить сообщение' }));

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent).toBeDefined();
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ text: 'Когда привезёте?' });
    });
  });

  it('пустой список объясняет, зачем сюда приходят', async () => {
    stubFetch([get('/api/portal/questions', [])]);

    renderScreen(<QuestionsPage />);

    expect(await screen.findByText(/здесь вы спрашиваете продавца/i)).toBeInTheDocument();
  });
});
