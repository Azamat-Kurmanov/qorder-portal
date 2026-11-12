import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionsPage } from './QuestionsPage';
import { Route, Routes } from 'react-router-dom';
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

/** Ветка в списке — тема, последнее сообщение и ждёт ли ответа (GET /api/portal/questions). */
const SUMMARY = {
  id: 'q1', number: 'ОБР-12', itemId: 'item-1', itemName: 'Цемент М400', awaitingAnswer: false, unreadAnswers: 1,
  lastMessage: { id: 'm2', author: 'MANAGER', text: 'Возим, 4000 ₸ за рейс.', createdAt: '2026-09-01T12:00:00Z' },
};
const GENERAL = {
  id: 'q2', number: 'ОБР-13', awaitingAnswer: true, unreadAnswers: 0,
  lastMessage: { id: 'm3', author: 'CUSTOMER', text: 'Когда будет М500?', createdAt: '2026-09-02T10:00:00Z' },
};

/** Экран ветки — по её адресу, как его открывают из списка и уведомления. */
function openThread(id = 'q1', options: { currency?: 'RUB' } = {}) {
  return renderScreen(
    <Routes>
      <Route path="/questions/:threadId" element={<QuestionsPage />} />
      <Route path="/questions" element={<QuestionsPage />} />
    </Routes>,
    { route: `/questions/${id}`, ...options },
  );
}

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

  it('список — ветками: тема, последнее сообщение, ждёт ли ответа и новые ответы', async () => {
    stubFetch([
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', [SUMMARY, GENERAL]),
    ]);

    renderScreen(<QuestionsPage />);

    const thread = await screen.findByTestId('thread-q1');
    expect(thread).toHaveAttribute('href', '/questions/q1');
    expect(thread).toHaveTextContent('Цемент М400');
    expect(thread).toHaveTextContent('Продавец: Возим, 4000 ₸ за рейс.');
    expect(thread).toHaveTextContent('Есть ответ');
    expect(screen.getByRole('img', { name: '1 новый ответ' })).toBeInTheDocument();
    const general = screen.getByTestId('thread-q2');
    expect(general).toHaveTextContent('Общий вопрос');
    expect(general).toHaveTextContent('Вы: Когда будет М500?');
    expect(general).toHaveTextContent('Ждёт ответа');
  });

  it('архив WhatsApp — отдельной вкладкой, только чтение, по дням', async () => {
    stubFetch([
      get('/api/portal/questions/whatsapp-archive', [
        { at: '2026-09-30T09:00:00Z', text: 'Есть цемент?', fromShop: false },
        { at: '2026-09-30T09:05:00Z', text: 'Есть, 2 500 ₸', fromShop: true },
      ]),
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions', [SUMMARY]),
    ]);
    renderScreen(<QuestionsPage />);

    await userEvent.click(await screen.findByRole('tab', { name: /^Архив WhatsApp/ }));
    expect(screen.getByText('Есть цемент?')).toBeInTheDocument();
    expect(screen.getByText('Есть, 2 500 ₸')).toBeInTheDocument();
    expect(screen.getByText(/это архив: отвечать здесь нельзя/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /написать сообщение/i })).not.toBeInTheDocument();
  });

  it('поиск по архиву: переписка целиком, найденное подсвечено, стрелки ходят по совпадениям', async () => {
    stubFetch([
      get('/api/portal/questions/whatsapp-archive', [
        { at: '2026-09-30T09:00:00Z', text: 'Есть цемент? Нужен цемент М400', fromShop: false },
        { at: '2026-09-30T09:05:00Z', text: 'Есть, 2 500 ₸', fromShop: true },
      ]),
      get('/api/portal/questions', []),
    ]);
    renderScreen(<QuestionsPage />);

    await userEvent.click(await screen.findByRole('tab', { name: /^Архив WhatsApp/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Найти в переписке' }), 'цемент');
    // Переписка не сужается: сообщение магазина без совпадения на месте.
    expect(screen.getByText('Есть, 2 500 ₸')).toBeInTheDocument();
    const marks = document.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('1 из 2');
    expect(marks[0]).toHaveAttribute('aria-current', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Следующее совпадение' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 из 2');
    expect(marks[1]).toHaveAttribute('aria-current', 'true');
  });

  it('над группой сообщений — кто писал', async () => {
    stubFetch([
      get('/api/portal/questions/whatsapp-archive', [
        { at: '2026-09-30T09:00:00Z', text: 'Есть цемент?', fromShop: false },
        { at: '2026-09-30T09:01:00Z', text: 'И песок?', fromShop: false },
        { at: '2026-09-30T09:05:00Z', text: 'Есть, 2 500 ₸', fromShop: true },
      ]),
      get('/api/portal/questions', []),
    ]);
    renderScreen(<QuestionsPage />);

    await userEvent.click(await screen.findByRole('tab', { name: /^Архив WhatsApp/ }));
    // Два своих подряд — одна подпись «Вы»; ответ магазина — своя подпись.
    expect(screen.getAllByText('Вы')).toHaveLength(1);
    expect(screen.getByText('Магазин')).toBeInTheDocument();
  });

  it('без переписки в WhatsApp вкладки архива нет', async () => {
    stubFetch([
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', [SUMMARY]),
    ]);
    renderScreen(<QuestionsPage />);
    await screen.findByTestId('thread-q1');
    expect(screen.queryByRole('tab', { name: 'Архив WhatsApp' })).not.toBeInTheDocument();
  });

  it('ветка — двумя голосами, позиция у своего сообщения, тема и номер в заголовке', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/q1', ANSWERED),
    ]);
    openThread();

    const question = await screen.findByText('Есть ли доставка до Талгара?');
    expect(question).not.toBe(screen.getByText('Возим, 4000 ₸ за рейс.'));
    expect(screen.getByTestId('message-m1')).toHaveTextContent('Цемент М400');
    expect(screen.getByRole('heading', { name: 'Цемент М400' })).toBeInTheDocument();
    expect(screen.getByText('ОБР-12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/questions');
  });

  /** О чём спрашивали, узнаётся по снимку быстрее, чем по названию. */
  it('у обсуждаемой позиции — её первое фото', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', {
        ...CARD,
        media: [{ id: 'm-1', kind: 'PHOTO', url: 'https://cdn.example.kz/cement.jpg', position: 0 }],
      }),
      get('/api/portal/questions/q1', ANSWERED),
    ]);
    openThread();

    await screen.findByText(/^2 500 ₸/);
    expect(screen.getByTestId('item-thumb').querySelector('img')).toHaveAttribute('src', 'https://cdn.example.kz/cement.jpg');
  });

  it('обсуждаемая позиция кладётся в заявку прямо из ветки', async () => {
    const { calls } = stubFetch([
      method('PUT', '/api/portal/cart/lines/item-1', { lines: [], total: 0, skipped: [] }),
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/q1', ANSWERED),
    ]);
    openThread();

    expect(await screen.findByText(/^2 500 ₸/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в заявку' }));
    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'PUT');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ quantity: 1 });
    });
  });

  it('в другой валюте магазина цена обсуждаемой позиции — с её знаком', async () => {
    stubFetch([
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/q1', ANSWERED),
    ]);
    openThread('q1', { currency: 'RUB' });
    expect(await screen.findByText(/^2 500 ₽/)).toBeInTheDocument();
  });

  it('поле в ветке пишет в неё же, а не заводит новую', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions/q1/messages', ANSWERED, 201),
      get('/api/portal/catalog/item-1', CARD),
      get('/api/portal/questions/q1', ANSWERED),
    ]);
    openThread();

    await userEvent.type(await screen.findByPlaceholderText('Написать сообщение'), 'А в субботу?');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить сообщение' }));
    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(sent?.url).toContain('/api/portal/questions/q1/messages');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ text: 'А в субботу?' });
    });
  });

  it('новый вопрос из списка — новая ветка, и она сразу открывается', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions', { ...WAITING, id: 'q9', number: 'ОБР-20' }, 201),
      get('/api/portal/questions/q9', { ...WAITING, id: 'q9', number: 'ОБР-20' }),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', []),
    ]);
    renderScreen(
      <Routes>
        <Route path="/questions/:threadId" element={<QuestionsPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
      </Routes>,
      { route: '/questions' },
    );

    const field = await screen.findByPlaceholderText('Новый вопрос продавцу');
    await userEvent.type(field, 'Когда?{Shift>}{Enter}{/Shift}И сколько?');
    expect(calls.some((call) => call.init?.method === 'POST')).toBe(false);
    await userEvent.type(field, '{Enter}');
    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ text: 'Когда?\nИ сколько?' });
    });
    expect(await screen.findByText('ОБР-20')).toBeInTheDocument();
  });

  it('пришли из карточки товара — новый вопрос уходит с этой позицией', async () => {
    const { calls } = stubFetch([
      method('POST', '/api/portal/questions', { ...WAITING, id: 'q9', itemId: 'item-1' }, 201),
      get('/api/portal/questions/q9', { ...WAITING, id: 'q9' }),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', []),
    ]);
    renderScreen(
      <Routes>
        <Route path="/questions/:threadId" element={<QuestionsPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
      </Routes>,
      { route: '/questions?item=item-1' },
    );

    await userEvent.type(await screen.findByPlaceholderText('Новый вопрос продавцу'), 'Есть в наличии?{Enter}');
    await waitFor(() => {
      const sent = calls.find((call) => call.init?.method === 'POST');
      expect(JSON.parse(String(sent?.init?.body))).toEqual({ itemId: 'item-1', text: 'Есть в наличии?' });
    });
  });

  it('из карточки товара — прежние переписки о нём и новый вопрос о нём', async () => {
    const about = { ...WAITING, id: 'q1', number: 'ОБР-1', itemId: 'item-1', itemName: 'Цемент М500' };
    const other = { ...WAITING, id: 'q2', number: 'ОБР-2', itemId: 'item-2', itemName: 'Песок' };
    stubFetch([
      get('/api/portal/catalog/item-1', { id: 'item-1', name: 'Цемент М500' }),
      get('/api/portal/questions/whatsapp-archive', []),
      get('/api/portal/questions', [about, other]),
    ]);
    renderScreen(
      <Routes>
        <Route path="/questions" element={<QuestionsPage />} />
      </Routes>,
      { route: '/questions?item=item-1' },
    );

    expect(await screen.findByRole('heading', { name: 'Переписка об этом товаре' })).toBeInTheDocument();
    expect(screen.getByTestId('thread-q1')).toBeInTheDocument();
    expect(screen.queryByTestId('thread-q2')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Все вопросы' })).toHaveAttribute('href', '/questions');
    expect(await screen.findByText('О товаре «Цемент М500»')).toBeInTheDocument();
  });

  it('готовая тема одним нажатием ставит вопрос в поле', async () => {
    stubFetch([get('/api/portal/questions/whatsapp-archive', []), get('/api/portal/questions', [])]);
    renderScreen(<QuestionsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Есть ли в наличии?' }));
    expect(screen.getByPlaceholderText('Новый вопрос продавцу')).toHaveValue('Есть ли в наличии?');
  });

  it('пустой список объясняет, зачем сюда приходят', async () => {
    stubFetch([get('/api/portal/questions', [])]);

    renderScreen(<QuestionsPage />);

    expect(await screen.findByText(/здесь вы спрашиваете продавца/i)).toBeInTheDocument();
  });
});
