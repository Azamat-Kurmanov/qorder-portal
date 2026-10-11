import type { MotionLevel } from './motionLevel';

/** Конфетти — черта Капель и Леденца и только при «ярко» (спецификация, «Уровни движения»). */
export function shouldCelebrate(level: MotionLevel, templateId: string | undefined): boolean {
  return level === 'vivid' && (templateId === 'BLOBS' || templateId === 'JELLY');
}

/** Залп конфетти поверх страницы; код рисования грузится только в этот момент. */
export async function confetti(): Promise<void> {
  const { burst } = await import('./confettiBurst');
  burst();
}
