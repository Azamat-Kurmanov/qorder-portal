import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { TemplatePrice } from './TemplatePrice';
import { renderScreen } from '../../../test/render';

describe('цена в плитке шаблона', () => {
  it('цена по условию клиента — «ваша цена», цена каталога зачёркнута, подсказки опта нет', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 900, oldPrice: 1000, unit: 'мешок', yourPrice: true,
          wholesale: { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: true, tiers: [{ from: 1, price: 1800 }] },
        }}
        look="plain"
      />,
    );

    expect(screen.getByTestId('your-price')).toHaveTextContent('ваша цена');
    expect(screen.getByText(/1\s?000/, { selector: 's' })).toBeInTheDocument();
    expect(screen.queryByText(/Опт/)).not.toBeInTheDocument();
  });

  it('единица после «за» — «за бутылку», «за шт.»', () => {
    renderScreen(
      <>
        <TemplatePrice item={{ price: 900, unit: 'бутылка' }} look="plain" />
        <TemplatePrice item={{ price: 100, unit: 'шт' }} look="plain" />
      </>,
    );

    expect(screen.getByText('за бутылку')).toBeInTheDocument();
    expect(screen.getByText('за шт.')).toBeInTheDocument();
  });

  it('товар «оба режима» — условие опта: цена за штуку на лучшей ступени и вложение', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 100, unit: 'мешок',
          wholesale: { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: true,
            tiers: [{ from: 1, price: 1800 }, { from: 10, price: 1700 }] },
        }}
        look="plain"
      />,
    );

    expect(screen.getByTestId('wholesale-note')).toHaveTextContent(/Опт: 85 ₸ за мешок — упаковками по 20 мешков/);
  });

  it('поштучный опт — порог вместо «упаковками по 1 шт.»', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 31990, unit: 'шт',
          wholesale: { unit: 'шт', packQty: 1, pieceUnit: 'шт.', retail: true, tiers: [{ from: 20, price: 24000 }] },
        }}
        look="plain"
      />,
    );

    expect(screen.getByTestId('wholesale-note')).toHaveTextContent(/Опт: 24\s000 ₸ за шт\. от 20 шт\./);
    expect(screen.getByTestId('wholesale-note')).not.toHaveTextContent(/упаковками/);
  });

  it('товар «только опт» — вложение рядом с ценой упаковки', () => {
    renderScreen(
      <TemplatePrice
        item={{
          price: 1800, unit: 'упаковка',
          wholesale: { unit: 'упаковка', packQty: 20, pieceUnit: 'мешок', retail: false,
            tiers: [{ from: 1, price: 1800 }] },
        }}
        look="plain"
      />,
    );

    expect(screen.getByTestId('wholesale-note')).toHaveTextContent('по 20 мешков');
  });

  it('у штучного товара подписи опта нет', () => {
    renderScreen(<TemplatePrice item={{ price: 100, unit: 'мешок' }} look="plain" />);
    expect(screen.queryByTestId('wholesale-note')).not.toBeInTheDocument();
  });
});
