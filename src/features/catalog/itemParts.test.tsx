import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ItemBadges, ItemFacts, isWholesaleDeal, saleChannel } from './itemParts';
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
    expect(screen.getByTestId('mark-promo')).toHaveTextContent('−20%');
    expect(screen.getByTestId('mark-promo')).toHaveClass('text-sale-ink');
    expect(screen.getByTestId('mark-wholesaleDeal')).toHaveTextContent('Скидка');
    expect(screen.getByTestId('mark-wholesaleDeal').querySelector('svg')).not.toBeNull();
  });
});
