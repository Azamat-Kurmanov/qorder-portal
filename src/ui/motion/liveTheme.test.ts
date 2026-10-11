import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CSS живых тем', () => {
  it.each(['liveTheme.css', 'cabinetPatterns.ts', 'BackgroundLayer.tsx', 'seasonalLook.ts'])(
    '%s — один и тот же файл в портале и в предпросмотре продавца',
    (name) => {
      const portal = readFileSync(resolve(process.cwd(), 'src/ui/motion', name), 'utf8');
      const front = readFileSync(resolve(process.cwd(), '../front/src/features/cabinetDesign', name), 'utf8');
      expect(front).toBe(portal);
    },
  );
});
