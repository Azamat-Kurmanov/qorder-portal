/** Длинная сторона после сжатия: с запасом для экрана и полноразмерного просмотра. */
const MAX_SIDE = 2048;
/** Качество: на глаз неотличимо от исходника, а вес — в разы меньше. */
const QUALITY = 0.85;
/** Меньше этого жать незачем: выигрыш копеечный, а время на телефоне — нет. */
const MIN_BYTES = 200 * 1024;
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Сжимает снимок перед загрузкой: уменьшает до {@link MAX_SIDE} по длинной стороне
 * и перекодирует в WebP (прозрачность PNG-логотипа он сохраняет).
 * <p>
 * Снимок с телефона весит 3–8 МБ, а нужен экрану в разы меньше: так он быстрее
 * уходит по мобильной связи, проходит предел запроса и меньше занимает на Диске.
 * Safari WebP не кодирует — тогда фото (JPEG) перекодируется в JPEG того же
 * качества; PNG так не трогается: прозрачность логотипа стала бы чёрной.
 * Всё, что не получилось, отдаёт исходник: сжатие — выигрыш, а не условие загрузки.
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.has(file.type) || file.size < MIN_BYTES) return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
    let blob = await encode('image/webp');
    // Браузер без WebP молча отдаёт PNG — он тяжелее исходного JPEG.
    if (blob?.type !== 'image/webp') blob = file.type === 'image/jpeg' ? await encode('image/jpeg') : null;
    if (!blob || blob.size >= file.size) return file;
    const extension = blob.type === 'image/webp' ? '.webp' : '.jpg';
    return new File([blob], file.name.replace(/\.[^.]*$/, '') + extension, { type: blob.type });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
