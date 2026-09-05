import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext';

/**
 * Состояние входа. Вне провайдера падает, а не отдаёт пустышку: экран,
 * работающий «как будто аноним», молча покажет пустой кабинет вместо ошибки.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth вызван вне AuthProvider');
  return value;
}
