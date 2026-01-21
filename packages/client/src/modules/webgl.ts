/**
 * WebGL Fingerprinting Module
 * Collects GPU/graphics card information via WebGL API
 */

import type { ModuleResult, WebGLData } from '../types';
import { sha256 } from '../core/crypto';
import { attempt } from '../core/helpers';

// WebGL parameters to collect
const WEBGL_PARAMS = [
  'ALIASED_LINE_WIDTH_RANGE',
  'ALIASED_POINT_SIZE_RANGE',
  'ALPHA_BITS',
  'BLUE_BITS',
  'DEPTH_BITS',
  'GREEN_BITS',
  'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
  'MAX_CUBE_MAP_TEXTURE_SIZE',
  'MAX_FRAGMENT_UNIFORM_VECTORS',
  'MAX_RENDERBUFFER_SIZE',
  'MAX_TEXTURE_IMAGE_UNITS',
  'MAX_TEXTURE_SIZE',
  'MAX_VARYING_VECTORS',
  'MAX_VERTEX_ATTRIBS',
  'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
  'MAX_VERTEX_UNIFORM_VECTORS',
  'MAX_VIEWPORT_DIMS',
  'RED_BITS',
  'RENDERER',
  'SHADING_LANGUAGE_VERSION',
  'STENCIL_BITS',
  'VENDOR',
  'VERSION',
];

const WEBGL2_PARAMS = [
  'MAX_3D_TEXTURE_SIZE',
  'MAX_ARRAY_TEXTURE_LAYERS',
  'MAX_CLIENT_WAIT_TIMEOUT_WEBGL',
  'MAX_COLOR_ATTACHMENTS',
  'MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS',
  'MAX_COMBINED_UNIFORM_BLOCKS',
  'MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS',
  'MAX_DRAW_BUFFERS',
  'MAX_ELEMENT_INDEX',
  'MAX_ELEMENTS_INDICES',
  'MAX_ELEMENTS_VERTICES',
  'MAX_FRAGMENT_INPUT_COMPONENTS',
  'MAX_FRAGMENT_UNIFORM_BLOCKS',
  'MAX_FRAGMENT_UNIFORM_COMPONENTS',
  'MAX_PROGRAM_TEXEL_OFFSET',
  'MAX_SAMPLES',
  'MAX_SERVER_WAIT_TIMEOUT',
  'MAX_TEXTURE_LOD_BIAS',
  'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS',
  'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS',
  'MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS',
  'MAX_UNIFORM_BLOCK_SIZE',
  'MAX_UNIFORM_BUFFER_BINDINGS',
  'MAX_VARYING_COMPONENTS',
  'MAX_VERTEX_OUTPUT_COMPONENTS',
  'MAX_VERTEX_UNIFORM_BLOCKS',
  'MAX_VERTEX_UNIFORM_COMPONENTS',
  'MIN_PROGRAM_TEXEL_OFFSET',
  'UNIFORM_BUFFER_OFFSET_ALIGNMENT',
];

// Shader precision formats
const SHADER_TYPES = ['VERTEX_SHADER', 'FRAGMENT_SHADER'] as const;
const PRECISION_TYPES = ['LOW_FLOAT', 'MEDIUM_FLOAT', 'HIGH_FLOAT', 'LOW_INT', 'MEDIUM_INT', 'HIGH_INT'] as const;

function getWebGLContext(): WebGLRenderingContext | WebGL2RenderingContext | null {
  const canvas = document.createElement('canvas');
  return (
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl') as WebGLRenderingContext | null
  );
}

function getParameter(gl: WebGLRenderingContext | WebGL2RenderingContext, param: string): unknown {
  try {
    const value = gl.getParameter((gl as unknown as Record<string, number>)[param]);
    if (value instanceof Float32Array || value instanceof Int32Array) {
      return Array.from(value);
    }
    return value;
  } catch {
    return undefined;
  }
}

function getShaderPrecision(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  shaderType: typeof SHADER_TYPES[number],
  precisionType: typeof PRECISION_TYPES[number]
): { precision: number; rangeMin: number; rangeMax: number } | undefined {
  try {
    const format = gl.getShaderPrecisionFormat(
      (gl as unknown as Record<string, number>)[shaderType],
      (gl as unknown as Record<string, number>)[precisionType]
    );
    if (!format) return undefined;
    return {
      precision: format.precision,
      rangeMin: format.rangeMin,
      rangeMax: format.rangeMax,
    };
  } catch {
    return undefined;
  }
}

function getExtensions(gl: WebGLRenderingContext | WebGL2RenderingContext): string[] {
  try {
    return gl.getSupportedExtensions() || [];
  } catch {
    return [];
  }
}

function getUnmaskedInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): {
  unmaskedVendor?: string;
  unmaskedRenderer?: string;
} {
  try {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return {};
    return {
      unmaskedVendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string,
      unmaskedRenderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string,
    };
  } catch {
    return {};
  }
}

function renderWebGLImage(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.width = 256;
    canvas.height = 256;

    // Create shaders
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(
          gl_FragCoord.x / 256.0,
          gl_FragCoord.y / 256.0,
          0.5,
          1.0
        );
      }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Create triangle
    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
      -1.0,  1.0,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    // Render
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function getPixels(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const pixels = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    // Sample pixels for fingerprint
    const sample: number[] = [];
    for (let i = 0; i < pixels.length; i += 1024) {
      sample.push(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    return sample.join(',');
  } catch {
    return '';
  }
}

export async function collectWebGL(): Promise<ModuleResult<WebGLData>> {
  const gl = getWebGLContext();

  if (!gl) {
    return {
      hash: '',
      data: {
        dataURI: '',
        parameters: {},
        extensions: [],
      },
      error: 'WebGL not supported',
    };
  }

  const isWebGL2 = gl instanceof WebGL2RenderingContext;

  // Collect parameters
  const parameters: Record<string, unknown> = {};
  const params = isWebGL2 ? [...WEBGL_PARAMS, ...WEBGL2_PARAMS] : WEBGL_PARAMS;

  for (const param of params) {
    const value = getParameter(gl, param);
    if (value !== undefined) {
      parameters[param] = value;
    }
  }

  // Collect shader precision
  for (const shaderType of SHADER_TYPES) {
    for (const precisionType of PRECISION_TYPES) {
      const precision = getShaderPrecision(gl, shaderType, precisionType);
      if (precision) {
        parameters[`${shaderType}.${precisionType}.precision`] = precision.precision;
        parameters[`${shaderType}.${precisionType}.rangeMin`] = precision.rangeMin;
        parameters[`${shaderType}.${precisionType}.rangeMax`] = precision.rangeMax;
      }
    }
  }

  // Get extensions
  const extensions = getExtensions(gl);

  // Get unmasked vendor/renderer
  const { unmaskedVendor, unmaskedRenderer } = getUnmaskedInfo(gl);

  // Render and capture image
  const dataURI = renderWebGLImage(gl);
  const pixels = getPixels(gl);

  // Second render for comparison
  const gl2 = getWebGLContext();
  let dataURI2 = '';
  let pixels2 = '';
  if (gl2) {
    dataURI2 = renderWebGLImage(gl2);
    pixels2 = getPixels(gl2);
  }

  const data: WebGLData = {
    dataURI,
    dataURI2,
    parameters,
    extensions,
    gpu: unmaskedRenderer,
    renderer: parameters.RENDERER as string,
    vendor: parameters.VENDOR as string,
    unmaskedRenderer,
    unmaskedVendor,
    pixels,
    pixels2,
    parameterOrExtensionLie: false,
  };

  const hash = await sha256(data);

  return {
    hash,
    data,
  };
}
