import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rules } from '../../api/rules.generated';
import {
  addPortalReviewPhoto,
  linkPortalReviewPhoto,
  deletePortalReviewPhoto,
  submitPortalReview,
  type ItemReviewDto,
  type ReviewPhotoDto,
  type SubmitReviewRequestTagsItem,
  useGetReviewPhotoUpload,
} from '../../api/generated';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { cn } from '../../ui/cn';
import { compressImage } from '../../api/compressImage';
import { UploadProgress } from '../../ui/UploadProgress';
import { Star } from './Stars';
import { ImagePlus, Link2, X } from 'lucide-react';
import {
  MAX_REVIEW_PHOTO_MB,
  MAX_REVIEW_PHOTOS,
  REVIEW_PHOTO_TYPES,
  cloudPhotoUrl,
  photoProblem,
} from './ReviewPhotos';

/**
 * Форма отзыва: одна на карточку товара и на раздел «Мои отзывы».
 *
 * Отдельным файлом, а не по месту: форма нужна в двух местах, и написанная
 * дважды через месяц окажется двумя разными формами — ровно то, из-за чего
 * звезда уже вынесена в `Stars.tsx`.
 *
 * Оценка обязательна, текст — нет: человек, которому нечего написать, всё
 * равно готов поставить звёзды, и требовать от него слов значит не получить
 * ни того, ни другого.
 *
 * Записанный отзыв уходит наверх, а не раскладывается по спискам здесь:
 * куда его положить — в карточку, в раздел или никуда, — знает вызывающий,
 * и знать это форме незачем.
 *
 * Фото уходят после отзыва, по одному: сервер принимает снимки к уже
 * записанному отзыву. Не прошедший снимок остаётся в форме вместе с
 * причиной, а форма не закрывается — повторное «Отправить» перепишет тот же
 * отзыв и догрузит оставшееся. Выбранное человеком не теряется ни при
 * каком отказе. Убранные из уже приложенных снимки снимаются тоже при
 * отправке, а не сразу: передумавший и нажавший «Отмена» их не теряет.
 */
