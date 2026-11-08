import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { DealPrice, ItemBadges, ItemFacts, inMode, isWholesaleDeal, saleChannel } from './itemParts';
import type { ShowcaseItemDto } from '../../api/generated';
import { renderScreen } from '../../test/render';

describe('условия продажи плашками', () => {
  it('длинная фраза переносится внутри плашки: высота не зажата', () => {
    renderScreen(
      <ItemFacts item={{ unit: 'бутылка', terms: { hit: false, novelty: false, ageRestricted: true } }} pills />,
    );

    const pill = screen.getByText(/Продаём с 21 года/);
    expect(pill).not.toHaveClass('h-[34px]');
    expect(pill).toHaveClass('min-h-[34px]', 'py-1.5', 'leading-[1.3]');
  });
});

describe('канал продажи на плитке', () => {
  const tiers = [{ from: 1, price: 1800 }];
  const both = { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: true, tiers };
  const packsOnly = { ...both, retail: false };

  it('без опта — розница, опт без штук — опт, иначе — оба', () => {
    expect(saleChannel({})).toBe('retail');
    expect(saleChannel({ wholesale: packsOnly })).toBe('wholesale');
    expect(saleChannel({ wholesale: both })).toBe('both');
  });

  it('метка стоит на каждой плитке, даже без «Хит продаж» и скидки', () => {
    const terms = { hit: false, novelty: false, ageRestricted: false };
    renderScreen(<ItemBadges item={{ terms, wholesale: both }} />);
    expect(screen.getByTestId('sale-channel')).toHaveTextContent('Оптом и в розницу');
  });

  it('в «Похожих товарах» (одна метка словами) канала нет — снимок не закрывается', () => {
    const terms = { hit: true, novelty: false, ageRestricted: false };
    renderScreen(<ItemBadges item={{ terms, wholesale: both }} words />);
    expect(screen.queryByTestId('sale-channel')).not.toBeInTheDocument();
  });
});

describe('метка «Скидка» — опт дешевле розницы', () => {
  const terms = { hit: true, novelty: false, ageRestricted: false };
  const wholesale = (price: number, retail = true) => ({ unit: 'упаковка', packQty: 10, pieceUnit: 'кг', retail, tiers: [{ from: 1, price }] });

  it('тем же правилом, что фильтр: лучшая ступень за единицу дешевле обычной розницы', () => {
    expect(isWholesaleDeal({ price: 100, wholesale: wholesale(900) })).toBe(true);
    expect(isWholesaleDeal({ price: 100, wholesale: wholesale(1100) })).toBe(false);
    // Только опт — сравнивать не с чем.
    expect(isWholesaleDeal({ price: 900, wholesale: wholesale(900, false) })).toBe(false);
    // Розница со скидкой распродажи сравнивается по обычной цене.
    expect(isWholesaleDeal({ price: 80, oldPrice: 100, wholesale: wholesale(900) })).toBe(true);
  });

  it('метки товара — цветом и значком своего фильтра', () => {
    renderScreen(<ItemBadges item={{ terms, discountPercent: 20, price: 100, wholesale: wholesale(900) }} />);
    expect(screen.getByTestId('mark-hit')).toHaveClass('text-hit-ink', 'bg-hit-soft');
    // Процент — отдельной мелкой наклейкой, признак «Акция» — среди меток.
    expect(screen.getByTestId('discount-sticker')).toHaveTextContent('−20%');
    expect(screen.getByTestId('mark-promo')).toHaveTextContent('Акция');
    expect(screen.getByTestId('mark-promo')).toHaveClass('text-sale-ink');
    expect(screen.getByTestId('mark-wholesaleDeal')).toHaveTextContent('Скидка');
    expect(screen.getByTestId('mark-wholesaleDeal').querySelector('svg')).not.toBeNull();
  });

  it('скидка в цене: старая зачёркнута красной линией, новая — зелёным', () => {
    renderScreen(<DealPrice item={{ price: 80, oldPrice: 100, unit: 'шт' }} />);
    const deal = screen.getByTestId('deal-price');
    expect(deal.querySelector('s')).toHaveClass('decoration-sale');
    expect(deal.querySelector('s')).toHaveTextContent('100');
    expect(deal.querySelector('.text-ok-ink')).toHaveTextContent('80');
  });

  it('у «Скидки» на снимке — её размер, посчитанный из цен', () => {
    // Розница 100 за штуку, лучшая ступень опта — 900 за 10 штук: 90 за штуку, на 10% дешевле.
    renderScreen(<ItemBadges item={{ terms, price: 100, wholesale: wholesale(900) }} />);
    expect(screen.getByTestId('deal-percent')).toHaveTextContent('−10%');
  });
});

describe('товар глазами выбранной заявки', () => {
  const terms = { hit: false, novelty: false, ageRestricted: false, minQuantity: 3, quantityStep: 3 };
  const wholesale = { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: true,
    tiers: [{ from: 2, price: 1800, oldPrice: 2000 }, { from: 10, price: 1700 }] };
  const cement = { id: 'c', name: 'Цемент', unit: 'мешок', price: 100, oldPrice: 120, discountPercent: 17,
    terms, wholesale, favorite: false, vatIncluded: false } as ShowcaseItemDto;

  it('«Оптом» — как товар «только опт»: упаковка по первой ступени, её минимум и распродажа опта', () => {
    const shown = inMode(cement, 'WHOLESALE');
    expect(shown).toMatchObject({ unit: 'упаковка', price: 1800, oldPrice: 2000, discountPercent: 10,
      terms: { minQuantity: 2, quantityStep: 1 }, wholesale: { retail: false } });
    expect(saleChannel(shown)).toBe('wholesale');
    expect(isWholesaleDeal(shown)).toBe(false);
  });

  it('«В розницу» — без опта: ни строки опта, ни «Скидки» на опт, канал — розница', () => {
    const shown = inMode(cement, 'RETAIL');
    expect(shown).toMatchObject({ unit: 'мешок', price: 100, oldPrice: 120, terms: { minQuantity: 3 } });
    expect(shown.wholesale).toBeUndefined();
    expect(saleChannel(shown)).toBe('retail');
  });

  it('товар одного способа и своя цена клиента — без изменений', () => {
    const packs = { ...cement, wholesale: { ...wholesale, retail: false } };
    expect(inMode(packs, 'RETAIL')).toBe(packs);
    const yours = { ...cement, yourPrice: true };
    expect(inMode(yours, 'WHOLESALE')).toBe(yours);
  });
});
