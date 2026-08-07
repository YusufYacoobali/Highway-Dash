import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

import type { CarDefinition } from '@/domain/cars';
import type { RunResult } from '@/domain/runResult';
import type { RunTuning } from '@/domain/tuning';
import { GameEngine } from '@/engine/GameEngine';
import { createRenderer, type RendererHandle } from '@/engine/renderer/createRenderer';
import type { EngineEvents, EngineMode, Telemetry } from '@/engine/types';

export interface GameSurfaceHandle {
  fireNitro(): boolean;
  /** Ends the run in progress and returns it so the caller can bank it. */
  retireRun(): RunResult | null;
}

export interface GameSurfaceProps {
  mode: EngineMode;
  car: CarDefinition;
  tuning: RunTuning;
  /** Incremented by the UI to force a fresh run. */
  runToken: number;
  /** Freezes the simulation while a meta screen covers the scene. */
  paused?: boolean;
  onTelemetry(snapshot: Telemetry): void;
  onNearMiss(payload: EngineEvents['nearMiss']): void;
  onStarGained(payload: EngineEvents['starGained']): void;
  onCrash(result: RunResult): void;
  handleRef?: React.RefObject<GameSurfaceHandle | null>;
}

/**
 * Hosts the WebGL context and owns the render loop. All gameplay lives in
 * {@link GameEngine}; this component is purely the React ↔ GL boundary, which
 * is why it survives every screen transition without remounting.
 */
export const GameSurface: React.FC<GameSurfaceProps> = ({
  mode,
  car,
  tuning,
  runToken,
  paused = false,
  onTelemetry,
  onNearMiss,
  onStarGained,
  onCrash,
  handleRef,
}) => {
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<RendererHandle | null>(null);
  const frameRef = useRef<number | null>(null);
  const widthRef = useRef(1);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Native GL context creation is asynchronous. Keep the latest gameplay
  // props available so a context that finishes after the user taps Play is
  // created directly in the correct mode instead of falling back to attract.
  const latest = useRef({ mode, car, tuning, runToken });
  latest.current = { mode, car, tuning, runToken };

  // Callbacks are read through a ref so the GL context is never re-created
  // when a parent re-renders with new closures.
  const callbacks = useRef({ onTelemetry, onNearMiss, onStarGained, onCrash });
  callbacks.current = { onTelemetry, onNearMiss, onStarGained, onCrash };

  const handleContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    // A second context would leave the previous loop rendering into a dead
    // surface while its engine kept simulating. Tear the old one down first.
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    engineRef.current?.dispose();
    rendererRef.current?.dispose();

    const renderer = createRenderer(gl);
    rendererRef.current = renderer;

    const current = latest.current;
    const engine = new GameEngine({
      aspect: renderer.width / renderer.height,
      car: current.car,
      tuning: current.tuning,
    });
    engineRef.current = engine;

    // The mode effect may already have fired before the native GL context was
    // ready. Reconcile immediately so Play cannot leave the engine in attract.
    engine.setMode(current.mode);

    engine.events.on('telemetry', (snapshot) => callbacks.current.onTelemetry(snapshot));
    engine.events.on('nearMiss', (payload) => callbacks.current.onNearMiss(payload));
    engine.events.on('starGained', (payload) => callbacks.current.onStarGained(payload));
    engine.events.on('crashed', (result) => callbacks.current.onCrash(result));

    let last = Date.now();
    let reportedFailure = false;

    const loop = () => {
      frameRef.current = requestAnimationFrame(loop);
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;

      // A covered scene keeps its context alive but burns no GPU time.
      if (pausedRef.current) return;

      try {
        engine.update(dt);
        renderer.renderer.render(engine.scene, engine.camera);
        renderer.present();
      } catch (error) {
        if (!reportedFailure) {
          reportedFailure = true;
          console.error('[HighwayDash] render frame failed', error);
        }
      }
    };
    loop();

    // Upgrade from procedural bodies to the bundled glTF vehicle pack after
    // the first frames are already on screen.
    void engine.loadHighDetailModels();
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      engineRef.current?.dispose();
      rendererRef.current?.dispose();
      engineRef.current = null;
      rendererRef.current = null;
    },
    [],
  );

  useEffect(() => {
    engineRef.current?.setTuning(tuning);
  }, [tuning]);

  useEffect(() => {
    engineRef.current?.setPlayerCar(car);
  }, [car]);

  useEffect(() => {
    engineRef.current?.setMode(mode);
    // `runToken` is intentionally a dependency: replaying from the crash screen
    // keeps the same mode but must restart the simulation.
  }, [mode, runToken]);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      fireNitro: () => engineRef.current?.fireNitro() ?? false,
      retireRun: () => engineRef.current?.retire() ?? null,
    };
  }, [handleRef]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          engineRef.current?.steerTo(event.nativeEvent.locationX / widthRef.current);
        },
        onPanResponderMove: (event) => {
          engineRef.current?.steerTo(event.nativeEvent.locationX / widthRef.current);
        },
      }),
    [],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    widthRef.current = Math.max(1, width);
    engineRef.current?.setViewportAspect(width / Math.max(1, height));
  }, []);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={handleLayout}
      {...(mode === 'run' ? panResponder.panHandlers : {})}
    >
      <GLView
        style={StyleSheet.absoluteFill}
        msaaSamples={0}
        onContextCreate={handleContextCreate}
      />
    </View>
  );
};
