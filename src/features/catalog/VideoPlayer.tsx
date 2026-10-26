import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Pause, Play, Volume2, VolumeX } from '../../ui/icons';
import { cn } from '../../ui/cn';

/**
 * Проигрыватель ролика позиции.
 *
 * Кнопки свои, а не браузерные. Родные работают безупречно, но выглядят
 * системными: серая полоса Chrome посреди тёмной сцены кабинета читается
 * чужой деталью, наклеенной поверх. Взамен приходится взять на себя всё,
 * что браузер делал даром, — и потому состояние берётся из СОБЫТИЙ ролика,
 * а не из собственных намерений: нажатие на «пуск» ещё не значит, что ролик
 * пошёл, и кнопка, сменившаяся на «паузу» раньше события `play`, соврала бы
 * там, где браузер отказал в проигрывании.
 *
 * Первый кадр вместо чёрного прямоугольника — не украшение. Отдельной
 * картинки продавец не прикладывает, сервер её и не просит, поэтому кадр
 * берётся у самого ролика: `preload="metadata"` и `#t=0.1` в адресе говорят
 * браузеру загрузить заголовок и встать на десятую долю секунды. Он рисует
 * то, что там оказалось, — и человек нажимает «смотреть», зная зачем.
 *
 * Ролик не начинает играть сам. Карточку открывают с телефона, и видео,
 * пошедшее без спроса, съедает трафик у пришедшего за ценой.
 */
export function VideoPlayer({
  src,
  label,
  onError,
}: {
  src: string;
  /** Чем ролик называется вслух: подпись продавца или имя позиции. */
  label: string;
  /** Браузер не потянул файл — снаружи на его месте встаёт ссылка. */
  onError?: () => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [at, setAt] = useState(0);
  // Панель уезжает, когда за роликом просто смотрят. Она нужна тому, кто
  // тянется её нажать, — а движение мыши или касание и есть это движение.
  const [idle, setIdle] = useState(false);

  /*
   * Что делать по нажатию, решает состояние, а не `video.paused`.
   *
   * Кнопка называется «паузой» именно по состоянию — тому, что пришло
   * событием от ролика. Спроси её обработчик у элемента напрямую, и в тот
   * миг, когда браузер ещё не отметил проигрывание, кнопка с надписью
   * «Пауза» пустила бы ролик заново.
   */
  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.pause();
    else void video.play();
  };

  /*
   * Клавиши слушает окно, а не сам кадр.
   *
   * Кадру пришлось бы держать фокус, а фокус в открытом диалоге стоит на
   * кнопке закрытия — то есть пробел работал бы только после того, как
   * человек догадается нажать на видео. Окно при этом не перехватывает
   * чужого: нажатия, доставшиеся кнопке или ползунку, пропускаются, иначе
   * пробел на кнопке закрытия и стрелки на перемотке делали бы по два дела
   * сразу.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, a, [contenteditable]')) return;

      const video = videoRef.current;
      if (!video) return;

      if (event.key === ' ' || event.key === 'k') {
        event.preventDefault();
        toggle();
      }
      if (event.key === 'm') {
        video.muted = !video.muted;
        setMuted(video.muted);
      }
      // Пять секунд, а не десять: ролик товара идёт полминуты, и шаг
      // в десять секунд перепрыгивал бы треть.
      if (event.key === 'ArrowRight') video.currentTime = Math.min(video.currentTime + 5, duration);
      if (event.key === 'ArrowLeft') video.currentTime = Math.max(video.currentTime - 5, 0);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // `playing` — через `toggle`: слушатель, замкнувший старое состояние,
    // ставил бы на паузу уже идущий ролик.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `toggle` пересоздаётся каждую отрисовку, его состояние — `playing`
  }, [duration, playing]);

  // Панель прячется только у идущего ролика: на паузе прятать нечего —
  // человек её и остановил, чтобы дотянуться до кнопки.
  useEffect(() => {
    if (!playing || idle) return;
    const timer = setTimeout(() => setIdle(true), 2500);
    return () => clearTimeout(timer);
  }, [playing, idle, at]);

  const wake = () => setIdle(false);
  const progress = duration > 0 ? (at / duration) * 100 : 0;

  return (
    <div
      ref={frameRef}
      onMouseMove={wake}
      onTouchStart={wake}
      className={cn(
        'group relative flex w-full max-w-[960px] items-center justify-center',
        'overflow-hidden rounded-[var(--radius-gallery)] bg-black',
      )}
    >
      <video
        data-testid="lightbox-video"
        ref={videoRef}
        // Кадр вместо чёрного прямоугольника: заголовок ролика и остановка
        // на десятой доле секунды — всё, чем можно показать содержимое,
        // не загрузив ролик целиком.
        src={firstFrameSrc(src)}
        // Чем ролик называется вслух: подпись продавца или имя позиции.
        // «Видео» здесь не сообщало бы, чьё оно и о чём.
        aria-label={label}
        preload="metadata"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); setIdle(false); }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onLoadedMetadata={(event) => setDuration(finiteOrZero(event.currentTarget.duration))}
        onTimeUpdate={(event) => setAt(finiteOrZero(event.currentTarget.currentTime))}
        onEnded={() => setPlaying(false)}
        onError={onError}
        className="max-h-full w-full object-contain"
      />

      {/* Нажатие по самому кадру — то же, что по кнопке: так ролик ставят
          на паузу везде, и целиться при этом никуда не нужно. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={toggle}
        className="absolute inset-0 cursor-default"
      />

      {waiting && (
        <span
          data-testid="video-waiting"
          aria-hidden="true"
          className="absolute size-11 animate-spin rounded-full border-2 border-white/25 border-t-white"
        />
      )}

      {!playing && !waiting && (
        <button
          type="button"
          aria-label={t('catalog.watchVideo')}
          onClick={toggle}
          className={cn(
            'absolute inline-flex size-[72px] items-center justify-center rounded-full',
            'bg-white/15 text-white backdrop-blur-md',
            'transition-all duration-300 hover:bg-white/25 active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
          )}
        >
          {/* Треугольник сдвинут вправо на две точки: у равностороннего
              знака в круге зрительный центр левее геометрического. */}
          <Play className="ml-1 size-8 fill-current" aria-hidden="true" />
        </button>
      )}

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2 pb-1 pt-10',
          'bg-gradient-to-t from-ink/90 via-ink/55 to-transparent',
          'transition-opacity duration-300',
          // Уехавшая панель перестаёт и нажиматься: невидимая полоса поверх
          // кадра съедала бы нажатие, которым ролик ставят на паузу.
          idle ? 'pointer-events-none opacity-0' : 'opacity-100',
          // Клавиатуре панель видна всегда: уехать из-под фокуса значит
          // спрятать то, на чём человек сейчас стоит.
          'focus-within:pointer-events-auto focus-within:opacity-100',
        )}
      >
        <BarButton label={playing ? t('catalog.pause') : t('catalog.play')} onClick={toggle}>
          {playing
            ? <Pause className="size-5 fill-current" aria-hidden="true" />
            : <Play className="size-5 fill-current" aria-hidden="true" />}
        </BarButton>

        <span className="shrink-0 px-1 text-xs tabular-nums text-white/80">
          {`${clock(at)} / ${clock(duration)}`}
        </span>

        <Seek
          at={at}
          duration={duration}
          progress={progress}
          onSeek={(seconds) => {
            const video = videoRef.current;
            if (!video) return;
            video.currentTime = seconds;
            setAt(seconds);
          }}
        />

        <BarButton
          label={muted ? t('catalog.soundOn') : t('catalog.soundOff')}
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = !video.muted;
            setMuted(video.muted);
          }}
        >
          {muted
            ? <VolumeX className="size-5" aria-hidden="true" />
            : <Volume2 className="size-5" aria-hidden="true" />}
        </BarButton>

        <BarButton
          label={t('catalog.fullscreen')}
          onClick={() => void frameRef.current?.requestFullscreen?.()}
        >
          <Maximize2 className="size-[18px]" aria-hidden="true" />
        </BarButton>
      </div>
    </div>
  );
}

