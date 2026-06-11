/**
 * Three.js Engine for Point Cloud Labelling Tool
 * 
 * This class manages the core Three.js infrastructure including:
 * - WebGL renderer setup and configuration
 * - Scene management and organization
 * - Camera controls and navigation
 * - Performance monitoring and optimization
 * - Point cloud rendering pipeline
 * - Event handling for interactions
 * 
 * The engine serves as the central hub for all 3D operations and provides
 * a clean interface for React components to interact with the 3D scene.
 */

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  GridHelper,
  AxesHelper,
  DirectionalLight,
  AmbientLight,
  Color,
  Vector3,
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Raycaster,
  Vector2,
} from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { 
  PointCloudData, 
  CameraState, 
  RenderingSettings,
  PerformanceMetrics,
  PointCloudIntersection, 
} from '../types/index'
import {
  CAMERA_CONFIG,
  RENDERING_LIMITS,
  POINT_CLOUD_COLORS,
} from '../utils/constants'

/**
 * Three.js Engine Configuration
 */
export interface ThreeEngineConfig {
  /** Target DOM element for rendering */
  container: HTMLElement
  /** Initial rendering settings */
  renderingSettings: RenderingSettings
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean
  /** Enable debugging features */
  enableDebug: boolean
}

/**
 * Engine Event Types
 */
export interface ThreeEngineEvents {
  'ready': void
  'resize': { width: number; height: number }
  'camera-change': CameraState
  'performance-update': PerformanceMetrics
  'point-hover': PointCloudIntersection | null
  'point-click': PointCloudIntersection | null
  'render-start': void
  'render-end': number // render time in ms
  'error': Error
}

/**
 * Main Three.js Engine Class
 */
export class ThreeEngine {
  // Core Three.js components
  private renderer!: WebGLRenderer
  private scene!: Scene
  private camera!: PerspectiveCamera
  private controls!: OrbitControls
  private raycaster!: Raycaster

  // Lighting
  private directionalLight!: DirectionalLight
  private ambientLight!: AmbientLight

  // Scene helpers
  private gridHelper!: GridHelper
  private axesHelper!: AxesHelper

  // Point clouds
  private pointClouds: Map<string, Points> = new Map()
  private activePointCloud: Points | null = null

  // State management
  private config: ThreeEngineConfig
  private isInitialized = false
  private isRendering = false
  private needsResize = false
  private lastFrameTime = 0
  private frameCount = 0

  // Event handling
  // eslint-disable-next-line @typescript-eslint/ban-types
  private eventListeners: Map<keyof ThreeEngineEvents, Set<Function>> = new Map()
  private mouse = new Vector2()
  private hoveredObject: Points | null = null

