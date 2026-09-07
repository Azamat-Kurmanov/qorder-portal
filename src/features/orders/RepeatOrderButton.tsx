import { Button } from '../../ui/Button';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPortalCartQueryKey, useRepeatLastPortalOrder } from '../../api/generated';

/**
 * «Повторить прошлый заказ» — одно касание вместо десяти.
 *
 * Ради этого кабинет и строился: закупки повторяются, и набирать тот же
 * список каждую неделю руками человек не станет — он вернётся в переписку,
 * где достаточно написать «как в прошлый раз».
 *
 * Корзина не отправляется сразу: цены с прошлого раза могли измениться,
 * а позиции — исчезнуть. Клиент попадает в корзину и видит, что получилось.
 *
 * Вид задаётся снаружи, а слова — нет: в списке заявок кнопка стоит
 * спокойной обводкой рядом с составом, в шаблонах — заметной, потому что
 * там она главное действие экрана. Название при этом одно на оба места:
 * повторяется прошлый заказ клиента, а не та карточка, у которой нажали.
 */
export function RepeatOrderButton({ variant = 'soft', className }: {
  variant?: 'soft' | 'outline';
  className?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const repeat = useRepeatLastPortalOrder({
    mutation: {
      onSuccess: (response) => {
        if (response.status !== 200) return;
        // Ответ — уже собранная корзина: кладём её целиком, вместе со статусом,
        // как это делает изменение количества.
        queryClient.setQueryData(getGetPortalCartQueryKey(), response);
        navigate('/checkout');
      },
    },
  });

  return (
    <Button
      variant={variant}
      className={className}
      disabled={repeat.isPending}
      onClick={() => repeat.mutate()}
    >
      {repeat.isPending ? t('orders.collecting') : t('orders.repeat')}
    </Button>
  );
}
