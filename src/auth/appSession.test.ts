import { afterEach, describe, expect, it, vi } from 'vitest';
import { User, type UserManager } from 'oidc-client-ts';
import { SESSION_KEY, persistSession, restoreSession } from './appSession';

const user = new User({
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'Bearer',
  profile: { sub: 'u1', iss: 'http://kc', aud: 'q-order-portal', exp: 0, iat: 0 },
});

function bridge(stored: string | null = null) {
  const value = {
    storeSecret: vi.fn(),
    readSecret: vi.fn(async () => stored),
  };
  window.QOrderBridge = value;
  return value;
}

function manager(silent: () => Promise<User | null>) {
  return {
    storeUser: vi.fn(async (_stored: User) => {}),
    signinSilent: vi.fn(silent),
    removeUser: vi.fn(async () => {}),
  };
}

afterEach(() => {
  delete window.QOrderBridge;
});

describe('сессия в приложении', () => {
  it('кладёт сессию в защищённое хранилище приложения', () => {
    const b = bridge();
    persistSession(user);
    expect(b.storeSecret).toHaveBeenCalledWith(SESSION_KEY, user.toStorageString());
    expect(SESSION_KEY).toBe('qo.session');
  });

  it('выход стирает сессию пустой строкой', () => {
    const b = bridge();
    persistSession(null);
    expect(b.storeSecret).toHaveBeenCalledWith('qo.session', '');
  });

  it('после выхода поздний userLoaded от revokeTokens сессию не возвращает', () => {
    const b = bridge();
    persistSession(null);
    persistSession(user);
    expect(b.storeSecret).toHaveBeenCalledTimes(1);
    expect(b.storeSecret).toHaveBeenCalledWith('qo.session', '');
  });

  it('запоминает номер входа, и форма входа приходит с ним', async () => {
    const b = bridge('77786226523');
    const named = new User({
      access_token: 'a',
      token_type: 'Bearer',
      profile: { sub: 'u2', iss: 'http://kc', aud: 'q-order-web', exp: 0, iat: 0, preferred_username: '77786226523' },
    });
    vi.resetModules();
    const fresh = await import('./appSession');
    fresh.persistSession(named);
    expect(b.storeSecret).toHaveBeenCalledWith('qo.lastLogin.client', '77786226523');
    expect(await fresh.lastLogin()).toBe('77786226523');
  });

  it('в браузере сессию не сохраняет и не сериализует', () => {
    expect(() => persistSession({} as User)).not.toThrow();
  });

  it('в браузере восстанавливать нечего', async () => {
    const m = manager(async () => user);
    expect(await restoreSession(m as unknown as UserManager)).toBe(false);
    expect(m.storeUser).not.toHaveBeenCalled();
  });

  it('поднимает сохранённую сессию и обновляет токен без формы входа', async () => {
    bridge(user.toStorageString());
    const m = manager(async () => user);
    expect(await restoreSession(m as unknown as UserManager)).toBe(true);
    expect(m.storeUser).toHaveBeenCalledOnce();
    expect(m.storeUser.mock.calls[0]?.[0].refresh_token).toBe('refresh');
    expect(m.signinSilent).toHaveBeenCalledOnce();
  });

  it('протухшая сессия стирается, и дальше — обычный вход', async () => {
    const b = bridge(user.toStorageString());
    const m = manager(async () => { throw new Error('invalid_grant'); });
    expect(await restoreSession(m as unknown as UserManager)).toBe(false);
    expect(b.storeSecret).toHaveBeenCalledWith('qo.session', '');
    expect(m.removeUser).toHaveBeenCalledOnce();
  });

  it('испорченная запись в хранилище — тоже обычный вход', async () => {
    const b = bridge('{не json');
    const m = manager(async () => user);
    expect(await restoreSession(m as unknown as UserManager)).toBe(false);
    expect(b.storeSecret).toHaveBeenCalledWith('qo.session', '');
  });
});