export function ReviewForm({
  itemId,
  initialRating = 0,
  initialText = '',
  initialTags = [],
  initialPhotos = [],
  sizeTags = false,
  plain = false,
  submitLabel,
  note,
  onSaved,
  onCancel,
}: {
  itemId: string;
  initialRating?: number;
  initialText?: string;
  initialTags?: SubmitReviewRequestTagsItem[];
  /** Уже приложенные к отзыву фото — при правке. */
  initialPhotos?: ReviewPhotoDto[];
  /** Предлагать метки о размере: только у товара, у которого размер есть. */
  sizeTags?: boolean;
  /** Без собственной рамки: форма стоит внутри панели карточки товара. */
  plain?: boolean;
  submitLabel?: string;
  note?: string;
  onSaved: (review: ItemReviewDto) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText);
  const [tags, setTags] = useState<SubmitReviewRequestTagsItem[]>(initialTags);
  const offered = sizeTags ? ALL_TAGS : ALL_TAGS.filter((tag) => !SIZE_TAGS.includes(tag));
  const chosenTags = tags.filter((tag) => offered.includes(tag));
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Фото: что лежит на сервере, что из этого человек оставил и что выбрал
  // новым. Разница первых двух снимается при отправке.
  const [stored, setStored] = useState<ReviewPhotoDto[]>(initialPhotos);
  const [kept, setKept] = useState<ReviewPhotoDto[]>(initialPhotos);
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [photosFailed, setPhotosFailed] = useState(false);
  // Доля отправленного снимка, пока он в пути: снимки уходят по одному.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  // Ссылка на снимок в облаке клиента — как в кабинете продавца: «Вставить ссылку».
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState('');
  const keptLinks = kept.map((photo) => photo.url);
  const fileInput = useRef<HTMLInputElement>(null);
  // Фото уходят в хранилище поставщика. Блок прячется, только когда сервер прямо
  // сказал «некуда»: без ответа он остаётся, и отказ придёт словами сервера.
  const photoUpload = useGetReviewPhotoUpload({ query: { retry: false, staleTime: 60_000 } });
  const photosAllowed = !(photoUpload.data?.status === 200 && photoUpload.data.data.canUploadPhotos === false);
  const room = MAX_REVIEW_PHOTOS - kept.length - picked.length;

  // Превью — ссылки на выбранные файлы; ушедшая форма их отпускает.
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useEffect(() => () => pickedRef.current.forEach(release), []);

  function pick(files: FileList | null) {
    if (!files) return;
    const errors: string[] = [];
    const accepted: PickedPhoto[] = [];
    let left = room;
    Array.from(files).forEach((file) => {
      const problem = photoProblem(file);
      if (problem) {
        errors.push(t(`reviews.photos.${problem}`, { name: file.name, mb: MAX_REVIEW_PHOTO_MB }));
        return;
      }
      if (left <= 0) return;
      left -= 1;
      accepted.push({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined,
      });
    });
    const valid = Array.from(files).filter((file) => !photoProblem(file)).length;
    if (valid > accepted.length) errors.push(t('reviews.photos.tooMany', { count: MAX_REVIEW_PHOTOS }));
    setPicked([...picked, ...accepted]);
    setPhotoErrors(errors);
  }

  function addLink() {
    const preview = cloudPhotoUrl(link);
    if (!preview) {
      setPhotoErrors([t('reviews.photos.notCloud')]);
      return;
    }
    if (room <= 0) {
      setPhotoErrors([t('reviews.photos.tooMany', { count: MAX_REVIEW_PHOTOS })]);
      return;
    }
    setPicked([...picked, { key: `link-${Math.random().toString(36).slice(2)}`, link: link.trim(), preview }]);
    setPhotoErrors([]);
    setLink('');
    setLinking(false);
  }

  function unpick(one: PickedPhoto) {
    release(one);
    setPicked(picked.filter((other) => other.key !== one.key));
    setPhotoErrors([]);
  }

  async function send() {
    setBusy(true);
    setFailed(false);
    setPhotosFailed(false);
    try {
      const response = await submitPortalReview(itemId, {
        rating,
        text: text.trim() || undefined,
        // Без меток поле не шлётся: сервер и так снимает прежние, а лишнее
        // «tags: []» в каждом запросе ничего не сообщает.
        tags: chosenTags.length ? chosenTags : undefined,
      });
      if (response.status !== 201) {
        setFailed(true);
        return;
      }
      let review = response.data;
      let photosBroke = false;

      for (const gone of stored.filter((photo) => !kept.some((one) => one.id === photo.id))) {
        try {
          await deletePortalReviewPhoto(review.id, gone.id);
          review = { ...review, photos: (review.photos ?? []).filter((photo) => photo.id !== gone.id) };
        } catch {
          photosBroke = true;
        }
      }

      const left: PickedPhoto[] = [];
      for (const one of picked) {
        try {
          setUploadProgress(0);
          const added = one.file
            ? await addPortalReviewPhoto(review.id, { file: await compressImage(one.file) },
              { onUploadProgress: setUploadProgress })
            : await linkPortalReviewPhoto(review.id, { url: one.link! });
          if (added.status === 201) {
            review = added.data;
            release(one);
            continue;
          }
        } catch {
          // Причину скажет подпись под формой; снимок остаётся выбранным.
        }
        left.push(one);
        photosBroke = true;
      }

      setUploadProgress(null);
      if (photosBroke) {
        // Отзыв записан, снимки — не все. Форма остаётся открытой с тем,
        // что не прошло: закрыть её значило бы потерять выбранное.
        setStored(review.photos ?? []);
        setKept(review.photos ?? []);
        setPicked(left);
        setPhotosFailed(true);
        return;
      }

      onSaved(review);
      setRating(initialRating);
      setText(initialText);
      setTags(initialTags);
      setStored(review.photos ?? []);
      setKept(review.photos ?? []);
      setPicked([]);
      setPhotoErrors([]);
    } catch {
      setFailed(true);
    } finally {
      setUploadProgress(null);
      setBusy(false);
    }
  }

  return (
    <Card className={cn('flex flex-col gap-3', plain ? 'border-0 bg-transparent p-0 shadow-none' : 'p-4')}>
      <StarsInput value={rating} onChange={setRating} large={plain} />

      {/*
        Метки — после оценки, одним касанием: главное о покупке без набора
        текста. Раньше оценки их нет — сначала решают, понравилось ли.
      */}
      {rating > 0 && (
        <div role="group" aria-label={t('reviews.tagsLabel')} className="flex flex-wrap gap-2">
          {offered.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => setTags(on ? tags.filter((one) => one !== tag) : [...tags, tag])}
                className={cn(
                  'h-10 rounded-[var(--radius-pill)] border-[1.5px] px-3.5 text-sm font-semibold transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  // В карточке товара — как в макете: невыбранная метка пунктиром.
                  on ? 'border-accent bg-accent-soft text-accent-ink'
                    : cn('border-line bg-surface text-ink-muted hover:border-ink', plain && 'border-dashed bg-transparent'),
                )}
              >
                {t(`reviews.tags.${tag}`)}
              </button>
            );
          })}
        </div>
      )}

      <label className={cn('flex flex-col gap-1.5 text-sm text-ink-muted', plain && 'font-semibold')}>
        {t('reviews.reviewOptional')}
        <textarea
          value={text}
          maxLength={rules.SubmitReviewRequest.text.maxLength}
          rows={3}
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder={t(sizeTags ? 'reviews.textPlaceholderSized' : 'reviews.textPlaceholder')}
          className={cn(
            'w-full resize-y rounded-[var(--radius-control)] border border-hairline bg-surface',
            plain && 'min-h-[110px] rounded-[var(--radius-control)] px-4 py-3.5',
            'p-3 text-body text-ink placeholder:text-ink-faint',
            'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
          )}
        />
      </label>

      {/*
        Фото — после слов, как в макете: «Добавить фото» под полем текста.
        Пределы названы заранее, а не только отказом: человек, выбравший
        пять снимков, должен знать, почему легли три.
      */}
      <div className="flex flex-col gap-2">
        {(kept.length > 0 || picked.length > 0) && (
          <ul data-testid="review-form-photos" aria-label={t('reviews.photos.label')} className="flex flex-wrap gap-2">
            {kept.map((photo, index) => (
              <PhotoTile
                key={photo.id}
                src={keptLinks[index]}
                removeLabel={t('reviews.photos.remove', { index: index + 1 })}
                onRemove={() => setKept(kept.filter((one) => one.id !== photo.id))}
              />
            ))}
            {picked.map((one, index) => (
              <PhotoTile
                key={one.key}
                src={one.preview}
                removeLabel={t('reviews.photos.remove', { index: kept.length + index + 1 })}
                onRemove={() => unpick(one)}
              />
            ))}
          </ul>
        )}
        {photosAllowed && (
        <input
          ref={fileInput}
          type="file"
          accept={REVIEW_PHOTO_TYPES.join(',')}
          multiple
          data-testid="review-photo-input"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            pick(event.currentTarget.files);
            // Тот же файл, выбранный снова после удаления, иначе не придёт.
            event.currentTarget.value = '';
          }}
        />
        )}
        {linking ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="review-photo-link" className="text-body font-semibold text-ink">{t('reviews.photos.linkLabel')}</label>
            <div className="flex flex-wrap gap-2">
              <input id="review-photo-link" value={link} inputMode="url" autoFocus
                placeholder="https://drive.google.com/file/d/…"
                onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }}
                className="h-11 min-w-0 grow rounded-[var(--radius-tile)] border border-line bg-surface px-3 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
              <Button type="button" disabled={!link.trim()} onClick={addLink}>{t('reviews.photos.linkAdd')}</Button>
              <Button type="button" variant="ghost" onClick={() => { setLinking(false); setLink(''); setPhotoErrors([]); }}>
                {t('reviews.cancel')}
              </Button>
            </div>
            <span className="text-caption text-ink-subtle">{t('reviews.photos.linkHint')}</span>
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {photosAllowed && (
          <button
            type="button"
            disabled={room <= 0 || busy}
            onClick={() => fileInput.current?.click()}
            className={PHOTO_BUTTON}
          >
            <ImagePlus aria-hidden="true" className="size-[18px]" />
            {t('reviews.photos.add')}
          </button>
          )}
          <button type="button" disabled={room <= 0 || busy} onClick={() => setLinking(true)} className={PHOTO_BUTTON}>
            <Link2 aria-hidden="true" className="size-[18px]" />
            {t('reviews.photos.link')}
          </button>
          <span className="text-caption text-ink-subtle">
            {t('reviews.photos.hint', { count: MAX_REVIEW_PHOTOS, mb: MAX_REVIEW_PHOTO_MB })}
          </span>
        </div>
        )}
        <UploadProgress fraction={uploadProgress} label={t('reviews.photos.uploading')} />
        {photoErrors.length > 0 && (
          <ul role="alert" className="flex flex-col gap-0.5 text-sm text-gone">
            {photoErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )}
      </div>

      {photosFailed && (
        <p role="alert" className="text-sm text-gone">
          {t('reviews.photos.uploadFailed')}
        </p>
      )}

      {failed && (
        <p role="alert" className="text-sm text-gone">
          {t('reviews.sendFailed')}
        </p>
      )}

      <div className={cn('flex flex-wrap items-center justify-between gap-3', plain && 'flex-col-reverse items-stretch')}>
        <p className="text-caption text-ink-subtle">{note ?? t('reviews.afterCheck')}</p>
        <div className={cn('flex items-center gap-2', plain && '[&>button:last-child]:h-[52px] [&>button:last-child]:flex-1 [&>button:last-child]:rounded-[var(--radius-tile)] [&>button:last-child]:text-base')}>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('reviews.cancel')}
            </Button>
          )}
          <Button
            type="button"
            disabled={rating === 0}
            busy={busy}
            onClick={() => void send()}
          >
            {submitLabel ?? t('reviews.leave')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Выбранный, но ещё не загруженный снимок — файлом или ссылкой на облако — и его превью. */
interface PickedPhoto {
  key: string;
  file?: File;
  link?: string;
  preview?: string;
}

const PHOTO_BUTTON = cn(
  'inline-flex h-11 items-center gap-2 rounded-[var(--radius-tile)] border border-line bg-surface px-4 text-body font-semibold text-ink',
  'hover:bg-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

function release(one: PickedPhoto) {
  if (one.file && one.preview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(one.preview);
}

/** Миниатюра снимка в форме с кнопкой «убрать». */
function PhotoTile({ src, removeLabel, onRemove }: { src?: string; removeLabel: string; onRemove: () => void }) {
  return (
    <li className="relative size-[76px] overflow-hidden rounded-[var(--radius-tile)] bg-sunk shadow-[0_0_0_1px_var(--color-hairline)]">
      {src && <img src={src} alt="" className="size-full object-cover" />}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className={cn(
          'absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white',
          'hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        )}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

/** Метки отзыва в порядке показа; о размере — только у товара с размером. */
const ALL_TAGS: SubmitReviewRequestTagsItem[] = [
  'MATCHES_DESCRIPTION', 'GOOD_QUALITY', 'TRUE_TO_SIZE', 'RUNS_SMALL', 'RUNS_LARGE',
];
const SIZE_TAGS: SubmitReviewRequestTagsItem[] = ['TRUE_TO_SIZE', 'RUNS_SMALL', 'RUNS_LARGE'];

/**
 * Выбор оценки.
 *
 * Радиогруппой, а не пятью кнопками: оценка одна из пяти, и клавиатура
 * с озвучиванием обязаны понимать это без подсказок.
 */
function StarsInput({
  value,
  onChange,
  large = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  /** Крупные звёзды и слово под ними — форма в карточке товара. */
  large?: boolean;
}) {
  const { t } = useTranslation();
  // Наведение подсвечивает звёзды до курсора и называет оценку словом:
  // «4» без слова читается по-разному, «Хорошо» — одинаково.
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className={cn('flex flex-wrap items-center gap-3', large && 'flex-col items-start gap-1')}>
      <div role="radiogroup" aria-label={t('reviews.rating')} className={cn('flex items-center gap-1', large && '-ml-2 gap-0')}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${t('reviews.stars', { value: rating })} — ${t(`reviews.word.${rating}`)}`}
            onClick={() => onChange(rating)}
            onMouseEnter={() => setHover(rating)}
            onMouseLeave={() => setHover(0)}
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-full',
              large && 'size-[54px] rounded-[var(--radius-control)] hover:scale-110',
              'transition-all duration-300 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              rating <= shown ? 'text-[#D97706]' : 'text-ink-faint hover:text-ink-muted',
            )}
          >
            <Star filled={rating <= shown} className={large ? 'size-10' : undefined} />
          </button>
        ))}
      </div>
      <span aria-hidden="true" className={cn('text-sm font-semibold', large && 'min-h-5 text-body font-bold', shown ? 'text-[#B45309] dark:text-[#E0A04A]' : 'text-ink-subtle')}>
        {shown ? t(`reviews.word.${shown}`) : t('reviews.pickStar')}
      </span>
    </div>
  );
}
