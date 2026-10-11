import { describe, expect, it } from 'vitest';
import { resizable, sizedPhoto } from './sizedPhoto';

describe('копия снимка нужной ширины', () => {
  it('файл хранилища — параметром ширины', () => {
    expect(sizedPhoto('/api/files/3f1e2d4c-0000-4000-8000-000000000001', 480)).toBe('/api/files/3f1e2d4c-0000-4000-8000-000000000001?w=480');
  });
  it('копии Google Диска — своей шириной', () => {
    expect(sizedPhoto('https://lh3.googleusercontent.com/d/g1=w1600', 160)).toBe('https://lh3.googleusercontent.com/d/g1=w160');
    expect(sizedPhoto('https://drive.google.com/thumbnail?id=g1&sz=w1600', 960)).toBe('https://drive.google.com/thumbnail?id=g1&sz=w960');
  });
  it('чужой адрес — как есть, и превью для него нет', () => {
    expect(sizedPhoto('https://cdn.example.kz/osb.jpg', 480)).toBe('https://cdn.example.kz/osb.jpg');
    expect(resizable('https://cdn.example.kz/osb.jpg')).toBe(false);
    expect(resizable('/api/files/3f1e2d4c-0000-4000-8000-000000000001')).toBe(true);
  });
});
