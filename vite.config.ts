import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import eslint from 'vite-plugin-eslint'
import wasm from 'vite-plugin-wasm'
import { resolve } from 'path'

/**
 * Vite configuration for Point Cloud Labelling Tool
 * 
 * This configuration provides:
 * - React integration with fast refresh
 * - TypeScript support with path mapping
 * - WebGL and WebAssembly support for 3D rendering
 * - Development server optimizations for large files
 * - ESLint integration for code quality
 */
export default defineConfig({
  plugins: [
    react({
      // Include .tsx files in fast refresh
      include: "**/*.tsx",
    }),
    // eslint({
    //   cache: false,
    //   include: ['./src/**/*.ts', './src/**/*.tsx'],
    //   exclude: ['node_modules', 'dist'],
    //   overrideConfigFile: './.eslintrc.cjs',
    // }),
    wasm(), // Enable WebAssembly support for point cloud processing
  ],
  
  // Path resolution for cleaner imports
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@core': resolve(__dirname, 'src/core'),
      '@types': resolve(__dirname, 'src/types'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@workers': resolve(__dirname, 'src/workers'),
      '@shaders': resolve(__dirname, 'src/shaders'),
    },
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Allow external connections for testing
    open: true, // Auto-open browser
    cors: true,
    // Configure headers for WebGL and file access
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  // Build optimizations
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    // Increase chunk size warning limit for 3D assets
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          three: ['three'],
          utils: ['uuid', 'zustand', 'immer'],
        },
      },
    },
  },

  // Optimization for dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'three', 
      'zustand',
      'immer',
      'uuid',
    ],
    exclude: [
      // Exclude WebAssembly modules from pre-bundling
      '*.wasm',
    ],
  },

  // Enable WebGL and WebAssembly features
  define: {
    // Enable development features
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    // WebGL context configuration
    __WEBGL_DEBUG__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },

  // Worker support for Web Workers
  worker: {
    format: 'es',
    plugins: () => [
      wasm(), // Enable WebAssembly in workers
    ],
  },

  // CSS configuration
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      // Global CSS variables available in all components
      css: {
        additionalData: `@import "@/styles/variables.css";`,
      },
    },
  },

  // Preview server configuration (for production builds)
  preview: {
    port: 4173,
    host: true,
    cors: true,
  },
}) 