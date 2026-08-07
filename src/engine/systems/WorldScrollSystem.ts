import type { GameSystem, SystemContext } from '@/engine/types';
import { scrollBand, type ScrollBand } from '@/engine/world/ScrollBand';

/** Advances every recycled scenery strip by the distance travelled this frame. */
export class WorldScrollSystem implements GameSystem {
  readonly name = 'worldScroll';

  constructor(private readonly bands: readonly ScrollBand[]) {}

  update({ scroll }: SystemContext): void {
    for (const band of this.bands) scrollBand(band, scroll);
  }
}
