import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import {
  getGetMyCompanyQueryKey,
  useGetMyCompany,
  useSaveMyCompany,
  type CompanyRequisites,
} from '../../api/generated';
import { useSupplier } from '../../supplier/useSupplier';

const INPUT = 'h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-base text-ink';

type Key = keyof CompanyRequisites;
const FIELDS: { key: Key; required?: boolean; inputMode?: 'numeric' }[] = [
  { key: 'bin', required: true, inputMode: 'numeric' },
  { key: 'name', required: true },
  { key: 'address', required: true },
  { key: 'iik' },
  { key: 'bankName' },
  { key: 'bic' },
  { key: 'kbe', inputMode: 'numeric' },
];

const EMPTY: CompanyRequisites = { bin: '', name: '', address: '', iik: '', bankName: '', bic: '', kbe: '' };

/**
 * Реквизиты компании: по ним поставщик выписывает счёт-фактуру. Заполняет сам клиент —
 * он знает их точно, а поставщик переписывал бы с фотографии карточки. Частному лицу
 * блок не нужен, поэтому он свёрнут, пока реквизитов нет.
 */
export function CompanyBlock() {
  const { t } = useTranslation();
  const { supplierId } = useSupplier();
  const queryClient = useQueryClient();
  const id = useId();
  const company = useGetMyCompany({ query: { enabled: supplierId !== null } });
  const saved = company.data?.status === 200 ? company.data.data : null;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CompanyRequisites>(EMPTY);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useSaveMyCompany();
  // Галочка на кнопке после сохранения — на миг, потом снова подпись.
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (saved) setForm({ ...EMPTY, ...saved });
  }, [saved]);

  if (supplierId === null) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (v ?? '').trim()])) as CompanyRequisites;
    clean.iik = clean.iik?.toUpperCase();
    clean.bic = clean.bic?.toUpperCase();
    try {
      await save.mutateAsync({ data: clean });
      await queryClient.invalidateQueries({ queryKey: getGetMyCompanyQueryKey() });
      setResult({ ok: true, text: t('profile.company.saved') });
      setDone(true);
    } catch (error) {
      const info = (error as { info?: { code?: unknown; detail?: unknown } } | null)?.info;
      setResult({
        ok: false,
        text: info?.code === 'COMPANY_BIN_INVALID' ? t('profile.company.binInvalid')
          : typeof info?.detail === 'string' ? info.detail : t('profile.company.failed'),
      });
    }
  }

  const expanded = open || saved !== null;

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="company-block">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-base font-bold text-ink">{t('profile.company.title')}</h2>
        <p className="m-0 text-sm text-ink-subtle">{t('profile.company.lead')}</p>
      </div>
      {expanded ? (
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          {FIELDS.map((field) => (
            <label key={field.key} htmlFor={`${id}-${field.key}`} className="flex flex-col gap-1 text-sm font-semibold text-ink">
              {t(`profile.company.fields.${field.key}`)}{field.required ? ' *' : ''}
              <input
                id={`${id}-${field.key}`}
                className={INPUT}
                required={field.required}
                inputMode={field.inputMode}
                placeholder={t(`profile.company.examples.${field.key}`)}
                value={form[field.key] ?? ''}
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
              />
            </label>
          ))}
          <div>
            <Button type="submit" busy={save.isPending} done={done}>
              {save.isPending ? t('profile.company.saving') : t('profile.company.save')}
            </Button>
          </div>
          {result ? (
            <p role={result.ok ? 'status' : 'alert'} className={result.ok ? 'm-0 text-sm text-ink-subtle' : 'm-0 text-sm text-gone'}>
              {result.text}
            </p>
          ) : null}
        </form>
      ) : (
        <div>
          <Button variant="soft" onClick={() => setOpen(true)}>{t('profile.company.fill')}</Button>
        </div>
      )}
    </Card>
  );
}
