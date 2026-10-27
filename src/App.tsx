import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { CallbackPage } from './auth/CallbackPage';
import { RequireAuth } from './auth/RequireAuth';
import { ActivationPage } from './features/activation/ActivationPage';
import { JoinPage } from './features/join/JoinPage';
import { JoinShopPage } from './features/joinShop/JoinShopPage';
import { Shell } from './features/shell/Shell';
import { SupplierProvider } from './supplier/SupplierProvider';
import { withViewTransitions } from './ui/motion/viewTransitions';

/**
 * Маршруты кабинета.
 *
 * Публичных три: активация приглашения — у клиента, который открывает ссылку,
 * токена ещё может не быть, — и страница приглашённого поставщика. Всё остальное закрыто входом,
 * а внутри — ещё и выбором поставщика: без него запросы уходили бы без
 * заголовка и получали отказ.
 *
 * Разделы и их разметка живут в оболочке (`features/shell`), а не здесь:
 * этот файл отвечает за то, что открыто без входа, и ни за что больше.
 */
/**
 * Data-router — ради плавных переходов между экранами (`viewTransition`, см.
 * `ui/motion/viewTransitions.ts`); разделы по-прежнему вложенными `<Routes>` оболочки.
 */
const router = withViewTransitions(createBrowserRouter(createRoutesFromElements(
  <>
    <Route path="/activate" element={<ActivationPage />} />
    {/* Страница для поставщика, которого позвал клиент: у поставщика входа нет вовсе. */}
    <Route path="/join/:code?" element={<JoinPage />} />
    {/* Заявка клиента в магазин по его ссылке или QR — гость без входа (backend.md §18.28, п. 6). */}
    <Route path="/join-shop/:code" element={<JoinShopPage />} />
    <Route path="/callback" element={<CallbackPage />} />
    <Route
      path="/*"
      element={(
        <RequireAuth>
          <SupplierProvider>
            <Shell />
          </SupplierProvider>
        </RequireAuth>
      )}
    />
  </>,
)));

export function App() {
  return <RouterProvider router={router} />;
}
