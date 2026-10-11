import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { CallbackPage } from './auth/CallbackPage';
import { RequireAuth } from './auth/RequireAuth';
import { ActivationPage } from './features/activation/ActivationPage';
import { Shell } from './features/shell/Shell';
import { SupplierProvider } from './supplier/SupplierProvider';
import { withViewTransitions } from './ui/motion/viewTransitions';

/**
 * Маршруты кабинета.
 *
 * Публичный здесь ровно один — активация приглашения: у клиента, который
 * открывает ссылку, токена ещё может не быть. Всё остальное закрыто входом,
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
