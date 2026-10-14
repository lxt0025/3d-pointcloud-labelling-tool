/**
 * Application Constants and Configuration
 * 
 * This file contains all the global constants, default values, and configuration
 * settings used throughout the Point Cloud Labelling Tool. These values ensure
 * consistency across the application and provide sensible defaults for users.
 * 
 * Categories:
 * - Application metadata and versioning
 * - Default settings and limits
 * - Color palettes and themes
 * - Performance thresholds
 * - File format specifications
 * - Tool configurations
 */

import { Vector3, Color } from 'three'
import type { 
  LabelColorPalette, 
  ProjectSettings, 
  RenderingSettings,
  BrushToolConfig,
  SmartSelectConfig,
  PolygonSelectConfig,
  LODSettings,
  ExportSettings,
} from '../types/index'

// =============================================================================
// Application Metadata
// =============================================================================

/**
 * Application Information
 */
export const APP_INFO = {
  name: 'Point Cloud Labelling Tool',
  version: '0.1.0',
  description: 'A local web application for manually labelling 3D point cloud data',
  author: 'Point Cloud Labelling Tool Team',
  repository: 'https://github.com/pointcloud-labelling-tool',
  license: 'MIT',
} as const

/**
 * Application Build Information
 */
export const BUILD_INFO = {
  buildDate: new Date().toISOString(),
  nodeVersion: 'browser',
  platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
} as const

// =============================================================================
// File Format Support
// =============================================================================

/**
 * Supported Point Cloud File Formats
 */
export const SUPPORTED_FORMATS = {
  '.ply': {
    name: 'Stanford Triangle Format',
    extensions: ['.ply'],
    mimeTypes: ['application/x-ply', 'text/plain'],
    maxSize: 1024 * 1024 * 1024, // 1GB
    hasColors: true,
    hasNormals: true,
    hasTextures: false,
    binary: true,
  },
  '.e57': {
    name: 'E57 Point Cloud Format',
    extensions: ['.e57'],
    mimeTypes: ['application/x-e57'],
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    hasColors: true,
    hasNormals: true,
    hasTextures: true,
    binary: true,
  },
  '.pcd': {
    name: 'Point Cloud Data Format',
    extensions: ['.pcd'],
    mimeTypes: ['application/x-pcd'],
    maxSize: 512 * 1024 * 1024, // 512MB
    hasColors: true,
    hasNormals: true,
    hasTextures: false,
    binary: true,
  },
  '.xyz': {
    name: 'XYZ Point Cloud Format',
    extensions: ['.xyz', '.txt'],
    mimeTypes: ['text/plain'],
    maxSize: 256 * 1024 * 1024, // 256MB
    hasColors: false,
    hasNormals: false,
    hasTextures: false,
    binary: false,
  },
} as const

/**
 * File Validation Rules
 */
export const FILE_VALIDATION = {
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
  maxPointCount: 50 * 1000 * 1000, // 50M points
  minPointCount: 10, // Minimum 10 points
  maxConcurrentFiles: 5,
  supportedExtensions: ['.ply', '.e57', '.pcd', '.xyz'],
  requiredProperties: ['positions'],
  optionalProperties: ['colors', 'normals', 'intensities'],
} as const

// =============================================================================
// Performance and Memory Limits
// =============================================================================

/**
 * Performance Thresholds
 */
export const PERFORMANCE = {
  targetFPS: 60,
  minFPS: 30,
  maxFrameTime: 16.67, // ms (60 FPS)
  memoryWarningThreshold: 1024, // MB
  memoryCriticalThreshold: 2048, // MB
  maxPointsPerFrame: 10 * 1000 * 1000, // 10M points
  lodUpdateInterval: 100, // ms
  cullingUpdateInterval: 50, // ms
  performanceMonitorInterval: 1000, // ms
} as const

/**
 * Rendering Limits
 */
