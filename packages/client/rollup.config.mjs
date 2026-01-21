import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const production = !process.env.ROLLUP_WATCH;

export default [
  // Main bundle
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/fingerprint.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/fingerprint.umd.js',
        format: 'umd',
        name: 'Fingerprint',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({
        browser: true,
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      production && terser({
        format: {
          comments: false,
        },
      }),
    ].filter(Boolean),
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];