  // Performance monitoring
  private performanceMetrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    pointCount: 0,
    renderTime: 0,
    selectionTime: 0,
    lastUpdated: new Date(),
  }

  constructor(config: ThreeEngineConfig) {
    this.config = config
    
    // Use setTimeout to make initialization non-blocking
    setTimeout(() => {
      try {
        this.initializeEngine()
      } catch (error) {
        console.error('Constructor initialization error:', error)
        this.emit('error', error as Error)
      }
    }, 10)
  }

  /**
   * Initialize the Three.js engine
   */
  private initializeEngine(): void {
    try {
      
      this.initializeRenderer()
      
      this.initializeScene()
      
      this.initializeCamera()
      
      this.initializeLighting()
      
      this.initializeHelpers()
      
      this.initializeControls()
      
      this.initializeRaycaster()
      
      this.initializeEventListeners()
      
      this.isInitialized = true
      
      this.emit('ready')
      
      // Use setTimeout to ensure the ready event is processed first
      setTimeout(() => {
        this.startRenderLoop()
      }, 100)
      
      
    } catch (error) {
      console.error('Failed to initialize Three.js engine:', error)
      this.emit('error', error as Error)
    }
  }

  /**
   * Initialize WebGL renderer
   */
  private initializeRenderer(): void {
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    })

    // Configure renderer
    this.renderer.setSize(
      this.config.container.clientWidth,
      this.config.container.clientHeight,
    )
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(new Color(this.config.renderingSettings.backgroundColor))
    this.renderer.shadowMap.enabled = false // Disabled for point clouds
    this.renderer.sortObjects = false // Optimize for point clouds
    
    // Optimize for point cloud rendering
    this.renderer.capabilities.logarithmicDepthBuffer = true
    
    // Append to container
    this.config.container.appendChild(this.renderer.domElement)
  }

  /**
   * Initialize scene
   */
  private initializeScene(): void {
    this.scene = new Scene()
    this.scene.background = new Color(this.config.renderingSettings.backgroundColor)
  }

  /**
   * Initialize camera
   */
  private initializeCamera(): void {
    const aspect = this.config.container.clientWidth / this.config.container.clientHeight
    
    this.camera = new PerspectiveCamera(
      75, // FOV
      aspect,
      RENDERING_LIMITS.nearPlane,
      RENDERING_LIMITS.farPlane,
    )

    // Set initial camera position
    this.camera.position.copy(CAMERA_CONFIG.defaultPosition)
    this.camera.lookAt(CAMERA_CONFIG.defaultTarget)
  }

  /**
   * Initialize lighting
   */
  private initializeLighting(): void {
    // Directional light for depth perception
    this.directionalLight = new DirectionalLight(0xffffff, 1.0)
    this.directionalLight.position.set(50, 50, 50)
    this.scene.add(this.directionalLight)

    // Ambient light for general illumination
    this.ambientLight = new AmbientLight(0x404040, 0.5)
    this.scene.add(this.ambientLight)
  }

  /**
   * Initialize scene helpers
   */
  private initializeHelpers(): void {
    // Grid helper
    this.gridHelper = new GridHelper(100, 50, POINT_CLOUD_COLORS.grid, POINT_CLOUD_COLORS.grid)
    this.gridHelper.visible = this.config.renderingSettings.showGrid
    this.scene.add(this.gridHelper)

    // Axes helper
    this.axesHelper = new AxesHelper(10)
    this.axesHelper.visible = this.config.renderingSettings.showAxes
    this.scene.add(this.axesHelper)
  }

  /**
   * Initialize camera controls
   */
  private initializeControls(): void {
    try {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      
      // Configure controls
      this.controls.enableDamping = CAMERA_CONFIG.enableDamping
      this.controls.dampingFactor = CAMERA_CONFIG.dampingFactor
      this.controls.enableZoom = CAMERA_CONFIG.enableZoom
      this.controls.zoomSpeed = CAMERA_CONFIG.zoomSpeed
      this.controls.enableRotate = CAMERA_CONFIG.enableRotate
      this.controls.rotateSpeed = CAMERA_CONFIG.rotateSpeed
      this.controls.enablePan = CAMERA_CONFIG.enablePan
      this.controls.panSpeed = CAMERA_CONFIG.panSpeed
      this.controls.keyPanSpeed = CAMERA_CONFIG.keyPanSpeed
      
      // Set distance limits
      this.controls.minDistance = CAMERA_CONFIG.minDistance
      this.controls.maxDistance = CAMERA_CONFIG.maxDistance
      
      // Set angle limits
      this.controls.minPolarAngle = CAMERA_CONFIG.minPolarAngle
      this.controls.maxPolarAngle = CAMERA_CONFIG.maxPolarAngle
      
      // Target point
      this.controls.target.copy(CAMERA_CONFIG.defaultTarget)

      // Listen for control changes
      this.controls.addEventListener('change', () => {
        if (!this.isRendering) {
          this.render()
        }
        this.emitCameraChange()
      })
      
    } catch (error) {
      console.error('Failed to initialize controls:', error)
      throw error
    }
  }

  /**
   * Initialize raycaster for point selection
   */
  private initializeRaycaster(): void {
    this.raycaster = new Raycaster()
    this.raycaster.params.Points = {
      threshold: 0.5,
    }
  }

  /**
   * Initialize DOM event listeners
   */
  private initializeEventListeners(): void {
    // Window resize
    window.addEventListener('resize', this.handleResize.bind(this), false)
    
    // Mouse events for point selection
    this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove.bind(this), false)
    this.renderer.domElement.addEventListener('click', this.handleMouseClick.bind(this), false)
    
    // Prevent context menu
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault(), false)
  }

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    const animate = () => {
      if (!this.isInitialized) return

      requestAnimationFrame(animate)
      
      const startTime = performance.now()
      
      // Update controls
      this.controls.update()
      
      // Handle resize
      if (this.needsResize) {
        this.resize()
        this.needsResize = false
      }
      
      // Render scene
      this.render()
      
      // Update performance metrics
      if (this.config.enablePerformanceMonitoring) {
        this.updatePerformanceMetrics(performance.now() - startTime)
      }
    }
    
    animate()
  }

  /**
   * Render the scene
   */
  private render(): void {
    if (!this.isInitialized) return
    
    this.emit('render-start')
    
    const startTime = performance.now()
    this.renderer.render(this.scene, this.camera)
    const renderTime = performance.now() - startTime
    
    this.emit('render-end', renderTime)
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    this.needsResize = true
  }

  /**
   * Resize renderer and camera
   */
  private resize(): void {
    const width = this.config.container.clientWidth
    const height = this.config.container.clientHeight
    
    // Update camera
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    
    // Update renderer
    this.renderer.setSize(width, height)
    
    this.emit('resize', { width, height })
  }

  /**
   * Handle mouse movement for point hover
   */
  private handleMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    this.checkPointHover()
  }

  /**
   * Handle mouse click for point selection
   */
  private handleMouseClick(_event: MouseEvent): void {
    const intersection = this.getPointIntersection()
    this.emit('point-click', intersection)
  }

  /**
   * Check for point hover
   */
  private checkPointHover(): void {
    const intersection = this.getPointIntersection()
    
    if (intersection && intersection.object !== this.hoveredObject) {
      this.hoveredObject = intersection.object
      this.emit('point-hover', intersection)
    } else if (!intersection && this.hoveredObject) {
      this.hoveredObject = null
      this.emit('point-hover', null)
    }
  }

  /**
   * Get point intersection from mouse position
   */
  private getPointIntersection(): PointCloudIntersection | null {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    
    const pointClouds = Array.from(this.pointClouds.values())
    const intersects = this.raycaster.intersectObjects(pointClouds)
    
    if (intersects.length > 0) {
      const intersect = intersects[0]
      if (intersect && intersect.point && intersect.object) {
        return {
          distance: intersect.distance,
          pointIndex: intersect.index || 0,
          point: intersect.point,
          object: intersect.object as Points,
        }
      }
    }
    
    return null
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(renderTime: number): void {
    this.frameCount++
    this.lastFrameTime = renderTime
    
    // Update FPS every second
    const now = Date.now()
    const lastUpdated = this.performanceMetrics.lastUpdated?.getTime() ?? 0
    if (now - lastUpdated >= 1000) {
      this.performanceMetrics.fps = this.frameCount
      this.performanceMetrics.renderTime = this.lastFrameTime
      this.performanceMetrics.lastUpdated = new Date(now)
      
      const perf = performance as unknown as { memory?: { usedJSHeapSize: number } }
      if (perf.memory) {
        this.performanceMetrics.memoryUsage = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024)
      }
      
      this.frameCount = 0
      this.emit('performance-update', { ...this.performanceMetrics })
    }
  }

  /**
   * Emit camera change event
   */
  private emitCameraChange(): void {
    const cameraState: CameraState = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      zoom: this.camera.zoom,
      controls: {
        azimuthAngle: this.controls.getAzimuthalAngle(),
        polarAngle: this.controls.getPolarAngle(),
        distance: this.controls.getDistance(),
      },
    }
    
    this.emit('camera-change', cameraState)
  }

  /**
   * Add a point cloud to the scene
   */
  public addPointCloud(id: string, pointCloudData: PointCloudData): Points {
    // Create geometry
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(pointCloudData.positions, 3))
    
    if (pointCloudData.colors) {
      geometry.setAttribute('color', new BufferAttribute(pointCloudData.colors, 3))
    }
    
    // Create material
    const material = new PointsMaterial({
      size: this.config.renderingSettings.pointSize,
      sizeAttenuation: this.config.renderingSettings.sizeAttenuation,
      vertexColors: !!pointCloudData.colors,
    })
    
    // Create points object
    const points = new Points(geometry, material)
    points.name = id
    
    // Store reference and add to scene
    this.pointClouds.set(id, points)
    this.scene.add(points)
    
    // Set as active if first point cloud
    if (!this.activePointCloud) {
      this.setActivePointCloud(id)
    }
    
    return points
  }

  /**
   * Remove a point cloud from the scene
   */
  public removePointCloud(id: string): void {
    const pointCloud = this.pointClouds.get(id)
    if (pointCloud) {
      this.scene.remove(pointCloud)
      pointCloud.geometry.dispose()
      if (Array.isArray(pointCloud.material)) {
        pointCloud.material.forEach(mat => mat.dispose())
      } else {
        pointCloud.material.dispose()
      }
      this.pointClouds.delete(id)
      
      if (this.activePointCloud === pointCloud) {
        this.activePointCloud = null
      }
    }
  }

  /**
   * Set active point cloud
   */
  public setActivePointCloud(id: string): void {
    const pointCloud = this.pointClouds.get(id)
    if (pointCloud) {
      this.activePointCloud = pointCloud
      this.fitCameraToPointCloud(pointCloud)
    }
  }

  /**
   * Fit camera to point cloud
   */
  public fitCameraToPointCloud(pointCloud: Points): void {
    pointCloud.geometry.computeBoundingBox()
    const box = pointCloud.geometry.boundingBox
    
    if (box) {
      const center = box.getCenter(new Vector3())
      const size = box.getSize(new Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      
      const distance = maxDim * 2
      
      this.controls.target.copy(center)
      this.camera.position.copy(center).add(new Vector3(distance, distance, distance))
      this.controls.update()
    }
  }

  /**
   * Toggle grid visibility
   */
  public toggleGrid(): void {
    this.gridHelper.visible = !this.gridHelper.visible
  }

  /**
   * Toggle axes visibility
   */
  public toggleAxes(): void {
    this.axesHelper.visible = !this.axesHelper.visible
  }

  /**
   * Update rendering settings
   */
  public updateRenderingSettings(settings: Partial<RenderingSettings>): void {
    Object.assign(this.config.renderingSettings, settings)
    
    // Update renderer background
    if (settings.backgroundColor) {
      this.renderer.setClearColor(new Color(settings.backgroundColor))
      this.scene.background = new Color(settings.backgroundColor)
    }
    
    // Update grid visibility
    if (settings.showGrid !== undefined) {
      this.gridHelper.visible = settings.showGrid
    }
    
    // Update axes visibility
    if (settings.showAxes !== undefined) {
      this.axesHelper.visible = settings.showAxes
    }
    
    // Update point size for all point clouds
    if (settings.pointSize !== undefined) {
      this.pointClouds.forEach(pointCloud => {
        const material = pointCloud.material as PointsMaterial
        material.size = settings.pointSize!
      })
    }
    
    // Update size attenuation
    if (settings.sizeAttenuation !== undefined) {
      this.pointClouds.forEach(pointCloud => {
        const material = pointCloud.material as PointsMaterial
        material.sizeAttenuation = settings.sizeAttenuation!
      })
    }
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * Event emitter methods
   */
  public on<K extends keyof ThreeEngineEvents>(
    event: K,
    listener: (data: ThreeEngineEvents[K]) => void,
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  public off<K extends keyof ThreeEngineEvents>(
    event: K,
    listener: (data: ThreeEngineEvents[K]) => void,
  ): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  private emit<K extends keyof ThreeEngineEvents>(event: K, data?: ThreeEngineEvents[K]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => listener(data))
    }
  }

  /**
   * Cleanup and dispose of resources
   */
  public dispose(): void {
    // Stop render loop
    this.isInitialized = false
    
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize.bind(this))
    
    // Dispose of point clouds
    this.pointClouds.forEach((_pointCloud, id) => {
      this.removePointCloud(id)
    })
    
    // Dispose of scene objects
    this.scene.remove(this.gridHelper, this.axesHelper, this.directionalLight, this.ambientLight)
    
    // Dispose of controls
    this.controls.dispose()
    
    // Dispose of renderer
    this.renderer.dispose()
    
    // Remove canvas from DOM
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
    
    // Clear event listeners
    this.eventListeners.clear()
    
  }
} 