export const RENDERING_LIMITS = {
  maxPointSize: 50,
  minPointSize: 0.001,
  defaultPointSize: 0.001,
  maxLODLevels: 5,
  maxSelectionPoints: 1000000, // 1M points per selection
  maxConcurrentSelections: 100,
  frustumCullingMargin: 0.1,
  nearPlane: 0.1,
  farPlane: 10000,
} as const

/**
 * Memory Management
 */
export const MEMORY = {
  gpuMemoryThreshold: 512, // MB
  systemMemoryThreshold: 1024, // MB
  garbageCollectionThreshold: 100, // MB
  bufferPoolSize: 64, // Number of buffers to pool
  texturePoolSize: 32, // Number of textures to pool
  autoCleanupInterval: 30000, // ms
} as const

// =============================================================================
// Default Color Palettes
// =============================================================================

/**
 * Default Label Color Palette
 */
export const DEFAULT_LABEL_COLORS: LabelColorPalette = {
  primary: [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#84cc16', // Lime
    '#f59e0b', // Amber
  ],
  secondary: [
    '#dc2626', // Red 600
    '#ea580c', // Orange 600
    '#ca8a04', // Yellow 600
    '#16a34a', // Green 600
    '#0891b2', // Cyan 600
    '#2563eb', // Blue 600
    '#7c3aed', // Purple 600
    '#db2777', // Pink 600
    '#65a30d', // Lime 600
    '#d97706', // Amber 600
  ],
  custom: [],
}

/**
 * Theme Colors
 */
export const THEME_COLORS = {
  light: {
    background: '#ffffff',
    surface: '#ffffff',
    primary: '#3b82f6',
    secondary: '#6b7280',
    accent: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
  },
  dark: {
    background: '#111827',
    surface: '#1f2937',
    primary: '#3b82f6',
    secondary: '#9ca3af',
    accent: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    border: '#374151',
  },
} as const

/**
 * Point Cloud Visualization Colors
 */
export const POINT_CLOUD_COLORS = {
  default: new Color(0xffffff),
  selected: new Color(0x3b82f6),
  highlighted: new Color(0xfbbf24),
  error: new Color(0xef4444),
  preview: new Color(0x10b981),
  background: new Color(0x1a1a1a),
  grid: new Color(0x444444),
  axes: {
    x: new Color(0xff4444),
    y: new Color(0x44ff44),
    z: new Color(0x4444ff),
  },
} as const

// =============================================================================
// Default Tool Configurations
// =============================================================================

/**
 * Default Brush Tool Configuration
 */
export const DEFAULT_BRUSH_CONFIG: BrushToolConfig = {
  radius: 0.005,
  shape: 'sphere',
  useFalloff: true,
  falloffType: 'smooth',
  mode: 'add',
}

/**
 * Default Smart Selection Configuration
 */
export const DEFAULT_SMART_SELECT_CONFIG: SmartSelectConfig = {
  spatialThreshold: 2.0,
  colorThreshold: 0.1,
  normalThreshold: 0.3,
  maxPoints: 100000,
  algorithm: 'region-growing',
}

/**
 * Default Polygon Selection Configuration
 */
export const DEFAULT_POLYGON_CONFIG: PolygonSelectConfig = {
  projectionPlane: 'camera',
  includeOccluded: false,
  depth: 10.0,
  showSkeleton: true,
  enableHandles: true,
  snapToGrid: false,
  gridSize: 1.0,
}

// =============================================================================
// Default Application Settings
// =============================================================================

/**
 * Default Rendering Settings
 */
export const DEFAULT_RENDERING_SETTINGS: RenderingSettings = {
  pointSize: 0.001,
  sizeAttenuation: true,
  maxPointsToRender: 10000000,
  levelOfDetail: {
    enabled: true,
    distances: [10, 50, 200, 1000],
    reductionFactors: [1.0, 0.5, 0.25, 0.1],
  },
  backgroundColor: '#1a1a1a',
  showGrid: true,
  showAxes: true,
}

