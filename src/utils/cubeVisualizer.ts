/**
 * Cube Visualizer Utility
 * 
 * Provides visual feedback for 3D cube selection with wireframe rendering
 * and interactive handles for precise control.
 */

import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  Group,
  SphereGeometry,
} from 'three'
import type { CubeSelectionState, CubeVisualStyle } from '../types/index'

export class CubeVisualizer {
  private group: Group
  private wireframe: LineSegments | null = null
  private faces: Mesh | null = null
  private handles: Group | null = null
  private isVisible: boolean = false

  constructor(private style: CubeVisualStyle) {
    this.group = new Group()
    this.group.name = 'CubeSelection'
  }

  /**
   * Update cube visualization based on current state
   */
  updateCube(state: CubeSelectionState): void {
    if (!state.isActive) {
      this.hide()
      return
    }

    // Clear existing geometry
    this.clearGeometry()

    // Create wireframe
    this.createWireframe(state)
    
    // Create semi-transparent faces
    this.createFaces(state)
    
    // Create interactive handles
    if (state.showControls) {
      this.createHandles(state)
    }

    this.show()
  }

  /**
   * Create wireframe outline of the cube
   */
  private createWireframe(state: CubeSelectionState): void {
    const geometry = new BoxGeometry(state.size.x, state.size.y, state.size.z)
    const edges = new EdgesGeometry(geometry)
    
    const material = new LineBasicMaterial({
      color: this.style.wireframeColor,
      linewidth: this.style.lineWidth,
      transparent: true,
      opacity: 0.8,
    })

    this.wireframe = new LineSegments(edges, material)
    this.wireframe.position.copy(state.center)
    this.wireframe.rotation.setFromVector3(state.rotation)
    
    this.group.add(this.wireframe)
  }

  /**
   * Create semi-transparent cube faces
   */
  private createFaces(state: CubeSelectionState): void {
    const geometry = new BoxGeometry(state.size.x, state.size.y, state.size.z)
    
    const material = new MeshBasicMaterial({
      color: this.style.faceColor,
      transparent: true,
      opacity: this.style.faceOpacity,
      depthWrite: false,
    })

    this.faces = new Mesh(geometry, material)
    this.faces.position.copy(state.center)
    this.faces.rotation.setFromVector3(state.rotation)
    
    this.group.add(this.faces)
  }

  /**
   * Create interactive handles for resizing and positioning
   */
  private createHandles(state: CubeSelectionState): void {
    const handles = new Group()
    handles.name = 'CubeHandles'
    this.handles = handles

    const handleGeometry = new SphereGeometry(this.style.handleSize, 8, 6)

    // Corner handles
    const corners = [
      new Vector3(-0.5, -0.5, -0.5), // 000
      new Vector3(0.5, -0.5, -0.5),  // 100
      new Vector3(-0.5, 0.5, -0.5),  // 010
      new Vector3(0.5, 0.5, -0.5),   // 110
      new Vector3(-0.5, -0.5, 0.5),  // 001
      new Vector3(0.5, -0.5, 0.5),   // 101
      new Vector3(-0.5, 0.5, 0.5),   // 011
      new Vector3(0.5, 0.5, 0.5),    // 111
    ]

    corners.forEach((corner, index) => {
      const material = new MeshBasicMaterial({
        color: this.style.handleColor,
        transparent: true,
        opacity: 0.8,
      })

      const handle = new Mesh(handleGeometry, material)
      handle.position.set(
        state.center.x + corner.x * state.size.x,
        state.center.y + corner.y * state.size.y,
        state.center.z + corner.z * state.size.z,
      )
      handle.name = `corner-${index.toString(2).padStart(3, '0')}`
      handles.add(handle)
    })

    // Face center handles
    const faces = [
      { pos: new Vector3(0, 0, -0.5), name: 'face-front' },
      { pos: new Vector3(0, 0, 0.5), name: 'face-back' },
      { pos: new Vector3(-0.5, 0, 0), name: 'face-left' },
      { pos: new Vector3(0.5, 0, 0), name: 'face-right' },
      { pos: new Vector3(0, -0.5, 0), name: 'face-bottom' },
      { pos: new Vector3(0, 0.5, 0), name: 'face-top' },
    ]

    faces.forEach(({ pos, name }) => {
      const material = new MeshBasicMaterial({
        color: this.style.handleColor,
        transparent: true,
        opacity: 0.6,
      })

      const handle = new Mesh(handleGeometry, material)
      handle.position.set(
        state.center.x + pos.x * state.size.x,
        state.center.y + pos.y * state.size.y,
        state.center.z + pos.z * state.size.z,
      )
      handle.name = name
      handle.scale.setScalar(0.7)
      handles.add(handle)
    })

    // Center handle for moving
    const centerMaterial = new MeshBasicMaterial({
      color: this.style.handleActiveColor,
      transparent: true,
      opacity: 0.5,
    })

    const centerHandle = new Mesh(handleGeometry, centerMaterial)
    centerHandle.position.copy(state.center)
    centerHandle.name = 'center'
    centerHandle.scale.setScalar(1.2) // Larger than other handles
    
    this.handles.add(centerHandle)
    this.group.add(this.handles)
  }

