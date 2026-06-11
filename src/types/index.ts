/**
 * Core TypeScript Interfaces for Point Cloud Labelling Tool
 * 
 * This file contains all the primary type definitions used throughout the application.
 * These interfaces ensure type safety for point cloud operations, labelling workflows,
 * and 3D visualization components.
 * 
 * Key type categories:
 * - Point cloud data structures
 * - Label and selection management
 * - File format handling
 * - Application state management
 * - 3D rendering and interaction
 */

import { Vector3, Points } from 'three'

// =============================================================================
// Point Cloud Data Types
// =============================================================================

/**
 * Point Cloud Metadata
 * Contains information about the point cloud file and its properties
 */
export interface PointCloudMetadata {
  /** Original filename */
  filename: string
  /** File format (.ply, .e57, etc.) */
  format: PointCloudFormat
  /** Total number of points */
  pointCount: number
  /** File size in bytes */
  fileSize: number
  /** Whether the point cloud contains color information */
  hasColors: boolean
  /** Whether the point cloud contains normal vectors */
  hasNormals: boolean
  /** Whether the point cloud contains texture coordinates */
  hasTextureCoords: boolean
  /** Bounding box of the point cloud */
  boundingBox: BoundingBox
  /** Point density (points per cubic unit) */
  density?: number
  /** Original coordinate system information */
  coordinateSystem?: string
  /** Creation timestamp */
  createdAt: Date
  /** Last modified timestamp */
  lastModified: Date
}

/**
 * Supported Point Cloud File Formats
 */
export type PointCloudFormat = '.ply' | '.e57' | '.pcd' | '.xyz' | '.las' | '.laz'

/**
 * 3D Bounding Box
 */
export interface BoundingBox {
  min: Vector3
  max: Vector3
  center: Vector3
  size: Vector3
}

/**
 * Raw Point Cloud Data Structure
 * Represents the parsed point cloud data in a format suitable for Three.js
 */
export interface PointCloudData {
  /** Unique identifier for this point cloud */
  id: string
  /** Point cloud metadata */
  metadata: PointCloudMetadata
  /** Point positions as flat array [x1, y1, z1, x2, y2, z2, ...] */
  positions: Float32Array
  /** Point colors as flat array [r1, g1, b1, r2, g2, b2, ...] (optional) */
  colors?: Float32Array
  /** Point normals as flat array [nx1, ny1, nz1, nx2, ny2, nz2, ...] (optional) */
  normals?: Float32Array
  /** Point intensities (optional) */
  intensities?: Float32Array
  /** Point classifications (optional) */
  classifications?: Uint8Array
  /** Original file buffer for re-processing */
  originalBuffer?: ArrayBuffer
  /** Level-of-detail representations */
  lodLevels?: PointCloudLOD[]
}

/**
 * Level-of-Detail representation for performance optimization
 */
export interface PointCloudLOD {
  level: number
  pointCount: number
  positions: Float32Array
  colors?: Float32Array
  /** Distance threshold for this LOD level */
  distance: number
}

// =============================================================================
// Label Management Types
// =============================================================================

/**
 * Label Definition
 * Represents a category that can be assigned to point cloud regions
 */