/**
 * Default LOD Settings
 */
export const DEFAULT_LOD_SETTINGS: LODSettings = {
  enabled: true,
  distances: [10, 50, 200, 1000, 5000],
  reductionFactors: [1.0, 0.5, 0.25, 0.1, 0.05],
}

/**
 * Default Export Settings
 */
export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  defaultFormat: 'json',
  includeOriginalCoords: true,
  includeColors: true,
  includeNormals: false,
  coordinateSystem: 'original',
}

/**
 * Default Project Settings
 */
export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  labelColorPalette: DEFAULT_LABEL_COLORS,
  autoSaveInterval: 30000, // 30 seconds
  rendering: DEFAULT_RENDERING_SETTINGS,
  tools: {
    brush: DEFAULT_BRUSH_CONFIG,
    smartSelect: DEFAULT_SMART_SELECT_CONFIG,
    polygon: DEFAULT_POLYGON_CONFIG,
  },
  export: DEFAULT_EXPORT_SETTINGS,
}

// =============================================================================
// Camera and Navigation Constants
// =============================================================================

/**
 * Camera Configuration
 */
export const CAMERA_CONFIG = {
  defaultPosition: new Vector3(10, 10, 10),
  defaultTarget: new Vector3(0, 0, 0),
  defaultZoom: 1.0,
  minDistance: 0.1,
  maxDistance: 10000,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
  enableDamping: true,
  dampingFactor: 0.05,
  enableZoom: true,
  zoomSpeed: 1.0,
  enableRotate: true,
  rotateSpeed: 1.0,
  enablePan: true,
  panSpeed: 1.0,
  keyPanSpeed: 7.0,
  autoRotate: false,
  autoRotateSpeed: 2.0,
} as const

/**
 * Navigation Controls
 */
export const NAVIGATION_CONTROLS = {
  mouseButtons: {
    left: 'ROTATE',
    middle: 'DOLLY',
    right: 'PAN',
  },
  touches: {
    one: 'ROTATE',
    two: 'DOLLY_PAN',
  },
  keys: {
    left: 'ArrowLeft',
    up: 'ArrowUp',
    right: 'ArrowRight',
    bottom: 'ArrowDown',
  },
} as const

// =============================================================================
// Keyboard Shortcuts
// =============================================================================

/**
 * Default Keyboard Shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  // Tools
  'b': 'tool:brush',
  's': 'tool:smart-select',
  'p': 'tool:polygon',
  
  
  // File operations
  'ctrl+o': 'file:open',
  'ctrl+s': 'file:save',
  'ctrl+shift+s': 'file:save-as',
  'ctrl+e': 'file:export',
  
  // Edit operations
  'ctrl+z': 'edit:undo',
  'ctrl+y': 'edit:redo',
  'ctrl+shift+z': 'edit:redo',
  'delete': 'edit:delete-selection',
  'escape': 'edit:clear-selection',
  
  // View operations
  'f': 'view:fit',
  'r': 'view:reset',
  'g': 'view:toggle-grid',
  'a': 'view:toggle-axes',
  
  // Labels
  'ctrl+l': 'label:create',
  'ctrl+1': 'label:select-1',
  'ctrl+2': 'label:select-2',
  'ctrl+3': 'label:select-3',
  'ctrl+4': 'label:select-4',
  'ctrl+5': 'label:select-5',
  
  // UI
  'tab': 'ui:toggle-panels',
  'ctrl+/': 'ui:show-shortcuts',
  'f11': 'ui:fullscreen',
} as const

// =============================================================================
// Storage and Persistence
// =============================================================================

/**
 * Storage Configuration
 */
export const STORAGE_CONFIG = {
  dbName: 'PointCloudLabellingTool',
  dbVersion: 1,
  storeName: 'projects',
  autoSaveInterval: 30000, // 30 seconds
  maxStorageSize: 5 * 1024 * 1024 * 1024, // 5GB
  compressionEnabled: true,
  encryptionEnabled: false,
} as const

