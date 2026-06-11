/**
 * Viewport Component
 * 
 * This component provides the 3D viewport for point cloud visualization and interaction.
 * It handles WebGL rendering, camera controls, and selection tool interactions.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { PointCloudData, PointCloudIntersection, CameraState } from '../types/index'
import { selectionManager } from '../utils/selectionManager'

export interface ViewportProps {
  /** Point cloud data to display */
  pointCloud?: PointCloudData | null
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean
  /** Enable debug mode */
  enableDebug?: boolean
  /** Callback for point hover events */
  onPointHover?: (intersection: PointCloudIntersection | null) => void
  /** Callback for point click events */
  onPointClick?: (intersection: PointCloudIntersection | null) => void
  /** Callback for camera state changes */
  onCameraChange?: (cameraState: CameraState) => void
  /** Callback for performance updates */
  onPerformanceUpdate?: (metrics: ViewportPerformanceMetrics) => void
  /** Callback for errors */
  onError?: (error: Error) => void
  /** CSS class name */
  className?: string
  /** Whether viewport is enabled for interaction */
  enabled?: boolean
}

export interface ViewportPerformanceMetrics {
  fps: number
  drawCalls: number
  triangles: number
  points: number
  memoryUsage: {
    geometries: number
    textures: number
  }
}

