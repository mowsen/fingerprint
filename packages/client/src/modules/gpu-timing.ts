/**
 * GPU Timing Fingerprinting Module (DRAWNAPART)
 * Uses WebGL shader execution timing to identify GPU hardware
 * Based on: https://arxiv.org/abs/2201.09956
 */

import { sha256 } from '../core/crypto';
import type { ModuleResult } from '../types';

export interface GpuTimingData {
  timings: number[];
  pattern: string;
  gpuScore: number;
  supported: boolean;
}

export async function collectGpuTiming(): Promise<ModuleResult<GpuTimingData>> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return {
        hash: '',
        data: { timings: [], pattern: '', gpuScore: 0, supported: false },
        error: 'WebGL not available',
      };
    }

    // Create shader program with GPU-intensive operations
    const vertexShaderSource = `
      attribute vec4 position;
      varying float vResult;
      void main() {
        float result = 0.0;
        for (int i = 0; i < 50; i++) {
          result += sin(float(i) * 0.1) * cos(float(i) * 0.1);
        }
        vResult = result;
        gl_Position = position;
        gl_PointSize = 1.0;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      varying float vResult;
      void main() {
        gl_FragColor = vec4(vResult * 0.001, 0.0, 0.0, 1.0);
      }
    `;

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
      return {
        hash: '',
        data: { timings: [], pattern: '', gpuScore: 0, supported: false },
        error: 'Failed to create vertex shader',
      };
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      gl.deleteShader(vertexShader);
      return {
        hash: '',
        data: { timings: [], pattern: '', gpuScore: 0, supported: false },
        error: 'Vertex shader compilation failed',
      };
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      return {
        hash: '',
        data: { timings: [], pattern: '', gpuScore: 0, supported: false },
        error: 'Failed to create fragment shader',
      };
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return {
        hash: '',
        data: { timings: [], pattern: '', gpuScore: 0, supported: false },
        error: 'Fragment shader compilation failed',
      };
    }

    // Create and link program
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return {
        hash: '',
        data: { timings: [], pattern: '', gpuScore: 0, supported: false },
        error: 'Failed to create program',
      };
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return {
        hash: '',
        data: { timings: [], pattern: '', gpuScore: 0, supported: false },
        error: 'Program linking failed',
      };
    }

    gl.useProgram(program);

    // Create vertex buffer with 1000 points
    const vertices = new Float32Array(3000);
    for (let i = 0; i < 1000; i++) {
      vertices[i * 3] = Math.sin(i) * 2 - 1;
      vertices[i * 3 + 1] = Math.cos(i) * 2 - 1;
      vertices[i * 3 + 2] = 0;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    // Warm up the GPU
    for (let i = 0; i < 3; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, 1000);
      gl.finish();
    }

    // Measure timing for multiple renders
    const timings: number[] = [];
    const iterations = 16;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, 1000);
      gl.finish(); // Wait for GPU to complete

      const end = performance.now();
      timings.push(end - start);
    }

    // Clean up
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);

    // Create timing pattern (rounded to reduce noise but preserve GPU characteristics)
    const pattern = timings.map((t) => Math.round(t * 10)).join('-');

    // Calculate GPU score (characteristic value based on timing distribution)
    const gpuScore = timings.reduce((a, b) => a + b, 0) / timings.length;

    const data: GpuTimingData = {
      timings,
      pattern,
      gpuScore,
      supported: true,
    };

    return {
      hash: await sha256(data),
      data,
    };
  } catch (error) {
    return {
      hash: '',
      data: { timings: [], pattern: '', gpuScore: 0, supported: false },
      error: String(error),
    };
  }
}
