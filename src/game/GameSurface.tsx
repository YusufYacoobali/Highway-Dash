import React, { useCallback, useEffect, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

import type { CarDefinition } from '@/domain/cars';
import type { RunResult } from '@/domain/runResult';
import type { RunTuning } from '@/domain/tuning';
import { GameEngine } from '@/engine/GameEngine';
import { createRenderer, type RendererHandle } from '@/engine/renderer/createRenderer';
import type { EngineEvents, EngineMode, Telemetry } from '@/engine/types';

export interface GameSurfaceHandle {
  fireNitro(): boolean;
  steerTo(fraction: number): void;
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
  onShookOff(payload: EngineEvents['shookOff']): void;
  onCoinCollected(payload: EngineEvents['coinCollected']): void;
  onTrafficRammed(payload: EngineEvents['trafficRammed']): void;
  onSideswiped(payload: EngineEvents['sideswiped']): void;
  onDrafted(payload: EngineEvents['drafted']): void;
  onGateChosen(payload: EngineEvents['gateChosen']): void;
  onEventStarted(payload: EngineEvents['eventStarted']): void;
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
  onShookOff,
  onCoinCollected,
  onTrafficRammed,
  onSideswiped,
  onDrafted,
  onGateChosen,
  onEventStarted,
  onCrash,
  handleRef,
}) => {
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<RendererHandle | null>(null);
  const frameRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const latest = useRef({ mode, car, tuning, runToken });
  latest.current = { mode, car, tuning, runToken };

  // Built once per render and mirrored into the ref, so the engine's long-lived
  // event subscriptions always reach the current props. Spelling the object out
  // twice is how new events kept getting dropped from the initialiser.
  const handlers = {
    onTelemetry,
    onNearMiss,
    onStarGained,
    onShookOff,
    onCoinCollected,
    onTrafficRammed,
    onSideswiped,
    onDrafted,
    onGateChosen,
    onEventStarted,
    onCrash,
  };
  const callbacks = useRef(handlers);
  callbacks.current = handlers;

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
    engine.events.on('shookOff', (payload) => callbacks.current.onShookOff(payload));
    engine.events.on('coinCollected', (payload) => callbacks.current.onCoinCollected(payload));
    engine.events.on('trafficRammed', (payload) => callbacks.current.onTrafficRammed(payload));
    engine.events.on('sideswiped', (payload) => callbacks.current.onSideswiped(payload));
    engine.events.on('drafted', (payload) => callbacks.current.onDrafted(payload));
    engine.events.on('gateChosen', (payload) => callbacks.current.onGateChosen(payload));
    engine.events.on('eventStarted', (payload) => callbacks.current.onEventStarted(payload));
    engine.events.on('crashed', (result) => callbacks.current.onCrash(result));

    const modelsReady = await engine.prepareHighDetailModels();
    if (engineRef.current !== engine) return;
    if (modelsReady) engine.activateHighDetailModels();

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
      steerTo: (fraction) => engineRef.current?.steerTo(fraction),
      retireRun: () => engineRef.current?.retire() ?? null,
    };
  }, [handleRef]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    engineRef.current?.setViewportAspect(width / Math.max(1, height));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout} pointerEvents="none">
      <GLView
        style={StyleSheet.absoluteFill}
        msaaSamples={0}
        onContextCreate={handleContextCreate}
      />
    </View>
  );
};