export const Viewport: React.FC<ViewportProps> = ({
  pointCloud,
  enablePerformanceMonitoring = true,
  enableDebug = false,
  onPointHover,
  onPointClick,
  onCameraChange: _onCameraChange,
  onPerformanceUpdate,
  onError,
  className = '',
  enabled = true,
}) => {
  // Refs for Three.js objects
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef<THREE.Raycaster | null>(null)
  const pointCloudMeshRef = useRef<THREE.Points | null>(null)
  const animationIdRef = useRef<number | null>(null)

  // State
  const [isinitialised, setIsinitialised] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<ViewportPerformanceMetrics>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    points: 0,
    memoryUsage: { geometries: 0, textures: 0 },
  })

  // Selection state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStarted, setSelectionStarted] = useState(false)

  // initialise Three.js scene
  const initialiseScene = useCallback(() => {
    if (!containerRef.current || isinitialised) return false

    try {

      // Create scene
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1a1a1a)
      sceneRef.current = scene

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000,
      )
      camera.position.set(5, 5, 5)
      cameraRef.current = camera

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = false // Disable for performance
      rendererRef.current = renderer

      // Create controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.enableZoom = true
      controls.enablePan = true
      controls.enableRotate = true
      controlsRef.current = controls

      // Create raycaster for selection
      const raycaster = new THREE.Raycaster()
      raycaster.params.Points.threshold = 0.05
      raycasterRef.current = raycaster

      // Add lights
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(10, 10, 5)
      scene.add(directionalLight)

      // Add grid and axes
      const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x444444)
      scene.add(gridHelper)

      const axesHelper = new THREE.AxesHelper(5)
      scene.add(axesHelper)

      // Append to container
      containerRef.current.appendChild(renderer.domElement)

      // Start render loop directly to avoid dependency issues
      let frameCount = 0
      let lastFpsUpdate = performance.now()

      const animate = () => {
        const currentTime = performance.now()
        frameCount++

        // Update FPS every second (but don't call setState in render loop)
        if (currentTime - lastFpsUpdate >= 1000) {
          const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate))
          
          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            setPerformanceMetrics(prev => ({
              ...prev,
              fps,
              drawCalls: 0, // TODO: Fix Three.js info types
              triangles: 0,
              points: 0,
              memoryUsage: {
                geometries: 0,
                textures: 0,
              },
            }))
          }, 0)
          
          frameCount = 0
          lastFpsUpdate = currentTime
        }

        // Update controls
        if (controlsRef.current) {
          controlsRef.current.update()
        }

        // Render
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current)
        }

        animationIdRef.current = requestAnimationFrame(animate)
      }

      animate()

      return true
    } catch (error) {
      console.error('Failed to initialise Three.js scene:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(`3D initialisation failed: ${message}`)
      if (onError) {
        onError(new Error(message))
      }
      return false
    }
  }, [isinitialised])

  // Handle window resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    cameraRef.current.aspect = width / height
    cameraRef.current.updateProjectionMatrix()
    rendererRef.current.setSize(width, height)
  }, [])

  // Update point cloud visualization
  const updatePointCloud = useCallback((newPointCloud: PointCloudData | null) => {
    if (!sceneRef.current || !isinitialised) return

    // Remove existing point cloud
    if (pointCloudMeshRef.current) {
      sceneRef.current.remove(pointCloudMeshRef.current)
      pointCloudMeshRef.current.geometry.dispose()
      if (pointCloudMeshRef.current.material instanceof THREE.Material) {
        pointCloudMeshRef.current.material.dispose()
      }
      pointCloudMeshRef.current = null
    }

    if (!newPointCloud) {
      return
    }

    try {

      // Create geometry
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPointCloud.positions, 3))
      
      if (newPointCloud.colors) {
        // Convert colors from 0-255 to 0-1 range if needed
        const colors = new Float32Array(newPointCloud.colors.length)
        for (let i = 0; i < newPointCloud.colors.length; i++) {
          const c = newPointCloud.colors[i] ?? 0
          colors[i] = c > 1 ? c / 255 : c
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      }

      // Create material
      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: newPointCloud.colors ? true : false,
        color: newPointCloud.colors ? undefined : 0x00ff00,
        sizeAttenuation: true,
      })

      // Create mesh
      const points = new THREE.Points(geometry, material)
      pointCloudMeshRef.current = points
      sceneRef.current.add(points)

      // Center camera on point cloud
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)

      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(center)
        cameraRef.current.position.z += maxDim * 2
        cameraRef.current.position.y += maxDim * 0.5
        controlsRef.current.target.copy(center)
        controlsRef.current.update()
      }

      // Update selection manager
      selectionManager.setPointCloud(newPointCloud)

    } catch (error) {
      console.error('Failed to create point cloud visualization:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(`Point cloud rendering failed: ${message}`)
      if (onError) {
        onError(new Error(message))
      }
    }
  }, [isinitialised])

  // Handle mouse events for selection
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!enabled || !raycasterRef.current || !cameraRef.current || !pointCloudMeshRef.current) return

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )

    raycasterRef.current.setFromCamera(mouse, cameraRef.current)
    const intersects = raycasterRef.current.intersectObject(pointCloudMeshRef.current)

    if (intersects.length > 0) {
      const intersection = intersects[0]
      if (!intersection) return
      
      const point = intersection.point
      const pointIndex = intersection.index || 0
      
      const pointCloudIntersection: PointCloudIntersection = {
        point,
        pointIndex,
        distance: intersection.distance,
        object: pointCloudMeshRef.current,
      }

      setSelectionStarted(true)
      setIsSelecting(true)
      selectionManager.startSelection(point, pointCloudIntersection)
      
      // Call click handler
      onPointClick?.(pointCloudIntersection)
    }
  }, [enabled, onPointClick])

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!enabled || !raycasterRef.current || !cameraRef.current || !pointCloudMeshRef.current) return

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )

    raycasterRef.current.setFromCamera(mouse, cameraRef.current)
    const intersects = raycasterRef.current.intersectObject(pointCloudMeshRef.current)

    if (intersects.length > 0) {
      const intersection = intersects[0]
      if (!intersection) return
      
      const point = intersection.point
      const pointIndex = intersection.index || 0
      
      const pointCloudIntersection: PointCloudIntersection = {
        point,
        pointIndex,
        distance: intersection.distance,
        object: pointCloudMeshRef.current,
      }

      // Handle hover
      onPointHover?.(pointCloudIntersection)

      // Continue selection if started
      if (selectionStarted && isSelecting) {
        selectionManager.continueSelection(point, pointCloudIntersection)
      }
    } else {
      onPointHover?.(null)
    }
  }, [enabled, selectionStarted, isSelecting, onPointHover])

  const handleMouseUp = useCallback(() => {
    if (!enabled || !selectionStarted) return

    setSelectionStarted(false)
    setIsSelecting(false)
    selectionManager.endSelection()
  }, [enabled, selectionStarted])

  // initialise scene on mount
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    // Only initialise once
    if (!isinitialised && containerRef.current) {
      
      timeoutId = setTimeout(() => {
        const success = initialiseScene()
        if (success) {
          setIsinitialised(true)
          setError(null)
        }
      }, 100)
    }

    // Handle resize
    window.addEventListener('resize', handleResize)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      
      // Cleanup
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      
      if (rendererRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement)
        } catch (e) {
          // Element might already be removed
        }
        rendererRef.current.dispose()
      }
      
      // Dispose geometries and materials
      if (pointCloudMeshRef.current) {
        pointCloudMeshRef.current.geometry.dispose()
        if (pointCloudMeshRef.current.material instanceof THREE.Material) {
          pointCloudMeshRef.current.material.dispose()
        }
      }
    }
  }, [])

  // Update point cloud when data changes
  useEffect(() => {
    if (isinitialised && pointCloud !== undefined) {
      updatePointCloud(pointCloud)
    }
  }, [pointCloud, isinitialised, updatePointCloud])

  // Subscribe to selection events
  useEffect(() => {
    const handleSelectionUpdate = () => {
    }

    selectionManager.on('selection:created', handleSelectionUpdate)
    selectionManager.on('points:assigned', handleSelectionUpdate)

    return () => {
      selectionManager.off('selection:created', handleSelectionUpdate)
      selectionManager.off('points:assigned', handleSelectionUpdate)
    }
  }, [])

  // Report performance metrics (stable)
  useEffect(() => {
    if (onPerformanceUpdate && enablePerformanceMonitoring) {
      onPerformanceUpdate(performanceMetrics)
    }
  }, [performanceMetrics])

  // Utility functions for viewport controls
  const fitCameraToPointCloud = useCallback(() => {
    if (!pointCloudMeshRef.current || !cameraRef.current || !controlsRef.current) return

    const geometry = pointCloudMeshRef.current.geometry
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    cameraRef.current.position.copy(center)
    cameraRef.current.position.z += maxDim * 2
    cameraRef.current.position.y += maxDim * 0.5
    controlsRef.current.target.copy(center)
    controlsRef.current.update()
  }, [])

  const toggleGrid = useCallback(() => {
    if (!sceneRef.current) return
    
    const grid = sceneRef.current.getObjectByName('grid')
    if (grid) {
      grid.visible = !grid.visible
    }
  }, [])

  const toggleAxes = useCallback(() => {
    if (!sceneRef.current) return
    
    const axes = sceneRef.current.getObjectByName('axes')
    if (axes) {
      axes.visible = !axes.visible
    }
  }, [])

  if (error) {
    return (
      <div className={`viewport error ${className}`}>
        <div className="viewport__error">
          <h3>Viewport Error</h3>
          <p>{error}</p>
          <button onClick={() => {
            setError(null)
            setIsinitialised(false)
            setTimeout(() => initialiseScene(), 100)
          }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!isinitialised) {
    return (
      <div className={`viewport loading ${className}`}>
        <div className="viewport__loading">
          <div className="viewport__loading-spinner"></div>
          <p>initialising 3D viewport...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`viewport ${className} ${enabled ? 'enabled' : 'disabled'}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {/* Performance Debug Overlay */}
      {enableDebug && (
        <div className="viewport__debug">
          <div className="viewport__debug-metric">
            <span className="label">FPS:</span>
            <span className="value">{performanceMetrics.fps}</span>
          </div>
          <div className="viewport__debug-metric">
            <span className="label">Points:</span>
            <span className="value">{performanceMetrics.points.toLocaleString()}</span>
          </div>
          <div className="viewport__debug-metric">
            <span className="label">Memory:</span>
            <span className="value">{performanceMetrics.memoryUsage.geometries}MB</span>
          </div>
        </div>
      )}

      {/* Viewport Controls */}
      <div className="viewport__controls">
        <button
          className="viewport__control-button"
          onClick={toggleGrid}
          title="Toggle Grid"
        >
          Grid
        </button>
        <button
          className="viewport__control-button"
          onClick={toggleAxes}
          title="Toggle Axes"
        >
          Axes
        </button>
        <button
          className="viewport__control-button"
          onClick={fitCameraToPointCloud}
          title="Fit to View"
          disabled={!pointCloud}
        >
          Fit
        </button>
      </div>

      {/* Selection Status */}
      {isSelecting && (
        <div className="viewport__selection-status">
          <span>Selecting points...</span>
        </div>
      )}
    </div>
  )
}

export default Viewport 