/**
 * Extended Three.js Type Definitions
 * 
 * This file extends the base Three.js types to add custom properties,
 * methods, and interfaces specific to the Point Cloud Labelling Tool.
 * 
 * Key extensions:
 * - Point cloud specific materials and geometries
 * - Selection and interaction helpers
 * - Performance optimization interfaces
 * - Custom shader uniforms and attributes
 */

import {
  BufferGeometry,
  Points,
  ShaderMaterial,
  Uniform,
  Vector3,
  Vector2,
  Color,
  Camera,
  BufferAttribute,
  Box3,
} from 'three'

// Extend Three.js namespace
declare module 'three' {
  
  // =============================================================================
  // Point Cloud Geometry Extensions
  // =============================================================================
  
  interface BufferGeometry {
    /**
     * Point cloud specific metadata
     */
    pointCloudMetadata?: {
      /** Original point count before processing */
      originalPointCount: number
      /** LOD level (0 = full resolution) */
      lodLevel: number
      /** Bounding sphere radius for culling */
      boundingSphereRadius: number
      /** Last update timestamp */
      lastUpdated: Date
    }
    
    /**
     * Selection state for point cloud geometry
     */
    selectionState?: {
      /** Currently selected point indices */
      selectedIndices: Set<number>
      /** Point colors before selection (for restoration) */
      originalColors?: Float32Array
      /** Selection colors */
      selectionColors?: Float32Array
    }
    
    /**
     * Performance optimization flags
     */
    optimizationFlags?: {
      /** Whether geometry is using instanced rendering */
      isInstanced: boolean
      /** Whether geometry has been optimized for GPU */
      isGPUOptimized: boolean
      /** Whether to use frustum culling */
      useFrustumCulling: boolean
    }
  }
  
  // =============================================================================
  // Point Cloud Material Extensions
  // =============================================================================
  
  interface ShaderMaterial {
    /**
     * Point cloud specific uniforms
     */
    pointCloudUniforms?: {
      /** Point size uniform */
      uPointSize: Uniform<number>
      /** Point size attenuation */
      uSizeAttenuation: Uniform<boolean>
      /** Selection color uniform */
      uSelectionColor: Uniform<Color>
      /** Highlight color uniform */
      uHighlightColor: Uniform<Color>
      /** LOD distance thresholds */
      uLODDistances: Uniform<number[]>
      /** Camera position for distance calculations */
      uCameraPosition: Uniform<Vector3>
      /** Viewport size for point scaling */
      uViewportSize: Uniform<Vector2>
      /** Time for animations */
      uTime: Uniform<number>
    }
    
    /**
     * Custom shader attributes
     */
    customAttributes?: {
      /** Point selection state (0 = unselected, 1 = selected) */
      aSelection: BufferAttribute
      /** Point labels (numeric label IDs) */
      aLabel: BufferAttribute
      /** Point intensities */
      aIntensity: BufferAttribute
      /** Point classifications */
      aClassification: BufferAttribute
      /** Custom point data */
      aCustomData: BufferAttribute
    }
  }
  
  // =============================================================================
  // Points Object Extensions
  // =============================================================================
  
  interface Points {
    /**
     * Point cloud specific properties
     */
    pointCloudData?: {
      /** Reference to source point cloud data */
      sourceData: import('./index').PointCloudData
      /** Current LOD level being displayed */
      currentLOD: number
      /** Last render time for performance monitoring */
      lastRenderTime: number
      /** Number of points actually rendered */
      renderedPointCount: number
    }
    
    /**
     * Selection and interaction state
     */
    interactionState?: {
      /** Whether this point cloud is currently selectable */
      isSelectable: boolean
      /** Current selection tool being used */
      activeTool: import('./index').SelectionTool | null
      /** Selection bounding box */
      selectionBounds?: Box3
      /** Hover state for mouse interactions */
      isHovered: boolean
    }
    
    /**
     * Performance monitoring
     */
    performanceData?: {
      /** Frame time history for monitoring */
      frameTimeHistory: number[]
      /** Memory usage tracking */
      memoryUsage: number
      /** GPU memory usage */
      gpuMemoryUsage: number
      /** Last performance update */
      lastPerformanceUpdate: Date
    }
  }
  
  // =============================================================================
  // WebGL Renderer Extensions
  // =============================================================================
  