export interface Label {
  /** Unique identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Display color (hex string) */
  color: string
  /** Optional description */
  description?: string
  /** Number of points currently assigned to this label */
  pointCount: number
  /** Whether this label is currently visible */
  visible: boolean
  /** Creation timestamp */
  createdAt: Date
  /** Parent label for hierarchical organization (optional) */
  parentId?: string
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

/**
 * Label Color Palette
 * Predefined colors for automatic label assignment
 */
export interface LabelColorPalette {
  primary: string[]
  secondary: string[]
  custom: string[]
}

// =============================================================================
// Selection and Interaction Types
// =============================================================================

/**
 * Point Selection
 * Represents a set of selected points with associated label
 */
export interface Selection {
  /** Unique identifier */
  id: string
  /** Associated label ID */
  labelId: string
  /** Indices of selected points in the point cloud */
  pointIndices: Uint32Array
  /** Tool used to create this selection */
  toolUsed: SelectionTool
  /** Creation timestamp */
  createdAt: Date
  /** Bounding box of the selection */
  boundingBox?: BoundingBox
  /** Confidence score (for smart selections) */
  confidence?: number
  /** Selection metadata */
  metadata?: SelectionMetadata
}

/**
 * Selection Tools
 */
export type SelectionTool = 'brush' | 'smart' | 'polygon'

/**
 * Selection Metadata
 * Additional information about how the selection was created
 */
export interface SelectionMetadata {
  /** Tool-specific parameters */
  toolParameters?: Record<string, unknown>
  /** User who created the selection */
  createdBy?: string
  /** Processing time (for performance analysis) */
  processingTime?: number
  /** Selection quality metrics */
  quality?: SelectionQuality
}

/**
 * Selection Quality Metrics
 */
export interface SelectionQuality {
  /** Accuracy score (0-1) */
  accuracy?: number
  /** Precision score (0-1) */
  precision?: number
  /** Recall score (0-1) */
  recall?: number
  /** Confidence score (0-1) */
  confidence?: number
}

// =============================================================================
// Tool Configuration Types
// =============================================================================

/**
 * Brush Tool Configuration
 */
export interface BrushToolConfig {
  /** Brush radius in world units */
  radius: number
  /** Brush shape */
  shape: 'sphere' | 'cylinder' | 'box'
  /** Whether to use falloff */
  useFalloff: boolean
  /** Falloff curve type */
  falloffType?: 'linear' | 'smooth' | 'sharp'
  /** Selection mode */
  mode: 'add' | 'subtract' | 'replace'
}

/**
 * Smart Selection Configuration
 */
export interface SmartSelectConfig {
  /** Spatial proximity threshold */
  spatialThreshold: number
  /** Color similarity threshold (0-1) */
  colorThreshold: number
  /** Normal similarity threshold (0-1) */
  normalThreshold: number
  /** Maximum number of points to select */
  maxPoints: number
  /** Region growing algorithm */
  algorithm: 'region-growing' | 'clustering' | 'ml-based'
}

/**
 * Polygon Selection Configuration (3D Cube)
 */
export interface PolygonSelectConfig {
  /** Projection plane for 2D polygon */
  projectionPlane: 'xy' | 'xz' | 'yz' | 'camera'
  /** Whether to include points behind the polygon */
  includeOccluded: boolean
  /** Selection depth (for 3D polygon selection) */
  depth?: number
  /** Show 3D cube skeleton during selection */
  showSkeleton: boolean
  /** Enable interactive handles for resizing */
  enableHandles: boolean
  /** Snap to grid when moving/resizing */
  snapToGrid: boolean
  /** Grid size for snapping */
  gridSize: number
}

/**
 * 3D Cube Selection State
 */
export interface CubeSelectionState {
  /** Whether cube selection is active */
  isActive: boolean
  /** Center position of the cube */
  center: Vector3
  /** Size of the cube (width, height, depth) */
  size: Vector3
  /** Rotation angles (x, y, z) in radians */
  rotation: Vector3
  /** Currently selected handle for resizing */
  activeHandle: CubeHandle | null
  /** Whether the cube is being dragged */
  isDragging: boolean
  /** Initial mouse position when dragging started */
  dragStart: Vector3 | null
  /** Show numerical controls */
  showControls: boolean
  /** Whether the cube is persistent (waiting for confirmation) */
  isPersistent?: boolean
}

/**
 * Cube Handle Types for Interactive Resizing
 */
export type CubeHandle = 
  | 'center' 
  | 'face-front' | 'face-back' | 'face-left' | 'face-right' | 'face-top' | 'face-bottom'
  | 'edge-front-top' | 'edge-front-bottom' | 'edge-front-left' | 'edge-front-right'
  | 'edge-back-top' | 'edge-back-bottom' | 'edge-back-left' | 'edge-back-right'
  | 'corner-000' | 'corner-001' | 'corner-010' | 'corner-011' 
  | 'corner-100' | 'corner-101' | 'corner-110' | 'corner-111'

/**
 * Cube Visual Style
 */
export interface CubeVisualStyle {
  /** Color of the cube wireframe */
  wireframeColor: string
  /** Color of the cube faces (transparent) */
  faceColor: string
  /** Color of handles when idle */
  handleColor: string
  /** Color of handles when hovered */
  handleHoverColor: string
  /** Color of handles when active */
  handleActiveColor: string
  /** Line width for wireframe */
  lineWidth: number
  /** Handle size */
  handleSize: number
  /** Face opacity */
  faceOpacity: number
}

// =============================================================================
// Project and Storage Types
// =============================================================================

/**
 * Project Data Structure
 * Represents a complete labelling project
 */
export interface Project {
  /** Unique project identifier */
  id: string
  /** Project name */
  name: string
  /** Project description */
  description?: string
  /** Point cloud files in this project */
  pointCloudFiles: PointCloudFile[]
  /** Labels defined for this project */
  labels: Label[]
  /** All selections made in this project */
  selections: Selection[]
  /** Project settings */
  settings: ProjectSettings
  /** Creation timestamp */
  createdAt: Date
  /** Last modified timestamp */
  lastModified: Date
  /** Project metadata */
  metadata?: Record<string, unknown>
}

/**
 * Point Cloud File Reference
 * Represents a file within a project
 */
export interface PointCloudFile {
  /** Unique file identifier */
  id: string
  /** Original filename */
  name: string
  /** File size in bytes */
  size: number
  /** File format */
  format: PointCloudFormat
  /** Processing status */
  status: FileProcessingStatus
  /** Processed point cloud data */
  data?: PointCloudData
  /** Processing error (if any) */
  error?: string
  /** Upload timestamp */
  uploadedAt: Date
  /** Processing completion timestamp */
  processedAt?: Date
}

/**
 * File Processing Status
 */
export type FileProcessingStatus = 'pending' | 'processing' | 'completed' | 'error'

/**
 * Project Settings
 */
export interface ProjectSettings {
  /** Default label color palette */
  labelColorPalette: LabelColorPalette
  /** Auto-save interval (milliseconds) */
  autoSaveInterval: number
  /** Point rendering settings */
  rendering: RenderingSettings
  /** Tool default configurations */
  tools: ToolSettings
  /** Export settings */
  export: ExportSettings
}

/**
 * Rendering Settings
 */
export interface RenderingSettings {
  /** Default point size */
  pointSize: number
  /** Point size attenuation */
  sizeAttenuation: boolean
  /** Maximum points to render */
  maxPointsToRender: number
  /** LOD settings */
  levelOfDetail: LODSettings
  /** Background color */
  backgroundColor: string
  /** Grid visibility */
  showGrid: boolean
  /** Axes visibility */
  showAxes: boolean
}

/**
 * Level-of-Detail Settings
 */
export interface LODSettings {
  /** Enable LOD system */
  enabled: boolean
  /** Distance thresholds for LOD levels */
  distances: number[]
  /** Point reduction factors for each level */
  reductionFactors: number[]
}

/**
 * Tool Settings
 */
export interface ToolSettings {
  brush: BrushToolConfig
  smartSelect: SmartSelectConfig
  polygon: PolygonSelectConfig
}

/**
 * Export Settings
 */
export interface ExportSettings {
  /** Default export format */
  defaultFormat: ExportFormat
  /** Include original coordinates */
  includeOriginalCoords: boolean
  /** Include colors in export */
  includeColors: boolean
  /** Include normals in export */
  includeNormals: boolean
  /** Coordinate system for export */
  coordinateSystem?: string
}

/**
 * Export Formats
 */
export type ExportFormat = 'json' | 'ply' | 'csv' | 'las' | 'annotations' | 'custom'

/**
 * Export Options
 */
export interface ExportOptions {
  /** Whether to automatically download the exported file */
  download?: boolean
  /** Include point colors in export */
  includeColors?: boolean
  /** Include point normals in export */
  includeNormals?: boolean
  /** Include labels in export */
  includeLabels?: boolean
  /** Coordinate system for export */
  coordinateSystem?: string
  /** Custom metadata to include */
  metadata?: Record<string, unknown>
}

/**
 * Project Metadata with proper ID support
 */
export interface ProjectMetadata {
  /** Unique project identifier */
  id: string
  /** Project name (used as ID) */
  name: string
  /** Project description */
  description: string
  /** Project version */
  version: string
  /** Creation timestamp */
  createdAt: string
  /** Last modified timestamp */
  updatedAt: string
  /** Project author */
  author: string
  /** Project tags */
  tags: string[]
  /** Project statistics */
  statistics: {
    totalPoints: number
    labeledPoints: number
    totalLabels: number
    totalFiles: number
    completionPercentage: number
  }
}

/**
 * Enhanced Project with Multi-File Support
 */
export interface EnhancedProject {
  /** Unique project identifier */
  id: string
  /** Project metadata */
  metadata: ProjectMetadata
  /** Point cloud files in this project */
  files: ProjectFile[]
  /** Currently active file index */
  activeFileIndex: number
  /** Project labels (shared across all files) */
  labels: Label[]
  /** Project selections (organized by file) */
  selections: Record<string, Selection[]>
  /** Project settings */
  settings: {
    renderingSettings: {
      pointSize: number
      colorMode: string
      backgroundColor: string
    }
    labelingSettings: {
      autoSave: boolean
      showStatistics: boolean
      defaultBrushSize: number
    }
  }
}

/**
 * Project File (individual point cloud within a project)
 */
export interface ProjectFile {
  /** Unique file identifier */
  id: string
  /** Original filename */
  name: string
  /** File size in bytes */
  size: number
  /** Upload timestamp */
  uploadedAt: string
  /** Processing status */
  status: 'processing' | 'ready' | 'error'
  /** Point cloud data (null if not loaded) */
  data: PointCloudData | null
  /** Processing error message */
  error?: string
}

// =============================================================================
// Application State Types
// =============================================================================

/**
 * Application State
 * Top-level state for the entire application
 */
export interface AppState {
  /** Current project */
  currentProject: Project | null
  /** Currently loaded point cloud */
  currentPointCloud: PointCloudData | null
  /** Current tool selection */
  activeTool: SelectionTool
  /** Current label selection */
  activeLabel: Label | null
  /** Current selections */
  selections: Selection[]
  /** Undo/redo history */
  history: HistoryState
  /** UI state */
  ui: UIState
  /** Performance metrics */
  performance: PerformanceMetrics
}

/**
 * History State for Undo/Redo
 */
export interface HistoryState {
  /** History entries */
  entries: HistoryEntry[]
  /** Current position in history */
  currentIndex: number
  /** Maximum history size */
  maxSize: number
}

/**
 * History Entry
 */
export interface HistoryEntry {
  /** Unique identifier */
  id: string
  /** Action type */
  action: HistoryAction
  /** State before the action */
  beforeState: Partial<AppState>
  /** State after the action */
  afterState: Partial<AppState>
  /** Timestamp */
  timestamp: Date
  /** Human-readable description */
  description: string
}

/**
 * History Actions
 */
export type HistoryAction = 'selection' | 'label-create' | 'label-edit' | 'label-delete' | 'import-file' | 'tool-change'

/**
 * UI State
 */
export interface UIState {
  /** Panel visibility states */
  panels: PanelState
  /** Current theme */
  theme: 'light' | 'dark' | 'auto'
  /** Viewport camera state */
  camera: CameraState
  /** Loading states */
  loading: LoadingState
  /** Error states */
  error: ErrorState | null
}

/**
 * Panel State
 */
export interface PanelState {
  tools: boolean
  labels: boolean
  statistics: boolean
  settings: boolean
  fileExplorer: boolean
}

/**
 * Camera State
 */
export interface CameraState {
  position: Vector3
  target: Vector3
  zoom: number
  /** Orbit controls state */
  controls?: {
    azimuthAngle: number
    polarAngle: number
    distance: number
  }
}

/**
 * Loading State
 */
export interface LoadingState {
  fileImport: boolean
  fileProcessing: boolean
  rendering: boolean
  export: boolean
  autoSave: boolean
}

/**
 * Error State
 */
export interface ErrorState {
  message: string
  type: ErrorType
  details?: string
  timestamp: Date
  recoverable: boolean
}

/**
 * Error Types
 */
export type ErrorType = 'file-error' | 'rendering-error' | 'memory-error' | 'webgl-error' | 'network-error' | 'validation-error'

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  /** Frames per second */
  fps: number
  /** Frame time in milliseconds */
  frameTime: number
  /** Memory usage (MB) */
  memoryUsage: number
  /** GPU memory usage (MB) */
  gpuMemoryUsage?: number
  /** Number of rendered points */
  pointCount: number
  /** Number of visible chunks */
  visibleChunks?: number
  /** Total number of chunks */
  totalChunks?: number
  /** Quality setting (0-100) */
  quality?: number
  /** Point cloud rendering time (ms) */
  renderTime?: number
  /** Selection processing time (ms) */
  selectionTime?: number
  /** Last updated timestamp */
  lastUpdated?: Date
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Application Events
 */
export interface AppEvents {
  'project:loaded': Project
  'project:saved': Project
  'file:imported': PointCloudFile
  'file:processed': PointCloudFile
  'selection:created': Selection
  'selection:modified': Selection
  'selection:deleted': string
  'label:created': Label
  'label:modified': Label
  'label:deleted': string
  'tool:changed': SelectionTool
  'error:occurred': ErrorState
  'performance:updated': PerformanceMetrics
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Deep Partial Type
 * Makes all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Point Cloud Processing Options
 */
export interface ProcessingOptions {
  /** Generate LOD levels */
  generateLOD: boolean
  /** Compute normals if missing */
  computeNormals: boolean
  /** Normalize coordinates */
  normalizeCoordinates: boolean
  /** Remove duplicates */
  removeDuplicates: boolean
  /** Downsample large point clouds */
  downsample: boolean
  /** Target point count for downsampling */
  targetPointCount?: number
}

/**
 * File Import Result
 */
export interface ImportResult {
  success: boolean
  file?: PointCloudFile
  error?: string
  warnings?: string[]
  processingTime: number
}

/**
 * Point cloud intersection result from raycasting
 */
export interface PointCloudIntersection {
  /** Distance from camera to intersection point */
  distance: number
  /** Index of the intersected point in the point cloud */
  pointIndex: number
  /** World position of the intersection */
  point: Vector3
  /** The point cloud object that was intersected */
  object: Points
}

/**
 * File Processing Progress
 */
export interface FileProcessingProgress {
  /** Current processing stage */
  stage: 'reading' | 'parsing' | 'processing' | 'complete'
  /** Progress percentage (0-1) */
  progress: number
  /** Human-readable status message */
  message: string
  /** Number of points processed so far */
  pointsProcessed: number
  /** Total number of points to process */
  totalPoints: number
  /** Processing start time */
  startTime?: number
  /** Estimated completion time */
  estimatedCompletion?: number
}

/**
 * File Validation Result
 */
export interface FileValidationResult {
  /** Whether the file passed validation */
  isValid: boolean
  /** Validation errors (file cannot be processed) */
  errors: string[]
  /** Validation warnings (file can be processed but may have issues) */
  warnings: string[]
  /** Basic file information */
  fileInfo: {
    name: string
    size: number
    type: string
    lastModified: number
  }
}

/**
 * Simplified Project Interface for ProjectManager
 * This is the structure used by the current project management system
 */
export interface SimpleProject {
  /** Unique project identifier */
  id: string
  /** Project metadata */
  metadata: ProjectMetadata
  /** Point cloud data */
  pointCloud: PointCloudData | null
  /** Project labels */
  labels: Label[]
  /** Project selections */
  selections: Selection[]
  /** Project settings */
  settings: {
    renderingSettings: {
      pointSize: number
      colorMode: string
      backgroundColor: string
    }
    labelingSettings: {
      autoSave: boolean
      showStatistics: boolean
      defaultBrushSize: number
    }
  }
} 