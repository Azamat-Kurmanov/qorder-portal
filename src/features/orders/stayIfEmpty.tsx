import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPortalCartQueryKey, type CartDto, type SkippedLineDto } from '../../api/generated';
import { SkippedNotice } from '../cart/CartLines';

/**
 * Итог повтора заявки: корзина не пустая — к оформлению; пустая — остаёмся на месте
 * и называем причину. Пустое оформление с нулевым итогом не объясняет, что пошло не так.
 */
export function useStayIfEmpty() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nothing, setNothing] = useState<SkippedLineDto[] | null>(null);
  const done = (response: { status: number; data: unknown }) => {
    if (response.status !== 200) return;
    queryClient.setQueryData(getGetPortalCartQueryKey(), response);
    const cart = response.data as CartDto;
    if (cart.lines.length === 0) {
      setNothing(cart.skipped ?? []);
      return;
    }
    navigate('/checkout');
  };
  return { done, nothing, start: () => setNothing(null) };
}

/** «Не добавлено» с причинами — или «класть нечего», если причин сервер не назвал. */
export function NothingAdded({ skipped }: { skipped: SkippedLineDto[] | null }) {
  const { t } = useTranslation();
  if (skipped === null) return null;
  if (skipped.length > 0) return <SkippedNotice skipped={skipped} />;
  return <p role="alert" className="m-0 text-sm text-gone">{t('orders.nothingToRepeat')}</p>;
}