  interface WebGLRenderer {
    /**
     * Point cloud rendering extensions
     */
    pointCloudExtensions?: {
      /** Maximum points that can be rendered efficiently */
      maxPointCapacity: number
      /** Current point cloud rendering mode */
      renderingMode: 'standard' | 'instanced' | 'compute'
      /** GPU memory manager */
      memoryManager: GPUMemoryManager
      /** Performance monitor */
      performanceMonitor: RenderingPerformanceMonitor
    }
  }
  
  // =============================================================================
  // Camera Extensions
  // =============================================================================
  
  interface Camera {
    /**
     * Point cloud specific camera properties
     */
    pointCloudCamera?: {
      /** LOD calculation parameters */
      lodCalculation: {
        /** Base distance for LOD calculation */
        baseDistance: number
        /** LOD transition factors */
        transitionFactors: number[]
        /** Current calculated LOD level */
        currentLOD: number
      }
      
      /** Frustum culling optimization */
      frustumCulling: {
        /** Whether frustum culling is enabled */
        enabled: boolean
        /** Culling margin for smooth transitions */
        margin: number
        /** Last culling update time */
        lastUpdate: number
      }
    }
  }
  
  // =============================================================================
  // Raycaster Extensions
  // =============================================================================
  
  interface Raycaster {
    /**
     * Point cloud intersection parameters
     */
    pointCloudParams?: {
      /** Point selection threshold (world units) */
      threshold: number
      /** Maximum distance for point selection */
      maxDistance: number
      /** Whether to use LOD for intersection tests */
      useLOD: boolean
      /** Sort intersections by distance */
      sortByDistance: boolean
    }
  }
  
  // =============================================================================
  // Scene Extensions
  // =============================================================================
  
  interface Scene {
    /**
     * Point cloud scene management
     */
    pointCloudManager?: {
      /** All point clouds in the scene */
      pointClouds: Map<string, Points>
      /** Current active point cloud */
      activePointCloud: Points | null
      /** Scene performance metrics */
      performance: ScenePerformanceMetrics
      /** Memory usage tracking */
      memoryUsage: SceneMemoryUsage
    }
  }
}

// =============================================================================
// Custom Three.js Helper Types
// =============================================================================

/**
 * GPU Memory Manager Interface
 */
export interface GPUMemoryManager {
  /** Total available GPU memory (MB) */
  totalMemory: number
  /** Currently used GPU memory (MB) */
  usedMemory: number
  /** Memory usage by point clouds */
  pointCloudMemory: number
  /** Memory cleanup threshold */
  cleanupThreshold: number
  
  /** Allocate memory for point cloud */
  allocate(pointCount: number, hasColors: boolean, hasNormals: boolean): boolean
  /** Release memory for point cloud */
  release(pointCloudId: string): void
  /** Force garbage collection */
  forceCleanup(): void
  /** Get memory usage statistics */
  getStats(): GPUMemoryStats
}

/**
 * GPU Memory Statistics
 */
export interface GPUMemoryStats {
  total: number
  used: number
  available: number
  pointClouds: number
  textures: number
  buffers: number
  fragmentation: number
}

/**
 * Rendering Performance Monitor
 */
export interface RenderingPerformanceMonitor {
  /** Current FPS */
  fps: number
  /** Frame time (ms) */
  frameTime: number
  /** Draw calls per frame */
  drawCalls: number
  /** Triangles/points rendered per frame */
  primitiveCount: number
  /** GPU time (ms) */
  gpuTime: number
  
  /** Start frame timing */
  startFrame(): void
  /** End frame timing */
  endFrame(): void
  /** Get performance metrics */
  getMetrics(): RenderingMetrics
  /** Reset performance counters */
  reset(): void
}

/**
 * Rendering Metrics
 */
export interface RenderingMetrics {
  fps: number
  frameTime: number
  averageFrameTime: number
  minFrameTime: number
  maxFrameTime: number
  drawCalls: number
  primitiveCount: number
  memoryUsage: number
  timestamp: Date
}

/**
 * Scene Performance Metrics
 */
export interface ScenePerformanceMetrics {
  /** Total points in scene */
  totalPoints: number
  /** Rendered points (after LOD/culling) */
  renderedPoints: number
  /** Number of point clouds */
  pointCloudCount: number
  /** Scene update time (ms) */
  updateTime: number
  /** Culling time (ms) */
  cullingTime: number
  /** Last update timestamp */
  lastUpdate: Date
}

/**
 * Scene Memory Usage
 */
export interface SceneMemoryUsage {
  /** Geometry memory (MB) */
  geometry: number
  /** Material memory (MB) */
  materials: number
  /** Texture memory (MB) */
  textures: number
  /** Buffer memory (MB) */
  buffers: number
  /** Total scene memory (MB) */
  total: number
}