  /**
   * Highlight a specific handle
   */
  highlightHandle(handleName: string): void {
    if (!this.handles) return

    this.handles.children.forEach(child => {
      if (child instanceof Mesh) {
        const mesh = child as Mesh
        const material = mesh.material as MeshBasicMaterial
         
        if (material && child.name === handleName) {
          material.color.setStyle(this.style.handleHoverColor)
          mesh.scale.setScalar(1.3)
        } else if (material) {
          material.color.setStyle(this.style.handleColor)
          mesh.scale.setScalar(child.name === 'center' ? 1.2 : child.name.startsWith('face') ? 0.7 : 1.0)
        }
      }
    })
  }

  /**
   * Clear handle highlighting
   */
  clearHighlight(): void {
    if (!this.handles) return

    this.handles.children.forEach(child => {
      if (child instanceof Mesh) {
        const mesh = child as Mesh
        const material = mesh.material as MeshBasicMaterial
        if (material && child.name) {
          material.color.setStyle(this.style.handleColor)
          mesh.scale.setScalar(child.name === 'center' ? 1.2 : child.name.startsWith('face') ? 0.7 : 1.0)
        }
      }
    })
  }

  /**
   * Show the cube visualization
   */
  show(): void {
    this.isVisible = true
    this.group.visible = true
  }

  /**
   * Hide the cube visualization
   */
  hide(): void {
    this.isVisible = false
    this.group.visible = false
  }

  /**
   * Clear all geometry
   */
  private clearGeometry(): void {
    this.group.clear()
    this.wireframe = null
    this.faces = null
    this.handles = null
  }

  /**
   * Get the Three.js group for adding to scene
   */
  getGroup(): Group {
    return this.group
  }

  /**
   * Check if currently visible
   */
  get visible(): boolean {
    return this.isVisible
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearGeometry()
    
    // Dispose of geometries and materials
    this.group.traverse((child) => {
      if (child instanceof Mesh || child instanceof LineSegments) {
        if (child.geometry) {
          child.geometry.dispose()
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    })
  }

  /**
   * Get all handle meshes for raycasting
   */
  getHandleMeshes(): Mesh[] {
    if (!this.handles) return []
    
    const meshes: Mesh[] = []
    this.handles.children.forEach(child => {
      if (child instanceof Mesh) {
        meshes.push(child)
      }
    })
    return meshes
  }

  /**
   * Get handle information by name
   */
  getHandleInfo(handleName: string): { type: 'corner' | 'face' | 'center', position: Vector3 } | null {
    if (!this.handles) return null

    const handle = this.handles.getObjectByName(handleName)
    if (!handle || !('position' in handle)) return null

    let type: 'corner' | 'face' | 'center'
    if (handleName === 'center') {
      type = 'center'
    } else if (handleName.startsWith('face')) {
      type = 'face'
    } else if (handleName.startsWith('corner')) {
      type = 'corner'
    } else {
      return null
    }

    return {
      type,
      position: (handle as any).position.clone(),
    }
  }

  /**
   * Update cube state based on handle drag
   */
  updateCubeFromHandleDrag(
    handleName: string, 
    startPosition: Vector3, 
    currentPosition: Vector3, 
    originalCubeState: CubeSelectionState,
  ): Partial<CubeSelectionState> | null {
    const handleInfo = this.getHandleInfo(handleName)
    if (!handleInfo) return null

    const delta = currentPosition.clone().sub(startPosition)
    const result: Partial<CubeSelectionState> = {}

    switch (handleInfo.type) {
      case 'center':
        // Move entire cube
        result.center = originalCubeState.center.clone().add(delta)
        break

      case 'face': {
        const newSize = originalCubeState.size.clone()
        const newCenter = originalCubeState.center.clone()

        if (handleName === 'face-right') {
          newSize.x = Math.max(0.1, originalCubeState.size.x + delta.x)
          newCenter.x = originalCubeState.center.x + delta.x / 2
        } else if (handleName === 'face-left') {
          newSize.x = Math.max(0.1, originalCubeState.size.x - delta.x)
          newCenter.x = originalCubeState.center.x + delta.x / 2
        } else if (handleName === 'face-top') {
          newSize.y = Math.max(0.1, originalCubeState.size.y + delta.y)
          newCenter.y = originalCubeState.center.y + delta.y / 2
        } else if (handleName === 'face-bottom') {
          newSize.y = Math.max(0.1, originalCubeState.size.y - delta.y)
          newCenter.y = originalCubeState.center.y + delta.y / 2
        } else if (handleName === 'face-back') {
          newSize.z = Math.max(0.1, originalCubeState.size.z + delta.z)
          newCenter.z = originalCubeState.center.z + delta.z / 2
        } else if (handleName === 'face-front') {
          newSize.z = Math.max(0.1, originalCubeState.size.z - delta.z)
          newCenter.z = originalCubeState.center.z + delta.z / 2
        }

        result.size = newSize
        result.center = newCenter
        break
      }
      case 'corner': {
        const scaleFactor = 1 + (delta.length() * 0.1)
        result.size = originalCubeState.size.clone().multiplyScalar(Math.max(0.1, scaleFactor))
        break
      }
    }

    return result
  }
}

/**
 * Create a cube visualizer with default styling
 */
export function createCubeVisualizer(customStyle?: Partial<CubeVisualStyle>): CubeVisualizer {
  const defaultStyle: CubeVisualStyle = {
    wireframeColor: '#0070f3',
    faceColor: '#0070f3',
    handleColor: '#ffffff',
    handleHoverColor: '#ffd700',
    handleActiveColor: '#ff4444',
    lineWidth: 2,
    handleSize: 0.05,
    faceOpacity: 0.1,
  }

  const style = { ...defaultStyle, ...customStyle }
  return new CubeVisualizer(style)
} 