/**
 * Export Formats
 */
export const EXPORT_FORMATS = {
  json: {
    name: 'JSON',
    extension: '.json',
    mimeType: 'application/json',
    includeMetadata: true,
    compressed: false,
  },
  ply: {
    name: 'PLY',
    extension: '.ply',
    mimeType: 'application/x-ply',
    includeMetadata: false,
    compressed: false,
  },
  csv: {
    name: 'CSV',
    extension: '.csv',
    mimeType: 'text/csv',
    includeMetadata: false,
    compressed: false,
  },
  las: {
    name: 'LAS',
    extension: '.las',
    mimeType: 'application/x-las',
    includeMetadata: true,
    compressed: true,
  },
} as const

// =============================================================================
// Error Messages and Notifications
// =============================================================================

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  fileNotSupported: 'File format not supported',
  fileTooLarge: 'File size exceeds maximum limit',
  fileCorrupted: 'File appears to be corrupted',
  memoryExhausted: 'Insufficient memory to process file',
  webglNotSupported: 'WebGL is not supported in this browser',
  webglContextLost: 'WebGL context was lost',
  importFailed: 'Failed to import point cloud file',
  exportFailed: 'Failed to export labeled data',
  saveFailed: 'Failed to save project',
  loadFailed: 'Failed to load project',
  selectionFailed: 'Selection operation failed',
  renderingError: 'Rendering error occurred',
  unknownError: 'An unknown error occurred',
} as const

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  fileImported: 'Point cloud file imported successfully',
  projectSaved: 'Project saved successfully',
  projectLoaded: 'Project loaded successfully',
  dataExported: 'Labeled data exported successfully',
  selectionCreated: 'Selection created successfully',
  labelCreated: 'Label created successfully',
} as const

// =============================================================================
// Animation and Timing
// =============================================================================

/**
 * Animation Configuration
 */
export const ANIMATION_CONFIG = {
  defaultDuration: 250, // ms
  easing: 'ease-out',
  spring: {
    tension: 170,
    friction: 26,
  },
  transitions: {
    fast: 150,
    normal: 250,
    slow: 500,
  },
} as const

/**
 * Timing Configuration
 */
export const TIMING_CONFIG = {
  debounceDelay: 300, // ms
  throttleDelay: 16, // ms (~60fps)
  tooltipDelay: 500, // ms
  notificationDuration: 5000, // ms
  autoSaveDebounce: 2000, // ms
  performanceUpdateInterval: 1000, // ms
} as const

// =============================================================================
// Development and Debug Settings
// =============================================================================

/**
 * Development Configuration
 */
export const DEV_CONFIG = {
  enablePerformanceMonitoring: true,
  enableMemoryMonitoring: true,
  enableRenderingDebug: false,
  enableVerboseLogging: false,
  showFPSCounter: true,
  showMemoryUsage: true,
  mockDataGeneration: false,
  skipIntroAnimation: false,
} as const

/**
 * Debug Flags
 */
export const DEBUG_FLAGS = {
  showBoundingBoxes: false,
  showNormals: false,
  wireframeMode: false,
  showLODLevels: false,
  highlightCulledPoints: false,
  showSelectionBounds: false,
  logPerformanceMetrics: false,
  enableShaderDebug: false,
} as const

// =============================================================================
// Validation Schemas
// =============================================================================

/**
 * Validation Rules
 */
export const VALIDATION_RULES = {
  projectName: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
  },
  labelName: {
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
  },
  fileName: {
    minLength: 1,
    maxLength: 255,
    pattern: /^[^<>:"/\\|?*]+$/,
  },
  pointCount: {
    min: 10,
    max: 50000000,
  },
  fileSize: {
    min: 1,
    max: 2147483648, // 2GB
  },
} as const
