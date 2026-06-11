/**
 * Performance Optimizer for Point Cloud Rendering
 * 
 * Handles advanced performance optimizations including:
 * - Level of Detail (LOD) management
 * - Frustum culling and occlusion culling
 * - Memory management and garbage collection
 * - Point cloud decimation and streaming
 * - Performance monitoring and adaptive quality
 */

import * as THREE from 'three'
import type { PointCloudData, PerformanceMetrics } from '../types/index'

export interface LODLevel {
  /** Distance threshold for this LOD level */
  distance: number
  /** Point decimation factor (0.1 = 10% of points) */
  decimation: number
  /** Point size multiplier */
  pointSize: number
  /** Whether to use simplified shading */
  simplifiedShading: boolean
}

export interface PerformanceConfig {
  /** Target frame rate */
  targetFPS: number
  /** Maximum number of points to render at once */
  maxRenderPoints: number
  /** LOD configuration */
  lodLevels: LODLevel[]
  /** Enable frustum culling */
  enableFrustumCulling: boolean
  /** Enable occlusion culling */
  enableOcclusionCulling: boolean
  /** Memory threshold in MB */
  memoryThreshold: number
  /** Enable adaptive quality */
  enableAdaptiveQuality: boolean
}

export interface ChunkedPointCloud {
  /** Chunk identifier */
  id: string
  /** Bounding box of the chunk */
  boundingBox: THREE.Box3
  /** Original points data */
  points: Float32Array
  /** Colors data */
  colors?: Float32Array
  /** LOD versions of this chunk */
  lodVersions: Map<number, { points: Float32Array; colors?: Float32Array }>
  /** Three.js geometry object */
  geometry?: THREE.BufferGeometry
  /** Three.js material */
  material?: THREE.PointsMaterial
  /** Three.js points object */
  pointsObject?: THREE.Points
  /** Whether this chunk is currently visible */
  isVisible: boolean
  /** Last frame this chunk was rendered */
  lastRendered: number
}

export class PerformanceOptimizer {
  private config: PerformanceConfig
  private chunks: Map<string, ChunkedPointCloud> = new Map()
  private camera: THREE.Camera
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  
  // Performance monitoring
  private frameCount = 0
  private lastFrameTime = 0
  private averageFPS = 60
  private memoryUsage = 0
  private renderedPointCount = 0
  
  // Adaptive quality
  private currentQuality = 1.0
  private qualityAdjustmentCooldown = 0
  
  // Culling
  private frustum = new THREE.Frustum()
  private cameraMatrix = new THREE.Matrix4()
  
  constructor(
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    config?: Partial<PerformanceConfig>,
  ) {
    this.camera = camera
    this.renderer = renderer
    this.scene = scene
    
    this.config = {
      targetFPS: 60,
      maxRenderPoints: 2000000, // 2M points max
      lodLevels: [
        { distance: 10, decimation: 1.0, pointSize: 1.0, simplifiedShading: false },
        { distance: 50, decimation: 0.5, pointSize: 1.2, simplifiedShading: false },
        { distance: 200, decimation: 0.25, pointSize: 1.5, simplifiedShading: true },
        { distance: 1000, decimation: 0.1, pointSize: 2.0, simplifiedShading: true },
        { distance: Infinity, decimation: 0.05, pointSize: 3.0, simplifiedShading: true },
      ],
      enableFrustumCulling: true,
      enableOcclusionCulling: false, // More complex, disabled by default
      memoryThreshold: 512, // 512MB
      enableAdaptiveQuality: true,
      ...config,
    }
  }

  /**
   * Process a point cloud into optimized chunks
   */
  public processPointCloud(pointCloud: PointCloudData): void {
    
    const chunkSize = Math.ceil(Math.sqrt(pointCloud.positions.length / 3))
    const chunks = this.createChunks(pointCloud, chunkSize)
    
    // Clear existing chunks
    this.clearChunks()
    
    // Process each chunk
    chunks.forEach((chunk, index) => {
      const chunkId = `chunk_${index}`
      const processedChunk = this.createChunkedPointCloud(chunkId, chunk)
      this.chunks.set(chunkId, processedChunk)
    })
    
  }

