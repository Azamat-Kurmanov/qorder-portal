import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { SupplierContext } from '../supplier/SupplierContext';
import { SupplierProvider } from '../supplier/SupplierProvider';

/**
 * Обвязка экрана в тестах: те же провайдеры, что в приложении.
 *
 * Вход и поставщик подставляются, а не проходятся по-настоящему: проверяется
 * экран, а не Keycloak. Значения при этом настоящие по форме — экран не должен
 * работать с пустышкой там, где в бою получает состояние.
 */
/**
 * То же, но с настоящим провайдером поставщика.
 *
 * Нужен там, где проверяется сам выбор: подставленный контекст ничего
 * не сохраняет, и тест смены поставщика доказывал бы только то, что кнопка
 * нажимается.
 */
export function renderWithRealSupplier(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const auth: AuthContextValue = {
    authenticated: true,
    token: 'test-token',
    // Номер, под которым человек вошёл: в realm клиентов он и есть имя
    // пользователя. Подставляется настоящим по форме — экран не должен
    // работать с пустышкой там, где в бою получает состояние.
    phone: '77010000001',
    sessionRejected: false,
    login: () => {},
    logout: () => {},
  };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <AuthContext.Provider value={auth}>
          <QueryClientProvider client={queryClient}>
            <SupplierProvider>{children}</SupplierProvider>
          </QueryClientProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}

export function renderScreen(
  ui: ReactElement,
  options: {
    supplierId?: string | null;
    auth?: Partial<AuthContextValue>;
    route?: string;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const auth: AuthContextValue = {
    authenticated: true,
    token: 'test-token',
    phone: '77010000001',
    sessionRejected: false,
    login: () => {},
    logout: () => {},
    ...options.auth,
  };

  const supplier = {
    supplierId: options.supplierId === undefined ? 'supplier-1' : options.supplierId,
    select: () => {},
  };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[options.route ?? '/']}>
        <AuthContext.Provider value={auth}>
          <QueryClientProvider client={queryClient}>
            <SupplierContext.Provider value={supplier}>{children}</SupplierContext.Provider>
          </QueryClientProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}
