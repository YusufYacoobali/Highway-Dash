import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { SRGBColorSpace, WebGLRenderer } from 'three';

export interface RendererHandle {
  renderer: WebGLRenderer;
  width: number;
  height: number;
  /** Must be called once per frame *before* `renderer.render`. */
  beginFrame(): void;
  /** Must be called once per frame after `renderer.render`. */
  present(): void;
  dispose(): void;
}

/**
 * three.js expects a DOM canvas. expo-gl hands us a bare WebGL context, so we
 * supply the smallest object that satisfies the renderer's contract. Keeping
 * the shim here means no other engine file knows it is running on React Native.
 */
function createCanvasShim(gl: ExpoWebGLRenderingContext): HTMLCanvasElement {
  const noop = () => undefined;
  return {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener: noop,
    removeEventListener: noop,
    setAttribute: noop,
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
}

export interface RendererOptions {
  /**
   * Real-time shadows re-render every casting object into a depth target, so
   * enabling them roughly doubles the per-frame draw call count. Over the
   * expo-gl command bridge that is the difference between a smooth run and a
   * display that cannot keep up, so the game uses cheap blob shadows instead.
   */
  shadows?: boolean;
  /** MSAA is expensive on mobile fill rate and barely visible at this scale. */
  antialias?: boolean;
}

export function createRenderer(
  gl: ExpoWebGLRenderingContext,
  { shadows = false, antialias = false }: RendererOptions = {},
): RendererHandle {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;

  const renderer = new WebGLRenderer({
    canvas: createCanvasShim(gl),
    context: gl as unknown as WebGLRenderingContext,
    antialias,
    alpha: false,
    powerPreference: 'high-performance',
  });

  // The drawing buffer is already sized in device pixels by expo-gl, so the
  // pixel ratio stays at 1 and `updateStyle` is off (there is no DOM style).
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = shadows;

  return {
    renderer,
    width,
    height,
    /**
     * Re-points the context at expo-gl's default framebuffer.
     *
     * three caches which framebuffer is bound and skips `bindFramebuffer` when
     * it believes nothing changed. `gl.endFrameEXP()` presents by rebinding on
     * expo-gl's side, which three never observes — so from the second frame
     * onwards three draws into a target that is no longer being displayed, and
     * the scene appears frozen while the simulation keeps running.
     *
     * The rebind is issued straight against the context rather than through
     * `renderer.resetState()`. That leaves three's cache accurate — null really
     * is bound again — while touching none of the other cached state. Going via
     * `resetState()` also clears depth-test, VAO and texture bindings, which
     * lets the sky dome paint over the whole scene.
     */
    beginFrame: () => gl.bindFramebuffer(gl.FRAMEBUFFER, null),
    present: () => gl.endFrameEXP(),
    dispose: () => {
      renderer.dispose();
    },
  };
}
