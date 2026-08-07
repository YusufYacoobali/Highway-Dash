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
  retireRun(): RunResult | null;
}

export interface GameSurfaceProps {
  mode: EngineMode;
  car: CarDefinition;
  tuning: RunTuning;
  runToken: number;
  paused?: boolean;
  onTelemetry(snapshot: Telemetry): void;
  onNearMiss(payload: EngineEvents['nearMiss']): void;
  onStarGained(payload: EngineEvents['starGained']): void;
  onCrash(result: RunResult): void;
  handleRef?: React.RefObject<GameSurfaceHandle | null>;
}

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

  const latest = useRef({ mode, car, tuning, runToken });
  latest.current = { mode, car, tuning, runToken };

  const callbacks = useRef({ onTelemetry, onNearMiss, onStarGained, onCrash });
  callbacks.current = { onTelemetry, onNearMiss, onStarGained, onCrash };

  const handleContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
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
    engine.setMode(current.mode);

    engine.events.on('telemetry', (snapshot) => callbacks.current.onTelemetry(snapshot));
    engine.events.on('nearMiss', (payload) => callbacks.current.onNearMiss(payload));
    engine.events.on('starGained', (payload) => callbacks.current.onStarGained(payload));
    engine.events.on('crashed', (result) => callbacks.current.onCrash(result));

    // The menu is now static artwork, so we can safely wait for the active test
    // GLBs here. This avoids showing procedural/old cars during the first run.
    const modelsReady = await engine.prepareHighDetailModels();
    if (engineRef.current !== engine) return;
    if (modelsReady) engine.activateHighDetailModels();

    // Props may have changed while the GLBs decoded (for example Play was
    // tapped). Reconcile once before the first rendered frame.
    const resolved = latest.current;
    engine.setTuning(resolved.tuning);
    engine.setPlayerCar(resolved.car);
    engine.setMode(resolved.mode);

    let last = Date.now();
    let reportedFailure = false;

    const loop = () => {
      frameRef.current = requestAnimationFrame(loop);
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;

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