  /**
   * Create spatial chunks from point cloud data
   */
  private createChunks(pointCloud: PointCloudData, chunkSize: number): Array<{
    points: Float32Array
    colors?: Float32Array
    boundingBox: THREE.Box3
  }> {
    const chunks: Array<{
      points: Float32Array
      colors?: Float32Array
      boundingBox: THREE.Box3
    }> = []
    
    // Calculate bounding box of entire point cloud
    const globalBounds = new THREE.Box3()
    for (let i = 0; i < pointCloud.positions.length; i += 3) {
      globalBounds.expandByPoint(new THREE.Vector3(
        pointCloud.positions[i],
        pointCloud.positions[i + 1],
        pointCloud.positions[i + 2],
      ))
    }
    
    // Create grid-based chunks
    const size = globalBounds.getSize(new THREE.Vector3())
    const gridX = Math.ceil(size.x / chunkSize)
    const gridY = Math.ceil(size.y / chunkSize)
    const gridZ = Math.ceil(size.z / chunkSize)
    
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        for (let z = 0; z < gridZ; z++) {
          const chunkBounds = new THREE.Box3(
            new THREE.Vector3(
              globalBounds.min.x + (x * chunkSize),
              globalBounds.min.y + (y * chunkSize),
              globalBounds.min.z + (z * chunkSize),
            ),
            new THREE.Vector3(
              globalBounds.min.x + ((x + 1) * chunkSize),
              globalBounds.min.y + ((y + 1) * chunkSize),
              globalBounds.min.z + ((z + 1) * chunkSize),
            ),
          )
          
          const chunkPoints: number[] = []
          const chunkColors: number[] = []
          
          // Collect points within this chunk
          for (let i = 0; i < pointCloud.positions.length; i += 3) {
            const point = new THREE.Vector3(
              pointCloud.positions[i],
              pointCloud.positions[i + 1],
              pointCloud.positions[i + 2],
            )
            
            if (chunkBounds.containsPoint(point)) {
              chunkPoints.push(
                pointCloud.positions[i] ?? 0,
                pointCloud.positions[i + 1] ?? 0,
                pointCloud.positions[i + 2] ?? 0,
              )
              if (pointCloud.colors) {
                chunkColors.push(
                  pointCloud.colors[i] ?? 0,
                  pointCloud.colors[i + 1] ?? 0,
                  pointCloud.colors[i + 2] ?? 0,
                )
              }
            }
          }
          
          if (chunkPoints.length > 0) {
            chunks.push({
              points: new Float32Array(chunkPoints),
              ...(chunkColors.length > 0 ? { colors: new Float32Array(chunkColors) } : {}),
              boundingBox: chunkBounds,
            })
          }
        }
      }
    }
    
    return chunks
  }

  /**
   * Create a chunked point cloud with LOD versions
   */
  private createChunkedPointCloud(id: string, chunkData: {
    points: Float32Array
    colors?: Float32Array
    boundingBox: THREE.Box3
  }): ChunkedPointCloud {
    const chunk: ChunkedPointCloud = {
      id,
      boundingBox: chunkData.boundingBox,
      points: chunkData.points,
      ...(chunkData.colors !== undefined ? { colors: chunkData.colors } : {}),
      lodVersions: new Map(),
      isVisible: false,
      lastRendered: 0,
    }
    
    // Generate LOD versions
    this.config.lodLevels.forEach((lodLevel, index) => {
      const decimatedData = this.decimatePoints(chunkData.points, chunkData.colors, lodLevel.decimation)
      chunk.lodVersions.set(index, decimatedData)
    })
    
    return chunk
  }

  /**
   * Decimate points for LOD
   */
  private decimatePoints(
    points: Float32Array,
    colors: Float32Array | undefined,
    decimation: number,
  ): { points: Float32Array; colors?: Float32Array } {
    if (decimation >= 1.0) {
      return { points, ...(colors !== undefined ? { colors } : {}) }
    }

    const stride = Math.max(1, Math.round(1 / decimation))
    const decimatedPoints: number[] = []
    const decimatedColors: number[] = []

    for (let i = 0; i < points.length; i += 3 * stride) {
      if (i + 2 < points.length) {
        decimatedPoints.push(points[i] ?? 0, points[i + 1] ?? 0, points[i + 2] ?? 0)

        if (colors && i + 2 < colors.length) {
          decimatedColors.push(colors[i] ?? 0, colors[i + 1] ?? 0, colors[i + 2] ?? 0)
        }
      }
    }

    return {
      points: new Float32Array(decimatedPoints),
      ...(decimatedColors.length > 0 ? { colors: new Float32Array(decimatedColors) } : {}),
    }
  }

  /**
   * Update rendering for current frame
   */
  public update(): void {
    const currentTime = performance.now()
    
    // Update performance metrics
    this.updatePerformanceMetrics(currentTime)
    
    // Update frustum for culling
    if (this.config.enableFrustumCulling) {
      this.updateFrustum()
    }
    
    // Determine visible chunks and appropriate LOD levels
    this.updateChunkVisibility()
    
    // Adaptive quality adjustment
    if (this.config.enableAdaptiveQuality) {
      this.updateAdaptiveQuality()
    }
    
    // Update memory usage
    this.updateMemoryUsage()
    
    this.lastFrameTime = currentTime
    this.frameCount++
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(currentTime: number): void {
    if (this.lastFrameTime > 0) {
      const deltaTime = currentTime - this.lastFrameTime
      const currentFPS = 1000 / deltaTime
      
      // Smooth FPS calculation
      this.averageFPS = this.averageFPS * 0.9 + currentFPS * 0.1
    }
  }

  /**
   * Update frustum for culling calculations
   */
  private updateFrustum(): void {
    this.cameraMatrix.multiplyMatrices(
      (this.camera as THREE.PerspectiveCamera).projectionMatrix,
      (this.camera as THREE.PerspectiveCamera).matrixWorldInverse,
    )
    this.frustum.setFromProjectionMatrix(this.cameraMatrix)
  }

  /**
   * Update chunk visibility and LOD levels
   */
  private updateChunkVisibility(): void {
    const cameraPosition = this.camera.position
    let totalPointsToRender = 0
    
    this.chunks.forEach((chunk) => {
      // Check if chunk is in frustum
      const isInFrustum = !this.config.enableFrustumCulling || 
                         this.frustum.intersectsBox(chunk.boundingBox)
      
      if (!isInFrustum) {
        this.hideChunk(chunk)
        return
      }
      
      // Calculate distance to chunk
      const chunkCenter = chunk.boundingBox.getCenter(new THREE.Vector3())
      const distance = cameraPosition.distanceTo(chunkCenter)
      
      // Determine appropriate LOD level
      const lodLevel = this.determineLODLevel(distance)
      const lodData = chunk.lodVersions.get(lodLevel)
      
      if (lodData && totalPointsToRender + (lodData.points.length / 3) <= this.config.maxRenderPoints) {
        this.showChunk(chunk, lodLevel)
        totalPointsToRender += lodData.points.length / 3
      } else {
        this.hideChunk(chunk)
      }
    })
    
    this.renderedPointCount = totalPointsToRender
  }

  /**
   * Determine appropriate LOD level based on distance
   */
  private determineLODLevel(distance: number): number {
    for (let i = 0; i < this.config.lodLevels.length; i++) {
      if (distance <= (this.config.lodLevels[i]?.distance ?? Infinity)) {
        return i
      }
    }
    return this.config.lodLevels.length - 1
  }

  /**
   * Show a chunk with specified LOD level
   */
  private showChunk(chunk: ChunkedPointCloud, lodLevel: number): void {
    const lodData = chunk.lodVersions.get(lodLevel)
    const lodConfig = this.config.lodLevels[lodLevel]
    
    if (!lodData || !lodConfig) return
    
    // Create or update geometry
    if (!chunk.geometry) {
      chunk.geometry = new THREE.BufferGeometry()
      chunk.material = new THREE.PointsMaterial({
        size: lodConfig.pointSize * this.currentQuality,
        sizeAttenuation: true,
        vertexColors: !!lodData.colors,
      })
      chunk.pointsObject = new THREE.Points(chunk.geometry, chunk.material)
      this.scene.add(chunk.pointsObject)
    }
    
    // Update geometry data
    chunk.geometry.setAttribute('position', new THREE.BufferAttribute(lodData.points, 3))
    
    if (lodData.colors) {
      chunk.geometry.setAttribute('color', new THREE.BufferAttribute(lodData.colors, 3))
    }
    
    // Update material properties
    if (chunk.material) {
      chunk.material.size = lodConfig.pointSize * this.currentQuality
      chunk.material.needsUpdate = true
    }
    
    // Show the chunk
    if (chunk.pointsObject) {
      chunk.pointsObject.visible = true
    }
    
    chunk.isVisible = true
    chunk.lastRendered = this.frameCount
  }

  /**
   * Hide a chunk
   */
  private hideChunk(chunk: ChunkedPointCloud): void {
    if (chunk.pointsObject) {
      chunk.pointsObject.visible = false
    }
    chunk.isVisible = false
  }

  /**
   * Update adaptive quality based on performance
   */
  private updateAdaptiveQuality(): void {
    if (this.qualityAdjustmentCooldown > 0) {
      this.qualityAdjustmentCooldown--
      return
    }
    
    const fpsRatio = this.averageFPS / this.config.targetFPS
    
    if (fpsRatio < 0.8 && this.currentQuality > 0.3) {
      // Reduce quality if FPS is too low
      this.currentQuality = Math.max(0.3, this.currentQuality * 0.9)
      this.qualityAdjustmentCooldown = 60 // Wait 60 frames before next adjustment
    } else if (fpsRatio > 1.1 && this.currentQuality < 1.0) {
      // Increase quality if FPS is good
      this.currentQuality = Math.min(1.0, this.currentQuality * 1.05)
      this.qualityAdjustmentCooldown = 60
    }
  }

  /**
   * Update memory usage estimation
   */
  private updateMemoryUsage(): void {
    let totalMemory = 0
    
    this.chunks.forEach((chunk) => {
      // Estimate memory usage for this chunk
      const pointsMemory = chunk.points.byteLength
      const colorsMemory = chunk.colors ? chunk.colors.byteLength : 0
      
      // Add LOD versions memory
      chunk.lodVersions.forEach((lodData) => {
        totalMemory += lodData.points.byteLength
        if (lodData.colors) {
          totalMemory += lodData.colors.byteLength
        }
      })
      
      totalMemory += pointsMemory + colorsMemory
    })
    
    this.memoryUsage = totalMemory / (1024 * 1024) // Convert to MB
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return {
      fps: Math.round(this.averageFPS),
      frameTime: this.lastFrameTime > 0 ? 1000 / this.averageFPS : 0,
      memoryUsage: Math.round(this.memoryUsage),
      pointCount: this.renderedPointCount,
      visibleChunks: Array.from(this.chunks.values()).filter(c => c.isVisible).length,
      totalChunks: this.chunks.size,
      quality: Math.round(this.currentQuality * 100),
      gpuMemoryUsage: this.estimateGPUMemoryUsage(),
    }
  }

  /**
   * Estimate GPU memory usage
   */
  private estimateGPUMemoryUsage(): number {
    const info = this.renderer.info
    return info.memory.geometries + info.memory.textures
  }

  /**
   * Clear all chunks and free memory
   */
  public clearChunks(): void {
    this.chunks.forEach((chunk) => {
      if (chunk.pointsObject) {
        this.scene.remove(chunk.pointsObject)
      }
      if (chunk.geometry) {
        chunk.geometry.dispose()
      }
      if (chunk.material) {
        chunk.material.dispose()
      }
    })
    
    this.chunks.clear()
    this.renderedPointCount = 0
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Force garbage collection (if available)
   */
  public forceGarbageCollection(): void {
    // Force garbage collection if available (mainly for development)
    if (window.gc) {
      window.gc()
    }
  }
}

export default PerformanceOptimizer 