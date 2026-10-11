import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from './compressImage';

/** Подмена декодера и холста: jsdom картинок не рисует. */
function stubCanvas(width: number, height: number, out: { type: string; size: number } | null) {
  const drawImage = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close: vi.fn() })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(
    this: HTMLCanvasElement, callback: BlobCallback,
  ) {
    callback(out ? new Blob([new Uint8Array(out.size)], { type: out.type }) : null);
  });
  return drawImage;
}

function file(size: number, type = 'image/jpeg', name = 'photo.jpg') {
  return new File([new Uint8Array(size)], name, { type });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('compressImage', () => {
  it('большой снимок уменьшается до 2048 по длинной стороне и уходит WebP', async () => {
    const drawImage = stubCanvas(4096, 3072, { type: 'image/webp', size: 300_000 });

    const result = await compressImage(file(3_000_000));

    expect(result.type).toBe('image/webp');
    expect(result.size).toBe(300_000);
    expect(result.name).toBe('photo.webp');
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1536);
  });

  it('сжатое не меньше исходника — уходит исходник', async () => {
    stubCanvas(800, 600, { type: 'image/webp', size: 500_000 });
    const original = file(400_000);

    expect(await compressImage(original)).toBe(original);
  });

  it('Safari не кодирует WebP — фото уходит JPEG того же качества', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4096, height: 3072, close: vi.fn() })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      // Как Safari: WebP не умеет и молча отдаёт PNG; JPEG умеет.
      callback(type === 'image/jpeg'
        ? new Blob([new Uint8Array(400_000)], { type: 'image/jpeg' })
        : new Blob([new Uint8Array(900_000)], { type: 'image/png' }));
    });

    const result = await compressImage(file(3_000_000));

    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('photo.jpg');
    expect(toBlob).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });

  it('PNG без WebP не перекодируется в JPEG: прозрачность логотипа стала бы чёрной', async () => {
    stubCanvas(4096, 3072, { type: 'image/png', size: 100_000 });
    const original = file(3_000_000, 'image/png', 'logo.png');

    expect(await compressImage(original)).toBe(original);
  });

  it('маленький файл и не снимок не трогаются', async () => {
    const small = file(100_000);
    const text = file(3_000_000, 'text/plain', 'a.txt');

    expect(await compressImage(small)).toBe(small);
    expect(await compressImage(text)).toBe(text);
  });

  it('браузер не смог прочитать снимок — уходит исходник, без отказа', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('битый файл'); }));
    const original = file(3_000_000);

    expect(await compressImage(original)).toBe(original);
  });
});
