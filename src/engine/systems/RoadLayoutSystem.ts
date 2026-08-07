import type { Mesh } from 'three';

import { damp } from '@/core/math';
import type { GameSystem, LaneCount, SystemContext } from '@/engine/types';

const FOUR_LANE_DIVIDERS = [-3, 0, 3] as const;
const THREE_LANE_DIVIDERS = [-2.15, 2.15] as const;

/** Moves the painted lane dividers when the director squeezes the road to three lanes. */
export class RoadLayoutSystem implements GameSystem {
  readonly name = 'roadLayout';

  private currentLaneCount: LaneCount = 4;

  constructor(private readonly columns: readonly Mesh[][]) {}

  update({ state, dt }: SystemContext): void {
    this.currentLaneCount = state.laneCount;

    this.columns.forEach((column, index) => {
      const visible = state.laneCount === 4 || index < THREE_LANE_DIVIDERS.length;
      const targetX =
        state.laneCount === 4
          ? FOUR_LANE_DIVIDERS[index] ?? 0
          : THREE_LANE_DIVIDERS[index] ?? 0;

      for (const dash of column) {
        dash.visible = visible;
        if (visible) dash.position.x = damp(dash.position.x, targetX, 6.5, dt);
      }
    });
  }

  reset(): void {
    this.currentLaneCount = 4;
    this.columns.forEach((column, index) => {
      const x = FOUR_LANE_DIVIDERS[index] ?? 0;
      for (const dash of column) {
        dash.visible = true;
        dash.position.x = x;
      }
    });
  }
}
