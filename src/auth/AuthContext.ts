import { createContext } from 'react';

/** Что кабинет знает о вошедшем клиенте. */
export interface AuthContextValue {
  /** Есть ли действующая сессия. */
  authenticated: boolean;
  /** Токен доступа; пуст, пока клиент не вошёл. */
  token: string | null;
  /**
   * Номер, под которым человек вошёл: в realm клиентов он и есть имя
   * пользователя. Кабинет показывает его, но никуда не отправляет — сервер
   * читает тот же номер из токена сам.
   */
  phone: string | null;
  /** Сервер отказал в доступе с токеном только что завершённого входа. */
  sessionRejected: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