/**
 * Полоса перемотки.
 *
 * Рисунок — свой, а ползунок под ним настоящий, только прозрачный. Свой
 * `div` с подсчётом координат нажатия выглядел бы так же и потерял бы всё
 * остальное: перетаскивание пальцем, стрелки с клавиатуры, объявление
 * положения экранным диктором. Прозрачность из дерева доступности элемент
 * не убирает — убрала бы только `display`.
 */
function Seek({
  at,
  duration,
  progress,
  onSeek,
}: {
  at: number;
  duration: number;
  progress: number;
  onSeek: (seconds: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'relative flex h-11 min-w-0 flex-1 items-center',
        'rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white',
      )}
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/30">
        <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
      </div>

      {/* Ручка появляется только под курсором: у стоящего ролика полоса
          читается временем, а не органом управления. */}
      <span
        aria-hidden="true"
        style={{ left: `${progress}%` }}
        className={cn(
          'pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-white',
          'opacity-0 transition-opacity duration-300 group-hover:opacity-100',
        )}
      />

      <input
        type="range"
        aria-label={t('catalog.seek')}
        min={0}
        max={duration || 0}
        step={0.1}
        value={at}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

/** Кнопка панели: цель в 44 точки, рисунок вдвое мельче. */
function BarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white',
        'transition-all duration-300 hover:bg-white/15 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Адрес, на котором браузер покажет первый кадр.
 *
 * Своя метка времени в адресе не трогается: она пришла от продавца, который
 * указал, с какой секунды смотреть, и подменять её началом значило бы
 * потерять его указание.
 */
function firstFrameSrc(src: string): string {
  return src.includes('#') ? src : `${src}#t=0.1`;
}

/** Длительность до `loadedmetadata` приходит как NaN, у потока — как ∞. */
function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** «0:07», «1:40», «1:02:03» — часы появляются только тогда, когда они есть. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;

  const tail = `${minutes}:${String(rest).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : tail;
}
