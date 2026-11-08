import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Logo } from '../../ui/Logo';
import { getConfig } from '../../config';
import { useGetOwnerInvite } from '../../api/generated';
import { LanguageAsk } from '../language/LanguageAsk';
import { LanguagePicker } from '../shell/LanguagePicker';
import { OpenInApp } from '../openInApp/OpenInApp';

/**
 * Куда ведёт «Подключить»: та же форма самоподключения рабочего места, с приглашением в адресе.
 * Адрес рабочего места не задан — `null`: относительная ссылка увела бы на несуществующую страницу кабинета.
 */
export function signupHref(param: 'owner' | 'ref', value: string): string | null {
  const web = (getConfig().WEB_URL || '').replace(/\/+$/, '');
  return web ? `${web}/signup?${param}=${encodeURIComponent(value)}` : null;
}

/**
 * Владелец по ссылке от продавца: сколько клиентов его ждут и кто передал. Дальше —
 * та же форма самоподключения; приглашения под этой ссылкой подключатся вместе с компанией.
 */
export function JoinOwnerPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const invite = useGetOwnerInvite(token, { query: { retry: false } });
  const data = invite.data?.status === 200 ? invite.data.data : undefined;

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <LanguageAsk />
      <Card className="flex w-full max-w-[460px] flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <Logo variant="mark" height={22} decorative />
          <div className="text-sm font-semibold leading-tight text-ink">Q-Order</div>
          <div className="ml-auto"><LanguagePicker /></div>
        </div>
        <OpenInApp />

        {invite.isError ? (
          <>
            <h1 className="text-display font-extrabold leading-tight text-ink">{t('joinOwner.goneTitle')}</h1>
            <p className="text-base text-ink-muted">{t('joinOwner.gone')}</p>
            <Button size="lg" asChild><Link to="/join">{t('joinOwner.lead')}</Link></Button>
          </>
        ) : data ? (
          <>
            <h1 className="text-display font-extrabold leading-tight text-ink">
              {t('joinOwner.title', { count: data.waiting })}
            </h1>
            {data.sellerName && <p className="text-base text-ink">{t('joinOwner.by', { name: data.sellerName })}</p>}
            {data.clients.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
                {data.clients.map((name, index) => <li key={index}>{name}</li>)}
              </ul>
            )}
            <p className="text-base text-ink-muted">{t('joinOwner.text')}</p>
            {signupHref('owner', token)
              ? <Button size="lg" asChild><a href={signupHref('owner', token) ?? undefined}>{t('joinOwner.connect')}</a></Button>
              : <Button size="lg" asChild><Link to="/join">{t('joinOwner.lead')}</Link></Button>}
          </>
        ) : (
          <p className="text-base text-ink-muted">{t('joinOwner.loading')}</p>
        )}
      </Card>
    </div>
  );
}
