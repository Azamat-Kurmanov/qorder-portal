import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskQuestionForm } from './AskQuestionForm';
import { QuestionsPage } from './QuestionsPage';
import { renderScreen } from '../../test/render';
import { get, method, stubFetch } from '../../test/http';

/**
 * Ветка — разговор, а не пара «вопрос-ответ»: клиент дописывает в неё
 * сколько угодно раз, и позиция висит на том сообщении, к которому её
 * прикрепили.
 */
const ANSWERED = {
  id: 'q1',
  number: 'ОБР-12',
  awaitingAnswer: false,
  messages: [
    {
      id: 'm1',
      author: 'CUSTOMER',
      text: 'Есть ли доставка до Талгара?',
      itemId: 'item-1',
      itemName: 'Цемент М400',
      createdAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'm2',
      author: 'MANAGER',
      text: 'Возим, 4000 ₸ за рейс.',
      createdAt: '2026-09-01T12:00:00Z',
    },
  ],
};

const WAITING = {
  id: 'q2',
  number: 'ОБР-13',
  awaitingAnswer: true,
  messages: [
    {
      id: 'm3',
      author: 'CUSTOMER',
      text: 'Когда будет М500?',
      createdAt: '2026-09-02T10:00:00Z',
    },
  ],
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
      get('/api/portal/questions/whatsapp-archive', []),
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
    // Подтверждение приходит вместо формы — диктор должен его прочесть сам.
    expect(screen.getByRole('status')).toHaveTextContent('Вопрос отправлен продавцу.');
  });

  it('переписка идёт двумя голосами: вопрос клиента и ответ продавца', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/whatsapp-archive', []),
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

  it('архив WhatsApp — отдельной вкладкой, только чтение, по дням', async () => {
    stubFetch([
      get('/api/portal/questions/whatsapp-archive', [
        { at: '2026-09-30T09:00:00Z', text: 'Есть цемент?', fromShop: false },
        { at: '2026-09-30T09:05:00Z', text: 'Есть, 2 500 ₸', fromShop: true },
      ]),
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions', [ANSWERED]),
    ]);
    renderScreen(<QuestionsPage />);

    await userEvent.click(await screen.findByRole('tab', { name: 'Архив WhatsApp' }));
    expect(screen.getByText('Есть цемент?')).toBeInTheDocument();
    expect(screen.getByText('Есть, 2 500 ₸')).toBeInTheDocument();
    expect(screen.getByText(/это архив: отвечать здесь нельзя/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /написать сообщение/i })).not.toBeInTheDocument();
  });

  it('без переписки в WhatsApp вкладки архива нет', async () => {
    stubFetch([
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions', [ANSWERED]),
    ]);
    renderScreen(<QuestionsPage />);
    await screen.findByText('Есть ли доставка до Талгара?');
    expect(screen.queryByRole('tab', { name: 'Архив WhatsApp' })).not.toBeInTheDocument();
  });

  it('позиция стоит у того сообщения, к которому её прикрепили', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', [ANSWERED]),
    ]);

    renderScreen(<QuestionsPage />);

    // В разговоре о трёх товарах общая плашка сверху лгала бы: спросили
    // про цемент, потом про песок — и ответ про песок читался бы как ответ
    // про цемент.
    const message = await screen.findByTestId('message-m1');
    expect(message).toHaveTextContent('Цемент М400');
    expect(message).toHaveTextContent('Есть ли доставка до Талгара?');
  });

  it('вся переписка идёт одной веткой, а не тремя обращениями подряд', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', [ANSWERED]),
    ]);

    renderScreen(<QuestionsPage />);

    expect(await screen.findByText('Есть ли доставка до Талгара?')).toBeInTheDocument();
    expect(screen.getByText('Возим, 4000 ₸ за рейс.')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^thread-q/)).toHaveLength(1);
  });

  /** О чём спрашивали, узнаётся по снимку быстрее, чем по названию. */
  it('у обсуждаемой позиции — её первое фото', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', {
        ...CARD,
        media: [{ id: 'm-1', kind: 'PHOTO', url: 'https://cdn.example.kz/cement.jpg', position: 0 }],
      }),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', [ANSWERED]),
    ]);

    renderScreen(<QuestionsPage />);

    await screen.findByText(/2 500 ₸/);
    const thumb = screen.getByTestId('item-thumb');
    expect(thumb.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
  });

  it('обсуждаемая позиция кладётся в заявку прямо из переписки', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/cart/lines/item-1', { lines: [], total: 0, skipped: [] }),
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/whatsapp-archive', []),
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

  it('в другой валюте магазина цена обсуждаемой позиции — с её знаком', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', [ANSWERED]),
    ]);

    renderScreen(<QuestionsPage />, { currency: 'RUB' });

    expect(await screen.findByText(/2 500 ₽/)).toBeInTheDocument();
  });

  it('поле внизу отправляет продавцу новое сообщение', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions', { ...WAITING, question: 'Когда привезёте?' }, 201),
      get('/api/portal/questions/whatsapp-archive', []),
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

  it('Enter в поле переписки отправляет сообщение, Shift+Enter переносит строку', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions', { ...WAITING, question: 'Когда?\nИ сколько?' }, 201),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', []),
    ]);

    renderScreen(<QuestionsPage />);

    const field = await screen.findByPlaceholderText('Написать сообщение');
    await userEvent.type(field, 'Когда?{Shift>}{Enter}{/Shift}И сколько?');
    expect(calls.some((call) => call.init?.method === 'POST')).toBe(false);
    await userEvent.type(field, '{Enter}');

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ text: 'Когда?\nИ сколько?' });
    });
  });

  it('Enter в вопросе о товаре отправляет его продавцу', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions', { ...WAITING, itemId: 'item-1' }, 201),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', []),
    ]);

    renderScreen(<AskQuestionForm itemId="item-1" itemName="Цемент М400" />);

    await userEvent.click(screen.getByRole('button', { name: 'Спросить продавца' }));
    await userEvent.type(screen.getByLabelText('Вопрос'), 'Сколько сохнет?{Enter}');

    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ itemId: 'item-1', text: 'Сколько сохнет?' });
    });
  });

  it('пустой список объясняет, зачем сюда приходят', async () => {
    stubFetch([get('/api/portal/questions', [])]);

    renderScreen(<QuestionsPage />);

    expect(await screen.findByText(/здесь вы спрашиваете продавца/i)).toBeInTheDocument();
  });
});
