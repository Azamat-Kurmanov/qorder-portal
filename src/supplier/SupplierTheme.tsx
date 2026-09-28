import { useEffect } from 'react';
import { useGetPortalSuppliers } from '../api/generated';
import { useSupplier } from './useSupplier';
import { resolveDesign } from './cabinetDesign';
import { designCss } from './supplierTheme';
import { setSupplierTheme } from '../ui/theme';

/**
 * Оформление открытого поставщика — на весь кабинет.
 *
 * Таблицей стилей, а не атрибутами на обёртке: цвет, фон, шрифты и
 * скругления должны действовать и на выдвижные листы, которые рисуются
 * порталом вне оболочки. Список поставщиков тот же, что у знака в шапке,
 * и кеш у них общий.
 *
 * Здесь же объявляется тема продавца по умолчанию: покупатель, который
 * сам тему не выбирал, видит кабинет таким, каким его задумал магазин.
 */
export function SupplierTheme() {
  const { supplierId } = useSupplier();
  const suppliers = useGetPortalSuppliers();
  const list = suppliers.data?.status === 200 ? suppliers.data.data : [];
  const current = list.find((supplier) => supplier.supplierId === supplierId);
  const design = current ? resolveDesign(current) : null;
  const css = design ? designCss(design) : null;
  const dark = design?.dark;

  // Пока поставщик не известен, тему не трогаем: скрипт в `index.html` уже
  // поставил ту, что была в прошлый раз, и мигать светлой до ответа незачем.
  useEffect(() => {
    if (dark === undefined) return;
    setSupplierTheme(dark ? 'dark' : 'light');
  }, [dark]);

  return css ? <style data-supplier-theme="">{css}</style> : null;
}
