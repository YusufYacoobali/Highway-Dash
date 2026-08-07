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
  const modeRef = useRef(mode);
  pausedRef.current = paused;
  modeRef.current = mode;

  // Callbacks are read through a ref so the GL context is never re-created
  // when a parent re-renders with new closures.
  const callbacks = useRef({ onTelemetry, onNearMiss, onStarGained, onCrash });
  callbacks.current = { onTelemetry, onNearMiss, onStarGained, onCrash };

  const initial = useRef({ car, tuning });

  const handleContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    // A second context would leave the previous loop rendering into a dead
    // surface while its engine kept simulating — visually identical to a
    // freeze. Tear the old one down before adopting the new context.
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    engineRef.current?.dispose();
    rendererRef.current?.dispose();

    console.log('[HighwayDash][GL] context created', {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(gl.RENDERER),
    });

    const renderer = createRenderer(gl);
    rendererRef.current = renderer;

    const engine = new GameEngine({
      aspect: renderer.width / renderer.height,
      car: initial.current.car,
      tuning: initial.current.tuning,
    });
    engineRef.current = engine;

    engine.events.on('telemetry', (snapshot) => callbacks.current.onTelemetry(snapshot));
    engine.events.on('nearMiss', (payload) => callbacks.current.onNearMiss(payload));
    engine.events.on('starGained', (payload) => callbacks.current.onStarGained(payload));
    engine.events.on('crashed', (result) => callbacks.current.onCrash(result));

    let last = Date.now();
    let lastDiagnostic = last;
    let renderedFrames = 0;
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
        renderedFrames += 1;

        // Keep diagnostics sparse enough to leave frame timing alone. If these
        // continue while the picture is frozen, JS + three are still rendering
        // and the failure is specifically in Expo GL presentation/native GL.
        if (now - lastDiagnostic >= 2000) {
          const glError = gl.getError();
          console.log('[HighwayDash][GL] frames alive', {
            mode: modeRef.current,
            frames: renderedFrames,
            glError,
            drawCalls: renderer.renderer.info.render.calls,
            triangles: renderer.renderer.info.render.triangles,
          });
          lastDiagnostic = now;
        }
      } catch (error) {
        // A throw here used to leave the last frame on screen while the
        // simulation kept running — a silent freeze. Surface it once and keep
        // looping, so a transient GL error can still recover.
        if (!reportedFailure) {
          reportedFailure = true;
          console.error('[HighwayDash] render frame failed', error);
        }
      }
    };
    loop();

    // DIAGNOSTIC TEST: keep the guaranteed procedural cars for the whole run.
    // If the freeze disappears, the GLB decode/material hot-swap path is the
    // trigger. Restore this call once the renderer issue is isolated.
    console.log('[HighwayDash][GL] GLB upgrade DISABLED for freeze test');
    // void engine.loadHighDetailModels();
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
    console.log('[HighwayDash][GL] mode change', { mode, runToken, paused });
    engineRef.current?.setMode(mode);
    // `runToken` is intentionally a dependency: replaying from the crash screen
    // keeps the same mode but must restart the simulation.
  }, [mode, runToken, paused]);

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
