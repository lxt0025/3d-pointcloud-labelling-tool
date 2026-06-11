/**
 * Basic Viewport Component
 * 
 * Simple, working Three.js viewport that just works without complexity
 */

import React, { useRef, useEffect, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { PointCloudData, PointCloudIntersection, CubeSelectionState } from '../types/index'
import { selectionManager } from '../utils/selectionManager'
import { labelManager } from '../utils/labelManager'
import { createCubeVisualizer } from '../utils/cubeVisualizer'
import { AxisView } from './AxisSnapping'

/** Parse a CSS hex color (#rrggbb) to normalized [r, g, b] floats */
function hexToRgbNorm(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
}

interface BasicViewportProps {
  pointCloud?: PointCloudData | null
  pointSize?: number
  className?: string
}

export const BasicViewport: React.FC<BasicViewportProps> = ({
  pointCloud,
  pointSize = 0.05,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const controlsRef = useRef<OrbitControls>()
  const pointsRef = useRef<THREE.Points>()
  const cubeVisualizerRef = useRef(createCubeVisualizer())

  const frameId = useRef<number>()
  const isSelectingRef = useRef(false)
  const raycasterRef = useRef(new THREE.Raycaster())
  const originalColorsRef = useRef<Float32Array | null>(null)

  // Mouse mode state
  const [mouseMode, setMouseMode] = useState<'select' | 'navigate'>('select')
  const mouseModeRef = useRef<'select' | 'navigate'>('select')

  // Cube interaction state
  const isDraggingCubeRef = useRef(false)
  const draggedHandleRef = useRef<string | null>(null)
  const dragStartPositionRef = useRef<THREE.Vector3 | null>(null)
  const originalCubeStateRef = useRef<CubeSelectionState | null>(null)

  // Set point cloud for selection manager and listen for selection events
  useEffect(() => {
    selectionManager.setPointCloud(pointCloud || null)
    
    const handleSelectionCreated = () => {
      updateSelectedPointsVisualization()
    }

    // Real-time selection update during brush strokes
    const handleSelectionUpdate = () => {
      updateSelectedPointsVisualization()
    }

    const handlePendingUpdate = () => {
      updateSelectedPointsVisualization()
    }

    // Cube selection event handlers
    const handleCubeStarted = (cubeState: CubeSelectionState) => {
      if (sceneRef.current && cubeVisualizerRef.current) {
        cubeVisualizerRef.current.updateCube(cubeState)
        sceneRef.current.add(cubeVisualizerRef.current.getGroup())
      }
    }

    const handleCubeUpdated = (cubeState: CubeSelectionState) => {
      if (cubeVisualizerRef.current) {
        cubeVisualizerRef.current.updateCube(cubeState)
      }
    }

    const handleCubeEnded = () => {
      if (sceneRef.current && cubeVisualizerRef.current) {
        sceneRef.current.remove(cubeVisualizerRef.current.getGroup())
        cubeVisualizerRef.current.hide()
      }
    }
    
    // Refresh view whenever label visibility/color/assignment changes
    const handleLabelChange = () => updateSelectedPointsVisualization()

    selectionManager.on('selection:created', handleSelectionCreated)
    selectionManager.on('selection:updated', handleSelectionUpdate)
    selectionManager.on('points:assigned', handleSelectionUpdate)
    selectionManager.on('selection:pending', handlePendingUpdate)
    selectionManager.on('selection:confirmed', handleSelectionUpdate)
    selectionManager.on('cube:started', handleCubeStarted)
    selectionManager.on('cube:updated', handleCubeUpdated)
    selectionManager.on('cube:ended', handleCubeEnded)

    labelManager.on('label:updated', handleLabelChange)
    labelManager.on('label:deleted', handleLabelChange)
    labelManager.on('labels:cleared', handleLabelChange)

    return () => {
      selectionManager.off('selection:created', handleSelectionCreated)
      selectionManager.off('selection:updated', handleSelectionUpdate)
      selectionManager.off('points:assigned', handleSelectionUpdate)
      selectionManager.off('selection:pending', handlePendingUpdate)
      selectionManager.off('selection:confirmed', handleSelectionUpdate)
      selectionManager.off('cube:started', handleCubeStarted)
      selectionManager.off('cube:updated', handleCubeUpdated)
      selectionManager.off('cube:ended', handleCubeEnded)
      labelManager.off('label:updated', handleLabelChange)
      labelManager.off('label:deleted', handleLabelChange)
      labelManager.off('labels:cleared', handleLabelChange)
    }
  }, [pointCloud])

  // Update selected points visualization with different colors for different states
  const updateSelectedPointsVisualization = useCallback(() => {
    if (!pointsRef.current || !pointCloud || !originalColorsRef.current) return

    const geometry = pointsRef.current.geometry
    const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute
    if (!colorAttribute) return

    const state = selectionManager.getState()

    // ── 1. Restore original colors ─────────────────────────
    for (let i = 0; i < originalColorsRef.current.length; i++) {
      const c = originalColorsRef.current[i]
      if (c !== undefined) colorAttribute.array[i] = c
    }

    // ── 2. Apply label colors for assigned points ──────────
    const assignments = selectionManager.getAllAssignments()
    if (assignments.size > 0) {
      // Build a label-color cache to avoid repeated lookups
      const labelColorCache = new Map<string, [number, number, number] | null>()
      for (const [pointIndex, labelId] of assignments) {
        let rgb = labelColorCache.get(labelId)
        if (rgb === undefined) {
          const label = labelManager.getLabel(labelId)
          rgb = (label && label.visible && label.color)
            ? hexToRgbNorm(label.color)
            : null
          labelColorCache.set(labelId, rgb)
        }
        if (rgb) {
          const ci = pointIndex * 3
          if (ci + 2 < colorAttribute.array.length) {
            colorAttribute.array[ci]     = rgb[0]
            colorAttribute.array[ci + 1] = rgb[1]
            colorAttribute.array[ci + 2] = rgb[2]
          }
        }
      }
    }

    // ── 3. Pending selections → bright orange ──────────────
    const pendingSelections = new Set<number>()
    state.pendingSelections.forEach(selection => {
      for (let i = 0; i < selection.length; i++) {
        const pi = selection[i]
        if (pi !== undefined) pendingSelections.add(pi)
      }
    })

    for (const pointIndex of pendingSelections) {
      const ci = pointIndex * 3
      if (ci + 2 < colorAttribute.array.length) {
        colorAttribute.array[ci]     = 1.0
        colorAttribute.array[ci + 1] = 0.55
        colorAttribute.array[ci + 2] = 0.0
      }
    }

    // ── 4. Current selection → bright cyan/white ───────────
    const currentSelection = new Set(state.currentSelection || [])
    for (const pointIndex of currentSelection) {
      const ci = pointIndex * 3
      if (ci + 2 < colorAttribute.array.length) {
        colorAttribute.array[ci]     = 0.9
        colorAttribute.array[ci + 1] = 0.95
        colorAttribute.array[ci + 2] = 1.0
      }
    }

    colorAttribute.needsUpdate = true
  }, [pointCloud])

  // Show selection status in viewport
  const [selectionStatus, setSelectionStatus] = useState<string | null>(null)

  useEffect(() => {
    const updateSelectionStatus = () => {
      const state = selectionManager.getState()
      const pendingCount = selectionManager.getPendingSelectionCount()
      
      let status = ''
      
      if (state.currentSelection && state.currentSelection.length > 0) {
        status += `${state.currentSelection.length} points selected`
      }
      
      if (pendingCount.points > 0) {
        if (status) status += ' | '
        status += `${pendingCount.points} pending (${pendingCount.areas} areas)`
      }
      
      setSelectionStatus(status || null)
    }

    // Reduce polling frequency to 250ms to improve performance
    const interval = setInterval(updateSelectionStatus, 250)
    return () => clearInterval(interval)
  }, [])

  // Mouse interaction handlers
  const getMousePosition = useCallback((event: MouseEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    }
  }, [])

  // Get world position from mouse coordinates
  const getWorldPosition = useCallback((mouse: { x: number; y: number }): THREE.Vector3 | null => {
    if (!cameraRef.current) return null
    
    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5)
    vector.unproject(cameraRef.current)
    
    const dir = vector.sub(cameraRef.current.position).normalize()
    const distance = -cameraRef.current.position.z / dir.z
    const worldPos = cameraRef.current.position.clone().add(dir.multiplyScalar(distance))
    
    return worldPos
  }, [])

  const raycastPoints = useCallback((mouse: { x: number; y: number }): PointCloudIntersection | null => {
    if (!cameraRef.current || !pointsRef.current || !pointCloud) return null

    const raycaster = raycasterRef.current
    const mouseVector = new THREE.Vector2(mouse.x, mouse.y)
    raycaster.setFromCamera(mouseVector, cameraRef.current)
    raycaster.params.Points.threshold = 0.1

    const intersects = raycaster.intersectObject(pointsRef.current)
    if (intersects.length > 0) {
      const intersection = intersects[0]
      if (intersection && intersection.index !== undefined && intersection.point) {
        return {
          pointIndex: intersection.index,
          point: intersection.point,
          distance: intersection.distance,
          object: pointsRef.current,
        }
      }
    }
    return null
  }, [pointCloud])

  // Raycast cube handles
  type CubeHandleHit = { handleName: string; point: THREE.Vector3 }
  const raycastCubeHandles = useCallback((mouse: { x: number; y: number }): CubeHandleHit | null => {
    if (!cameraRef.current || !cubeVisualizerRef.current) return null

    const handleMeshes = cubeVisualizerRef.current.getHandleMeshes()
    if (handleMeshes.length === 0) return null

    const raycaster = raycasterRef.current
    const mouseVector = new THREE.Vector2(mouse.x, mouse.y)
    raycaster.setFromCamera(mouseVector, cameraRef.current)

    const intersects = raycaster.intersectObjects(handleMeshes)
    if (intersects.length > 0) {
      const intersection = intersects[0]
      if (intersection && intersection.object && intersection.object.name && intersection.point) {
        return {
          handleName: intersection.object.name,
          point: intersection.point,
        }
      }
    }
    return null
  }, [])

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !pointCloud) return

    // Check if it's left mouse button
    if (event.button !== 0) return

    // If in navigate mode, don't handle point selection
    if (mouseModeRef.current === 'navigate') return

    const mouse = getMousePosition(event, mountRef.current)
    
    // First check for cube handle interaction (higher priority)
    const cubeHandleHit = raycastCubeHandles(mouse)
    if (cubeHandleHit && selectionManager.isCubeSelectionPersistent()) {
      isDraggingCubeRef.current = true
      draggedHandleRef.current = cubeHandleHit.handleName
      dragStartPositionRef.current = cubeHandleHit.point.clone()
      originalCubeStateRef.current = selectionManager.getCubeSelectionData()
      if (controlsRef.current) controlsRef.current.enabled = false
      return
    }
    
    // If no cube handle hit, proceed with normal point cloud selection
    const intersection = raycastPoints(mouse)
    
    if (intersection) {
      isSelectingRef.current = true
      selectionManager.startSelection(intersection.point, intersection)
      
      // Disable controls during selection
      if (controlsRef.current) {
        controlsRef.current.enabled = false
      }
    }
  }, [pointCloud, getMousePosition, raycastPoints, raycastCubeHandles])

  // Throttle cursor updates to reduce lag
  const lastCursorUpdate = useRef<number>(0)
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !pointCloud) return

    const mouse = getMousePosition(event, mountRef.current)
    
    // Handle cube dragging
    if (
      isDraggingCubeRef.current &&
      draggedHandleRef.current &&
      dragStartPositionRef.current &&
      originalCubeStateRef.current
    ) {
      const handleName = draggedHandleRef.current
      const dragStart = dragStartPositionRef.current
      const origState = originalCubeStateRef.current
      const currentWorldPos = getWorldPosition(mouse)
      if (currentWorldPos && cubeVisualizerRef.current) {
        const cubeUpdate = cubeVisualizerRef.current.updateCubeFromHandleDrag(
          handleName,
          dragStart,
          currentWorldPos,
          origState,
        )
        if (cubeUpdate) {
          selectionManager.updateCubeSelection({ ...origState, ...cubeUpdate })
        }
      }
      return
    }
    
    // Handle normal point cloud selection (only in select mode)
    if (isSelectingRef.current && mouseModeRef.current === 'select') {
      const intersection = raycastPoints(mouse)
      
      if (intersection) {
        selectionManager.continueSelection(intersection.point, intersection)
      }
    }
    
    // Throttle cursor feedback to every 100ms to reduce lag
    const now = Date.now()
    if (now - lastCursorUpdate.current > 100) {
      lastCursorUpdate.current = now
      updateCursorFeedback(event)
    }
  }, [pointCloud, getMousePosition, raycastPoints, getWorldPosition])

  const handleMouseUp = useCallback(() => {
    if (isDraggingCubeRef.current) {
      isDraggingCubeRef.current = false
      draggedHandleRef.current = null
      dragStartPositionRef.current = null
      originalCubeStateRef.current = null
      if (controlsRef.current) controlsRef.current.enabled = true
      return
    }
    
    // Handle ending normal selection
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      selectionManager.endSelection()
      
      // Update visualization after selection ends
      updateSelectedPointsVisualization()
      
      // Re-enable controls
      if (controlsRef.current) {
        controlsRef.current.enabled = true
      }
    }
  }, [updateSelectedPointsVisualization])

  // Cursor feedback showing tool size/area
  const [cursorIndicator, setCursorIndicator] = useState<{
    x: number
    y: number
    size: number
    visible: boolean
    tool: string
  } | null>(null)

  const updateCursorFeedback = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current) return

    const rect = mountRef.current.getBoundingClientRect()
    const state = selectionManager.getState()
    
    // Check for cube handle hover first
    const mouse = getMousePosition(event, mountRef.current)
    const cubeHandleHit = raycastCubeHandles(mouse)
    
    if (cubeHandleHit && selectionManager.isCubeSelectionPersistent()) {
      // Show special cursor for cube handles
      mountRef.current.style.cursor = 'grab'
      
      // Highlight the hovered handle
      if (cubeVisualizerRef.current) {
        cubeVisualizerRef.current.highlightHandle(cubeHandleHit.handleName)
      }
      
      // Don't show the normal tool cursor when over cube handles
      setCursorIndicator(null)
      return
    } else {
      // Clear cube handle highlighting when not hovering
      if (cubeVisualizerRef.current) {
        cubeVisualizerRef.current.clearHighlight()
      }
      
      // Set cursor based on mouse mode
      if (mouseModeRef.current === 'navigate') {
        mountRef.current.style.cursor = 'grab'
        setCursorIndicator(null)
        return
      } else {
        mountRef.current.style.cursor = 'none'
      }
    }
    
    // Get tool-specific size for normal tools (only in select mode)
    if (mouseModeRef.current === 'select') {
      let size = 20 // Default size in pixels
      
      switch (state.activeTool) {
        case 'brush': {
          const brushRadius = state.toolConfigs.brush.radius
          const intersection = raycastPoints(mouse)

          if (intersection && intersection.point) {
            const brushCenter = intersection.point
            const radiusPoint = brushCenter.clone()
            radiusPoint.x += brushRadius

            const centerScreen = new THREE.Vector3()
            const radiusScreen = new THREE.Vector3()
            centerScreen.copy(brushCenter)
            radiusScreen.copy(radiusPoint)
            centerScreen.project(cameraRef.current)
            radiusScreen.project(cameraRef.current)

            const canvas = mountRef.current
            const centerPixelX = (centerScreen.x * 0.5 + 0.5) * canvas.clientWidth
            const radiusPixelX = (radiusScreen.x * 0.5 + 0.5) * canvas.clientWidth
            size = Math.abs(radiusPixelX - centerPixelX) * 2
          } else {
            const cameraDistance = cameraRef.current.position.length()
            const fov = cameraRef.current.fov * Math.PI / 180
            const scale = 2 * Math.tan(fov / 2) * cameraDistance
            const pixelsPerWorldUnit = mountRef.current.clientHeight / scale
            size = brushRadius * pixelsPerWorldUnit * 2
          }
          break
        }
        case 'smart':
          size = 30
          break
        case 'polygon':
          size = 10
          break
      }

      setCursorIndicator({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        size: Math.max(10, Math.min(200, size)), // Clamp between 10-200px
        visible: !!pointCloud,
        tool: state.activeTool,
      })
    }
  }, [pointCloud, getMousePosition, raycastPoints, raycastCubeHandles])

  const handleMouseLeave = useCallback(() => {
    setCursorIndicator(null)
    
    // Clear cube handle highlighting
    if (cubeVisualizerRef.current) {
      cubeVisualizerRef.current.clearHighlight()
    }
    
    // Handle ending cube dragging if mouse leaves during drag
    if (isDraggingCubeRef.current) {
      isDraggingCubeRef.current = false
      draggedHandleRef.current = null
      dragStartPositionRef.current = null
      originalCubeStateRef.current = null
      
      // Re-enable controls
      if (controlsRef.current) {
        controlsRef.current.enabled = true
      }
    }
    
    // Also handle mouse up if we were selecting points
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      selectionManager.endSelection()
      
      // Update visualization after selection ends
      updateSelectedPointsVisualization()
      
      // Re-enable controls
      if (controlsRef.current) {
        controlsRef.current.enabled = true
      }
    }
  }, [updateSelectedPointsVisualization])

  // initialise Three.js
  useEffect(() => {
    if (!mountRef.current) return

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.set(5, 5, 5)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    scene.add(directionalLight)

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x444444)
    scene.add(gridHelper)

    // Axes
    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)

    // Add mouse event listeners
    const canvas = renderer.domElement
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    // Add to DOM
    mount.appendChild(canvas)

    // Animation loop
    const animate = () => {
      frameId.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Cleanup
    return () => {
      if (frameId.current) {
        cancelAnimationFrame(frameId.current)
      }
      
      // Remove event listeners
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      
      // Cleanup cube visualizer
      if (cubeVisualizerRef.current) {
        cubeVisualizerRef.current.dispose()
      }
      
      if (mount && canvas.parentNode === mount) {
        mount.removeChild(canvas)
      }
      renderer.dispose()
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave])

  // Separate useEffect for mouse mode change listener
  useEffect(() => {
    const handleMouseModeChange = (event: CustomEvent) => {
      const newMode = event.detail
      setMouseMode(newMode)
      mouseModeRef.current = newMode
    }
    
    window.addEventListener('mouseModeChange', handleMouseModeChange as EventListener)
    
    return () => {
      window.removeEventListener('mouseModeChange', handleMouseModeChange as EventListener)
    }
  }, []) // No dependencies - this should only run once

  // Axis snapping event listener
  useEffect(() => {
    const handleAxisSnap = (event: CustomEvent) => {
      const axis = event.detail as AxisView
      
      if (!cameraRef.current || !controlsRef.current || !sceneRef.current) return
      
      const camera = cameraRef.current
      const controls = controlsRef.current
      
      // Get bounding box of the scene to determine proper distance
      const box = new THREE.Box3().setFromObject(sceneRef.current)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const distance = maxDim * 2 // Proper distance for viewing
      
      // Define camera positions for each axis
      const positions: Record<AxisView, THREE.Vector3> = {
        top: new THREE.Vector3(center.x, center.y + distance, center.z),
        bottom: new THREE.Vector3(center.x, center.y - distance, center.z),
        front: new THREE.Vector3(center.x, center.y, center.z + distance),
        back: new THREE.Vector3(center.x, center.y, center.z - distance),
        left: new THREE.Vector3(center.x - distance, center.y, center.z),
        right: new THREE.Vector3(center.x + distance, center.y, center.z),
        isometric: new THREE.Vector3(
          center.x + distance * 0.7,
          center.y + distance * 0.7,
          center.z + distance * 0.7,
        ),
      }
      
      const position = positions[axis]
      if (position) {
        camera.position.copy(position)
        camera.lookAt(center)
        controls.target.copy(center)
        controls.update()
      }
    }
    
    window.addEventListener('axisSnap', handleAxisSnap as EventListener)
    
    return () => {
      window.removeEventListener('axisSnap', handleAxisSnap as EventListener)
    }
  }, []) // No dependencies - this should only run once

  // Sync ref with state when state changes
  useEffect(() => {
    mouseModeRef.current = mouseMode
  }, [mouseMode])

  // Handle point cloud updates
  useEffect(() => {
    if (!sceneRef.current || !pointCloud) return

    // Remove old points
    if (pointsRef.current) {
      sceneRef.current.remove(pointsRef.current)
      pointsRef.current.geometry.dispose()
      if (pointsRef.current.material instanceof THREE.Material) {
        pointsRef.current.material.dispose()
      }
    }

    // Create new points
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointCloud.positions, 3))
    
    // Ensure we always have colors for selection visualization
    let colors: Float32Array
    if (pointCloud.colors) {
      colors = new Float32Array(pointCloud.colors)
    } else {
      // Generate default green colors if none provided
      const numPoints = pointCloud.positions.length / 3
      colors = new Float32Array(numPoints * 3)
      for (let i = 0; i < numPoints; i++) {
        colors[i * 3] = 0.0     // R
        colors[i * 3 + 1] = 1.0 // G
        colors[i * 3 + 2] = 0.0 // B
      }
    }
    
    // Store original colors for restoration
    originalColorsRef.current = new Float32Array(colors)
    
    // Set colors on geometry
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true, // Always use vertex colors now
    })

    const points = new THREE.Points(geometry, material)
    pointsRef.current = points
    sceneRef.current.add(points)

    // Center camera
    geometry.computeBoundingBox()
    if (geometry.boundingBox && cameraRef.current && controlsRef.current) {
      const box = geometry.boundingBox
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)

      cameraRef.current.position.copy(center)
      cameraRef.current.position.z += maxDim * 2
      cameraRef.current.position.y += maxDim * 0.5
      controlsRef.current.target.copy(center)
      controlsRef.current.update()
    }
  }, [pointCloud])

  // Handle point size changes separately for better performance
  useEffect(() => {
    if (pointsRef.current && pointsRef.current.material instanceof THREE.PointsMaterial) {
      pointsRef.current.material.size = pointSize
      pointsRef.current.material.needsUpdate = true
    }
  }, [pointSize])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return

      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight

      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(width, height)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div 
      ref={mountRef}
      className={`basic-viewport ${className}`}
      style={{ 
        width: '100%', 
        height: '100%', 
        minHeight: '400px',
        background: '#1a1a1a',
        cursor: 'none', // Hide default cursor so we can show our custom one
        position: 'relative',
      }}
    >
      {selectionStatus && (
        <div className="viewport__selection-status">
          {selectionStatus}
        </div>
      )}

      {/* Color Legend */}
      <div className="viewport__color-legend">
        <div className="viewport__legend-item">
          <div className="viewport__legend-color" style={{ backgroundColor: '#e6f2ff' }}></div>
          <span>Drawing</span>
        </div>
        <div className="viewport__legend-item">
          <div className="viewport__legend-color" style={{ backgroundColor: '#ff8c00' }}></div>
          <span>Pending</span>
        </div>
        <div className="viewport__legend-item">
          <div className="viewport__legend-color" style={{ backgroundColor: '#3b82f6', borderRadius: '2px', width: '12px', height: '6px' }}></div>
          <span>Labeled</span>
        </div>
      </div>
      
      {/* Custom cursor indicator - simplified for performance */}
      {cursorIndicator && cursorIndicator.visible && (
        <div
          style={{
            position: 'absolute',
            left: cursorIndicator.x - cursorIndicator.size / 2,
            top: cursorIndicator.y - cursorIndicator.size / 2,
            width: cursorIndicator.size,
            height: cursorIndicator.size,
            border: `1px solid ${
              cursorIndicator.tool === 'brush' ? '#3b82f6' :
                cursorIndicator.tool === 'smart' ? '#10b981' :
                  '#f59e0b'
            }`,
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 1000,
            opacity: 0.6,
          }}
        />
      )}
    </div>
  )
}

export default BasicViewport 