// =============================================================================
// Point Cloud Specific Three.js Classes
// =============================================================================

/**
 * Point Cloud Geometry
 * Optimized geometry class for large point clouds
 */
export declare class PointCloudGeometry extends BufferGeometry {
  constructor(pointData: import('./index').PointCloudData)
  
  /** Update point positions */
  updatePositions(positions: Float32Array): void
  /** Update point colors */
  updateColors(colors: Float32Array): void
  /** Update point selection state */
  updateSelection(selectedIndices: Uint32Array): void
  /** Generate LOD levels */
  generateLOD(levels: number[]): void
  /** Optimize for GPU rendering */
  optimizeForGPU(): void
  /** Compute bounding box with margin */
  computeBoundingBoxWithMargin(margin: number): void
}

/**
 * Point Cloud Material
 * Custom material for point cloud rendering with selection support
 */
export declare class PointCloudMaterial extends ShaderMaterial {
  constructor(parameters?: PointCloudMaterialParameters)
  
  /** Update point size */
  setPointSize(size: number): void
  /** Update selection color */
  setSelectionColor(color: Color): void
  /** Update highlight color */
  setHighlightColor(color: Color): void
  /** Enable/disable size attenuation */
  setSizeAttenuation(enabled: boolean): void
  /** Update LOD distances */
  setLODDistances(distances: number[]): void
}

/**
 * Point Cloud Material Parameters
 */
export interface PointCloudMaterialParameters {
  pointSize?: number
  sizeAttenuation?: boolean
  selectionColor?: Color
  highlightColor?: Color
  lodDistances?: number[]
  alphaTest?: number
  transparent?: boolean
  depthTest?: boolean
  depthWrite?: boolean
}

/**
 * Point Cloud Helper
 * Utility class for point cloud operations
 */
export declare class PointCloudHelper {
  /** Create optimized point cloud from data */
  static createFromData(data: import('./index').PointCloudData): Points
  /** Update point cloud LOD based on camera */
  static updateLOD(pointCloud: Points, camera: Camera): void
  /** Perform frustum culling */
  static performFrustumCulling(pointCloud: Points, camera: Camera): void
  /** Calculate optimal point size */
  static calculateOptimalPointSize(pointCloud: Points, camera: Camera): number
  /** Generate selection preview */
  static generateSelectionPreview(pointCloud: Points, tool: import('./index').SelectionTool): void
}

// =============================================================================
// Selection and Interaction Extensions
// =============================================================================

/**
 * Point Selection Result
 */
export interface PointSelectionResult {
  /** Selected point indices */
  indices: number[]
  /** World positions of selected points */
  positions: Vector3[]
  /** Selection confidence (for smart selection) */
  confidence: number
  /** Selection metadata */
  metadata: {
    tool: import('./index').SelectionTool
    parameters: Record<string, unknown>
    processingTime: number
  }
}

/**
 * Point Cloud Intersection
 */
export interface PointCloudIntersection {
  /** Distance from ray origin */
  distance: number
  /** Point index */
  pointIndex: number
  /** World position */
  point: Vector3
  /** Point color (if available) */
  color?: Color
  /** Point normal (if available) */
  normal?: Vector3
  /** Associated point cloud object */
  object: Points
}

// =============================================================================
// Performance and Optimization Types
// =============================================================================

/**
 * LOD Configuration
 */
export interface LODConfiguration {
  /** Distance thresholds for each LOD level */
  distances: number[]
  /** Point reduction factors for each level */
  reductionFactors: number[]
  /** Transition smoothing */
  smoothTransitions: boolean
  /** Automatic LOD calculation */
  automatic: boolean
}

/**
 * Culling Configuration
 */
export interface CullingConfiguration {
  /** Enable frustum culling */
  frustum: boolean
  /** Enable occlusion culling */
  occlusion: boolean
  /** Enable distance culling */
  distance: boolean
  /** Maximum culling distance */
  maxDistance: number
  /** Culling update frequency (ms) */
  updateFrequency: number
}

/**
 * Rendering Optimization Settings
 */
export interface RenderingOptimization {
  /** Use instanced rendering */
  instancing: boolean
  /** Use GPU compute shaders */
  computeShaders: boolean
  /** Batch similar point clouds */
  batching: boolean
  /** Use texture atlasing */
  textureAtlasing: boolean
  /** Point sprite optimization */
  pointSprites: boolean
} 