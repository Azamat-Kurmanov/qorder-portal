import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { CallbackPage } from './auth/CallbackPage';
import { RequireAuth } from './auth/RequireAuth';
import { Shell } from './features/shell/Shell';
import { SupplierProvider } from './supplier/SupplierProvider';
import { RouteError } from './ui/RouteError';
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
 * Публичные страницы — отдельными кусками (`lazy` маршрута): клиенту кабинета
 * они не нужны вовсе, а гостю по ссылке не нужен кабинет.
 *
 * Data-router — ради плавных переходов между экранами (`viewTransition`, см.
 * `ui/motion/viewTransitions.ts`); разделы по-прежнему вложенными `<Routes>` оболочки.
 */
const router = withViewTransitions(createBrowserRouter(createRoutesFromElements(
  // Сбой любого экрана — «Нет связи» с повтором, а не служебная страница роутера.
  <Route errorElement={<RouteError />}>
    <Route path="/activate" lazy={() => import('./features/activation/ActivationPage').then((module) => ({ Component: module.ActivationPage }))} />
    {/* Страница для поставщика, которого позвал клиент: у поставщика входа нет вовсе. */}
    <Route path="/join/owner/:token" lazy={() => import('./features/join/JoinOwnerPage').then((module) => ({ Component: module.JoinOwnerPage }))} />
    <Route path="/join/:code?" lazy={() => import('./features/join/JoinPage').then((module) => ({ Component: module.JoinPage }))} />
    {/* Заявка клиента в магазин по его ссылке или QR — гость без входа (backend.md §18.28, п. 6). */}
    <Route path="/join-shop/:code" lazy={() => import('./features/joinShop/JoinShopPage').then((module) => ({ Component: module.JoinShopPage }))} />
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
  </Route>,
)));

export function App() {
  return <RouterProvider router={router} />;
}
