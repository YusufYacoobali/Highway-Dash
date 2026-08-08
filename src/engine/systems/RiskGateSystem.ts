import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';

import { randomRange } from '@/core/math';
import { GATE, ROAD_WIDTH } from '@/engine/config';
import type { GameSystem, GateKind, RunState, SystemContext } from '@/engine/types';

export interface RiskGateObserver {
  onGateChosen(risky: boolean, kind: GateKind): void;
  onGateApproaching(riskSide: number, kind: GateKind): void;
}

const ARCH_HALF_WIDTH = ROAD_WIDTH / 4;
const COLORS = {
  double: 0xffb02e,
  drift: 0xc45cff,
  safe: 0x46c82b,
} as const;

interface Arch {
  group: Group;
  posts: [Mesh, Mesh];
  banner: Mesh;
  curtain: Mesh;
}

/**
 * The one moment in a run where the player decides something.
 *
 * Two arches span the road — one worth double score for a stretch, one that
 * just pays a few coins — and the choice is made simply by which half of the
 * road you are on when you pass through. No prompt to tap, no pause: the
 * steering the player is already doing *is* the input.
 */
export class RiskGateSystem implements GameSystem {
  readonly name = 'riskGate';

  private readonly root = new Group();
  private readonly left: Arch;
  private readonly right: Arch;
  private readonly riskMaterial = new MeshBasicMaterial({ color: COLORS.double });
  private readonly safeMaterial = new MeshBasicMaterial({ color: COLORS.safe });
  /** Translucent sheet you visibly drive through — sells the commitment. */
  private readonly riskCurtain = new MeshBasicMaterial({
    color: COLORS.double,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  private readonly safeCurtain = new MeshBasicMaterial({
    color: COLORS.safe,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  // Shared across both arches so disposal is one call, not four.
  private readonly postGeometry = new BoxGeometry(
    GATE.postThickness,
    GATE.postHeight,
    GATE.postThickness,
  );
  private readonly bannerGeometry = new BoxGeometry(
    ARCH_HALF_WIDTH * 2,
    GATE.bannerHeight,
    GATE.postThickness * 0.8,
  );
  private readonly curtainGeometry = new PlaneGeometry(ARCH_HALF_WIDTH * 2, GATE.postHeight);

  private timer: number = GATE.firstAt;
  private riskSide = 0;
  private kind: GateKind = 'double';
  private resolved = true;

  constructor(
    scene: Scene,
    private readonly observer: RiskGateObserver,
  ) {
    this.left = this.buildArch(-ARCH_HALF_WIDTH);
    this.right = this.buildArch(ARCH_HALF_WIDTH);
    this.root.add(this.left.group, this.right.group);
    this.root.visible = false;
    scene.add(this.root);
  }

  update({ state, player, scroll, dt }: SystemContext): void {
    if (state.mode !== 'run' || state.crashed) return;

    state.gateBoostRemaining = Math.max(0, state.gateBoostRemaining - dt);
    state.driftModeRemaining = Math.max(0, state.driftModeRemaining - dt);

    if (!this.root.visible) {
      if (!state.started) return;
      this.timer -= dt;
      if (this.timer <= 0) this.launch(state);
      return;
    }

    this.root.position.z += scroll;

    if (!this.resolved && this.root.position.z >= GATE.triggerZ) {
      this.resolve(state, player.position.x);
    }

    // Keep it on stage a moment past the player so the pass reads.
    if (this.root.position.z > 26) this.retire(state);
  }

  reset({ state }: Omit<SystemContext, 'dt' | 'scroll'>): void {
    this.root.visible = false;
    this.resolved = true;
    this.riskSide = 0;
    this.timer = GATE.firstAt;
    state.gateApproaching = false;
    state.gateRiskSide = 0;
    state.gateKind = 'double';
    state.gateBoostRemaining = 0;
    state.driftModeRemaining = 0;
  }

  dispose(): void {
    this.riskMaterial.dispose();
    this.safeMaterial.dispose();
    this.riskCurtain.dispose();
    this.safeCurtain.dispose();
    this.postGeometry.dispose();
    this.bannerGeometry.dispose();
    this.curtainGeometry.dispose();
  }

  private launch(state: RunState): void {
    this.riskSide = Math.random() < 0.5 ? -1 : 1;
    this.kind = Math.random() < GATE.driftChance ? 'drift' : 'double';
    this.resolved = false;
    this.root.position.z = GATE.spawnZ;
    this.root.visible = true;

    const riskColor = this.kind === 'drift' ? COLORS.drift : COLORS.double;
    this.riskMaterial.color.setHex(riskColor);
    this.riskCurtain.color.setHex(riskColor);

    const riskyIsLeft = this.riskSide < 0;
    this.paint(this.left, riskyIsLeft);
    this.paint(this.right, !riskyIsLeft);

    state.gateApproaching = true;
    state.gateRiskSide = this.riskSide;
    state.gateKind = this.kind;
    this.observer.onGateApproaching(this.riskSide, this.kind);
  }

  private resolve(state: RunState, playerX: number): void {
    this.resolved = true;
    state.gateApproaching = false;

    // Dead centre counts as the safe half — the player has to commit.
    const chosenSide = playerX < 0 ? -1 : 1;
    const risky = chosenSide === this.riskSide;

    if (risky) {
      state.gateBoostRemaining = GATE.boostSeconds;
      state.gatesTaken += 1;
      // The drift bargain: more score, but the car goes heavy for the window.
      if (this.kind === 'drift') state.driftModeRemaining = GATE.boostSeconds;
    }
    this.observer.onGateChosen(risky, this.kind);
  }

  private retire(state: RunState): void {
    this.root.visible = false;
    this.timer = randomRange(GATE.intervalMin, GATE.intervalMax);
    state.gateApproaching = false;
    state.gateRiskSide = 0;
  }

  private paint(arch: Arch, risky: boolean): void {
    const material = risky ? this.riskMaterial : this.safeMaterial;
    arch.posts[0].material = material;
    arch.posts[1].material = material;
    arch.banner.material = material;
    arch.curtain.material = risky ? this.riskCurtain : this.safeCurtain;
  }

  private buildArch(centreX: number): Arch {
    const group = new Group();
    const leftPost = new Mesh(this.postGeometry, this.safeMaterial);
    const rightPost = new Mesh(this.postGeometry, this.safeMaterial);
    const banner = new Mesh(this.bannerGeometry, this.safeMaterial);
    const curtain = new Mesh(this.curtainGeometry, this.safeCurtain);

    leftPost.position.set(centreX - ARCH_HALF_WIDTH, GATE.postHeight / 2, 0);
    rightPost.position.set(centreX + ARCH_HALF_WIDTH, GATE.postHeight / 2, 0);
    banner.position.set(centreX, GATE.postHeight - GATE.bannerHeight / 2, 0);
    curtain.position.set(centreX, GATE.postHeight / 2, 0);

    group.add(leftPost, rightPost, banner, curtain);
    return { group, posts: [leftPost, rightPost], banner, curtain };
  }
}
