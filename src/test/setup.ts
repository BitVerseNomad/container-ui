import "@testing-library/jest-dom/vitest";
import { afterEach, vi, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Mock HTMLCanvasElement.getContext for xterm WebGL addon
HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
  if (contextId === "2d") {
    return {
      canvas: document.createElement("canvas"),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "low",
      strokeStyle: "#000000",
      fillStyle: "#000000",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      lineDashOffset: 0,
      miterLimit: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
      shadowColor: "rgba(0, 0, 0, 0)",
      font: "10px sans-serif",
      textAlign: "start",
      textBaseline: "alphabetic",
      direction: "inherit",
    } as unknown as CanvasRenderingContext2D;
  }
  if (contextId === "webgl" || contextId === "webgl2") {
    return {
      canvas: document.createElement("canvas"),
      drawingBufferWidth: 0,
      drawingBufferHeight: 0,
      getContextAttributes: vi.fn(() => ({})),
      isContextLost: vi.fn(() => false),
      getSupportedExtensions: vi.fn(() => []),
      getExtension: vi.fn(() => null),
      getParameter: vi.fn(),
      getError: vi.fn(() => 0),
      createShader: vi.fn(() => null),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      createProgram: vi.fn(() => null),
      attachShader: vi.fn(),
      detachShader: vi.fn(),
      linkProgram: vi.fn(),
      validateProgram: vi.fn(),
      deleteProgram: vi.fn(),
      deleteShader: vi.fn(),
      createBuffer: vi.fn(() => null),
      deleteBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      bufferSubData: vi.fn(),
      createVertexArray: vi.fn(() => null),
      deleteVertexArray: vi.fn(),
      bindVertexArray: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      disableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      drawArrays: vi.fn(),
      drawElements: vi.fn(),
      clear: vi.fn(),
      clearColor: vi.fn(),
      clearDepth: vi.fn(),
      clearStencil: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      viewport: vi.fn(),
      scissor: vi.fn(),
      pixelStorei: vi.fn(),
      readPixels: vi.fn(),
      finish: vi.fn(),
      flush: vi.fn(),
    } as unknown as WebGLRenderingContext;
  }
  return null;
}) as typeof HTMLCanvasElement.prototype.getContext;

// Ensure portal-root exists for Portal component
beforeEach(() => {
  if (!document.getElementById("portal-root")) {
    const portalRoot = document.createElement("div");
    portalRoot.id = "portal-root";
    document.body.appendChild(portalRoot);
  }
});

afterEach(() => cleanup());