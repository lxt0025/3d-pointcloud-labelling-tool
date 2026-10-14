/**
 * Selection Management System
 * 
 * This module provides comprehensive selection functionality for the Point Cloud Labelling Tool.
 * It handles different selection tools (brush, smart, polygon), manages selections,
 * and coordinates with the label system for point assignment.
 */

import type {
  Selection,
  SelectionTool,
  PointCloudData,
  Label,
  BrushToolConfig,
  SmartSelectConfig,
  PolygonSelectConfig,
  PointCloudIntersection,
  CubeSelectionState,
} from '../types/index'
import { Vector3 as ThreeVector3, type Vector3 } from 'three'
import { labelManager } from './labelManager'

// Selection Manager Events
export interface SelectionManagerEvents {
  'selection:created': Selection
  'selection:updated': Selection
  'selection:deleted': string
  'selection:cleared': void
  'selection:confirmed': Selection
  'selection:pending': { count: number; areas: number }
  'tool:changed': SelectionTool
  'points:assigned': { labelId: string; pointIndices: number[] }
  'history:changed': { canUndo: boolean; canRedo: boolean }
  'cube:started': CubeSelectionState
  'cube:updated': CubeSelectionState
  'cube:ended': null
}

/**
 * Selection State
 */
export interface SelectionState {
  activeTool: SelectionTool
  activeLabel: Label | null
  currentSelection: Uint32Array | null
  previewSelection: Uint32Array | null
  pendingSelections: Uint32Array[] // Multiple selection areas before confirmation
  isSelecting: boolean
  toolConfigs: ToolConfigs
  canUndo: boolean
  canRedo: boolean
  selectionMode: 'immediate' | 'accumulate' // New selection mode
}

/**
 * Tool Configurations
 */
export interface ToolConfigs {
  brush: BrushToolConfig
  smartSelect: SmartSelectConfig
  polygon: PolygonSelectConfig
}

/**
 * Selection History Entry
 */
export interface SelectionHistoryEntry {
  id: string
  action: 'create' | 'update' | 'delete' | 'assign' | 'accumulate' | 'clear'
  selection?: Selection
  pointIndices?: Uint32Array
  pendingSelections?: Uint32Array[]
  labelId?: string
  timestamp: Date
}

/**
 * Event Emitter for Selection Management
 */
class SelectionManagerEmitter {
  // eslint-disable-next-line @typescript-eslint/ban-types
  private listeners: Map<keyof SelectionManagerEvents, Set<Function>> = new Map()

  on<K extends keyof SelectionManagerEvents>(event: K, listener: (data: SelectionManagerEvents[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  off<K extends keyof SelectionManagerEvents>(event: K, listener: (data: SelectionManagerEvents[K]) => void): void {
    this.listeners.get(event)?.delete(listener)
  }

  emit<K extends keyof SelectionManagerEvents>(event: K, data: SelectionManagerEvents[K]): void {
    this.listeners.get(event)?.forEach(listener => listener(data))
  }
}

/**
 * Selection Manager Class
 */
export class SelectionManager {
  private selections: Map<string, Selection> = new Map()
  private assignedPoints: Map<number, string> = new Map() // pointIndex -> labelId
  private state: SelectionState
  private emitter = new SelectionManagerEmitter()
  private history: SelectionHistoryEntry[] = []
  private historyIndex = -1
  private maxHistorySize = 100
  private currentPointCloud: PointCloudData | null = null

  constructor() {
    this.state = {
      activeTool: 'brush',
      activeLabel: null,
      currentSelection: null,
      previewSelection: null,
      pendingSelections: [],
      isSelecting: false,
      canUndo: false,
      canRedo: false,
      selectionMode: 'accumulate', // Default to accumulate mode
      toolConfigs: {
        brush: {
          radius: 0.005,
          shape: 'sphere',
          useFalloff: false,
          mode: 'add',
        },
        smartSelect: {
          spatialThreshold: 0.1,
          colorThreshold: 0.1,
          normalThreshold: 0.8,
          maxPoints: 10000,
          algorithm: 'region-growing',
        },
        polygon: {
          projectionPlane: 'camera',
          includeOccluded: false,
          depth: 1.0,
          showSkeleton: true,
          enableHandles: true,
          snapToGrid: false,
          gridSize: 0.1,
        },
      },
    }
  }

  /**
   * Set the current point cloud
   */
  setPointCloud(pointCloud: PointCloudData | null): void {
    this.currentPointCloud = pointCloud
    this.clearAllSelections()
  }

  /**
   * Get current selection state
   */
  getState(): SelectionState {
    return { ...this.state }
  }

  /**
   * Set active selection tool
   */
  setActiveTool(tool: SelectionTool): void {
    if (this.state.activeTool !== tool) {
      this.state.activeTool = tool
      this.clearCurrentSelection()
      this.emitter.emit('tool:changed', tool)
    }
  }

  /**
   * Set active label for assignment
   */
  setActiveLabel(label: Label | null): void {
    this.state.activeLabel = label
  }

  /**
   * Update tool configuration
   */
  updateToolConfig<T extends keyof ToolConfigs>(tool: T, config: Partial<ToolConfigs[T]>): void {
    this.state.toolConfigs[tool] = { ...this.state.toolConfigs[tool], ...config }
  }

  /**
   * Start selection process
   */
  startSelection(point: Vector3, intersection?: PointCloudIntersection): void {
    if (!this.currentPointCloud || this.state.isSelecting) {
      return
    }

    this.state.isSelecting = true
    
    this.clearCurrentSelection()

    // Perform selection based on active tool
    switch (this.state.activeTool) {
      case 'brush':
        this.performBrushSelection(point, intersection)
        break
      case 'smart':
        this.performSmartSelection(point, intersection)
        break
      case 'polygon':
        this.startPolygonSelection(point)
        break
    }
  }

  /**
   * Continue selection (for tools that support continuous selection)
   */
  continueSelection(point: Vector3, intersection?: PointCloudIntersection): void {
    if (!this.state.isSelecting) {
      return
    }

    switch (this.state.activeTool) {
      case 'brush':
        this.continueBrushSelection(point, intersection)
        break
      case 'polygon':
        this.continuePolygonSelection(point)
        break
    }
  }

  /**
   * End selection process - updated for accumulate mode
   */
  endSelection(): void {
    if (!this.state.isSelecting) {
      return
    }

    this.state.isSelecting = false

    // Finalize selection based on tool
    switch (this.state.activeTool) {
      case 'polygon':
        // DON'T finalize cube immediately - keep it persistent for adjustment
        this.persistCubeSelection()
        break
      default:
        this.finalizeCurrentSelection()
        break
    }

    // Handle selection based on mode (only for non-cube selections)
    if (this.state.activeTool !== 'polygon' && this.state.currentSelection && this.state.currentSelection.length > 0) {
      if (this.state.selectionMode === 'immediate') {
        // Immediate mode: assign right away
        this.assignSelectionToLabel()
      } else {
        // Accumulate mode: add to pending selections
        this.addToPendingSelections()
      }
    }
  }

  /**
   * Assign current selection to active label
   */
  assignSelectionToLabel(): boolean {
    if (!this.state.activeLabel || !this.state.currentSelection || this.state.currentSelection.length === 0) {
      return false
    }

    const pointIndices = Array.from(this.state.currentSelection)
    
    // Remove points from previous labels
    pointIndices.forEach(pointIndex => {
      const previousLabelId = this.assignedPoints.get(pointIndex)
      if (previousLabelId) {
        const previousLabel = labelManager.getLabel(previousLabelId)
        if (previousLabel) {
          labelManager.updateLabelPointCount(previousLabelId, Math.max(0, previousLabel.pointCount - 1))
        }
      }
    })

    // Assign points to new label
    pointIndices.forEach(pointIndex => {
      this.assignedPoints.set(pointIndex, this.state.activeLabel!.id)
    })

    // Update label point count
    const currentLabel = labelManager.getLabel(this.state.activeLabel.id)
    if (currentLabel) {
      const newCount = currentLabel.pointCount + pointIndices.length
      labelManager.updateLabelPointCount(this.state.activeLabel.id, newCount)
    }

    // Create selection record
    const selection: Selection = {
      id: this.generateSelectionId(),
      labelId: this.state.activeLabel.id,
      pointIndices: new Uint32Array(pointIndices),
      toolUsed: this.state.activeTool,
      createdAt: new Date(),
    }

    this.selections.set(selection.id, selection)
    this.addToHistory('assign', selection, new Uint32Array(pointIndices), this.state.activeLabel.id)

    this.emitter.emit('selection:created', selection)
    this.emitter.emit('points:assigned', { 
      labelId: this.state.activeLabel.id, 
      pointIndices, 
    })

    this.clearCurrentSelection()
    return true
  }

  /**
   * Assign every currently unlabeled point to the active label.
   * Existing point assignments are preserved.
   */
  assignAllUnlabeledToActiveLabel(): boolean {
    if (!this.currentPointCloud || !this.state.activeLabel) {
      return false
    }

    const labelId = this.state.activeLabel.id
    const label = labelManager.getLabel(labelId)
    if (!label) {
      return false
    }

    const totalPoints = Math.floor(this.currentPointCloud.positions.length / 3)
    const pointIndices: number[] = []

    for (let pointIndex = 0; pointIndex < totalPoints; pointIndex++) {
      if (!this.assignedPoints.has(pointIndex)) {
        pointIndices.push(pointIndex)
      }
    }

    if (pointIndices.length === 0) {
      return false
    }

    pointIndices.forEach(pointIndex => {
      this.assignedPoints.set(pointIndex, labelId)
    })

    labelManager.updateLabelPointCount(labelId, label.pointCount + pointIndices.length)

    const typedPointIndices = new Uint32Array(pointIndices)
    const selection: Selection = {
      id: this.generateSelectionId(),
      labelId,
      pointIndices: typedPointIndices,
      toolUsed: this.state.activeTool,
      createdAt: new Date(),
      metadata: {
        toolParameters: { operation: 'fill-unlabeled' },
      },
    }

    this.selections.set(selection.id, selection)
    this.addToHistory('assign', selection, typedPointIndices, labelId)

    // Clear any transient selection before notifying UI listeners.
    this.clearCurrentSelection()
    this.emitter.emit('selection:created', selection)
    this.emitter.emit('points:assigned', { labelId, pointIndices })

    return true
  }

  /**
   * Erase points (remove from labels)
   */
  erasePoints(pointIndices: number[]): void {
    pointIndices.forEach(pointIndex => {
      const labelId = this.assignedPoints.get(pointIndex)
      if (labelId) {
        this.assignedPoints.delete(pointIndex)
        
        // Update label point count
        const label = labelManager.getLabel(labelId)
        if (label) {
          labelManager.updateLabelPointCount(labelId, Math.max(0, label.pointCount - 1))
        }
      }
    })

    this.addToHistory('delete', undefined, new Uint32Array(pointIndices))
  }

  /**
   * Get label ID for a point
   */
  getPointLabel(pointIndex: number): string | undefined {
    return this.assignedPoints.get(pointIndex)
  }

  /**
   * Get all points assigned to a label
   */
  getPointsForLabel(labelId: string): number[] {
    const points: number[] = []
    this.assignedPoints.forEach((assignedLabelId, pointIndex) => {
      if (assignedLabelId === labelId) {
        points.push(pointIndex)
      }
    })
    return points
  }

  /**
   * Get all point-to-label assignments as a read-only map
   */
  getAllAssignments(): ReadonlyMap<number, string> {
    return this.assignedPoints
  }

  /**
   * Clear current selection
   */
  clearCurrentSelection(): void {
    this.state.currentSelection = null
    this.state.previewSelection = null
  }

  /**
   * Clear all selections
   */
  clearAllSelections(): void {
    this.selections.clear()
    this.assignedPoints.clear()
    this.clearCurrentSelection()
    this.emitter.emit('selection:cleared', undefined)
  }

  /**
   * Get selection statistics
   */
  getStatistics() {
    const totalSelections = this.selections.size
    const totalAssignedPoints = this.assignedPoints.size
    const labelCounts = new Map<string, number>()

    this.assignedPoints.forEach(labelId => {
      labelCounts.set(labelId, (labelCounts.get(labelId) || 0) + 1)
    })

    return {
      totalSelections,
      totalAssignedPoints,
      labelCounts: Object.fromEntries(labelCounts),
      currentSelectionSize: this.state.currentSelection?.length || 0,
    }
  }

  /**
   * Event subscription methods
   */
  on<K extends keyof SelectionManagerEvents>(event: K, listener: (data: SelectionManagerEvents[K]) => void): void {
    this.emitter.on(event, listener)
  }

  off<K extends keyof SelectionManagerEvents>(event: K, listener: (data: SelectionManagerEvents[K]) => void): void {
    this.emitter.off(event, listener)
  }

  // Private methods

  private performBrushSelection(center: Vector3, intersection?: PointCloudIntersection): void {
    if (!this.currentPointCloud || !intersection) {
      return
    }

    const config = this.state.toolConfigs.brush
    const candidateIndices = this.findPointsInRadius(center, config.radius, config.shape)
    
    // Get ALL selected points (current selection + all pending selections)
    const allSelectedPoints = new Set<number>()
    
    // Add current selection (blue points)
    if (this.state.currentSelection) {
      Array.from(this.state.currentSelection).forEach(index => allSelectedPoints.add(index))
    }
    
    // Add all pending selections (red points)
    this.state.pendingSelections.forEach(selection => {
      Array.from(selection).forEach(index => allSelectedPoints.add(index))
    })
    
    if (config.mode === 'add') {
      // Only add points that aren't in ANY selection (current OR pending)
      const pointsToAdd = candidateIndices.filter(index => !allSelectedPoints.has(index))
      if (pointsToAdd.length > 0) {
        this.addToCurrentSelection(pointsToAdd)
      }
    } else if (config.mode === 'subtract') {
      // Remove from both current selection AND pending selections
      const pointsToRemove = candidateIndices.filter(index => allSelectedPoints.has(index))
      if (pointsToRemove.length > 0) {
        this.removeFromAllSelections(pointsToRemove)
      }
    } else {
      // Replace mode - clear and set new selection
      this.state.currentSelection = new Uint32Array(candidateIndices)
    }
  }

  private continueBrushSelection(center: Vector3, intersection?: PointCloudIntersection): void {
    this.performBrushSelection(center, intersection)
  }

  private performSmartSelection(_center: Vector3, intersection?: PointCloudIntersection): void {
    if (!this.currentPointCloud || !intersection) {
      return
    }

    const config = this.state.toolConfigs.smartSelect
    const seedPointIndex = intersection.pointIndex
    const selectedIndices = this.performRegionGrowing(seedPointIndex, config)
    
    this.state.currentSelection = new Uint32Array(selectedIndices)
  }

  private cubeSelection: CubeSelectionState = {
    isActive: false,
    center: new ThreeVector3(0, 0, 0),
    size: new ThreeVector3(1, 1, 1),
    rotation: new ThreeVector3(0, 0, 0),
    activeHandle: null,
    isDragging: false,
    dragStart: null,
    showControls: false,
    isPersistent: false,
  }


  private startPolygonSelection(point: Vector3): void {
    // Start 3D cube selection
    this.cubeSelection.center.copy(point)
    this.cubeSelection.size.set(0.1, 0.1, 0.1) // Start with small size
    this.cubeSelection.isActive = true
    this.cubeSelection.showControls = true
    
    
    // Generate initial preview
    this.updateCubeSelectionPreview()
    
    // Emit cube state for visual rendering
    this.emitter.emit('cube:started', this.getCubeSelectionData())
  }

  private continuePolygonSelection(point: Vector3): void {
    if (!this.cubeSelection.isActive) {
      return
    }
    
    // Calculate new size based on drag distance
    const startPoint = this.cubeSelection.center
    const distance = startPoint.distanceTo(point)
    const newSize = Math.max(0.1, distance * 2) // Minimum size 0.1
    
    this.cubeSelection.size.set(newSize, newSize, newSize)
    
    // Update preview selection
    this.updateCubeSelectionPreview()
    
    // Emit cube state for visual updates
    this.emitter.emit('cube:updated', this.getCubeSelectionData())
  }

  private persistCubeSelection(): void {
    if (!this.cubeSelection.isActive) {
      return
    }

    // Keep cube active and show controls for adjustment
    this.cubeSelection.showControls = true
    this.cubeSelection.isPersistent = true
    
    // Update preview but don't finalize yet
    this.updateCubeSelectionPreview()
    
    
    // Emit cube state to keep controls visible
    this.emitter.emit('cube:updated', this.getCubeSelectionData())
  }

  private confirmCubeSelectionPrivate(): boolean {
    if (!this.cubeSelection.isActive || !this.cubeSelection.isPersistent) {
      return false
    }
    
    // Perform final cube selection
    const pointsInCube = this.findPointsInCubeFromState()
    
    if (pointsInCube.length > 0) {
      this.addToCurrentSelection(pointsInCube)
      
      
      // Emit selection event
      this.emitter.emit('selection:created', {
        id: this.generateSelectionId(),
        labelId: this.state.activeLabel?.id || '',
        pointIndices: new Uint32Array(pointsInCube),
        createdAt: new Date(),
        toolUsed: 'polygon',
      })
    }
    
    // Reset cube selection state
    this.resetCubeSelection()
    
    // Handle selection based on mode
    if (this.state.currentSelection && this.state.currentSelection.length > 0) {
      if (this.state.selectionMode === 'immediate') {
        // Immediate mode: assign right away
        this.assignSelectionToLabel()
      } else {
        // Accumulate mode: add to pending selections
        this.addToPendingSelections()
      }
    }
    
    return true
  }

  private cancelCubeSelectionPrivate(): void {
    if (!this.cubeSelection.isActive) {
      return
    }
    
    this.resetCubeSelection()
  }

  private resetCubeSelection(): void {
    this.cubeSelection.isActive = false
    this.cubeSelection.showControls = false
    this.cubeSelection.activeHandle = null
    this.cubeSelection.isDragging = false
    this.cubeSelection.isPersistent = false
    
    // Clear preview
    this.state.previewSelection = null
    
    // Emit cube end for visual cleanup
    this.emitter.emit('cube:ended', null)
  }

  private updateCubeSelectionPreview(): void {
    if (!this.cubeSelection.isActive) {
      return
    }
    
    // Generate preview points within the cube
    const previewPoints = this.findPointsInCubeFromState()
    this.state.previewSelection = new Uint32Array(previewPoints)
    
    // Emit preview update for visual feedback
    this.emitter.emit('selection:updated', {
      id: 'preview',
      labelId: 'preview',
      pointIndices: this.state.previewSelection,
      createdAt: new Date(),
      toolUsed: 'polygon',
    })
  }

  private findPointsInCube(startPoint: Vector3, endPoint: Vector3): number[] {
    if (!this.currentPointCloud) {
      return []
    }

    const points: number[] = []
    const positions = this.currentPointCloud.positions

    // Define cube boundaries
    const minX = Math.min(startPoint.x, endPoint.x)
    const maxX = Math.max(startPoint.x, endPoint.x)
    const minY = Math.min(startPoint.y, endPoint.y)
    const maxY = Math.max(startPoint.y, endPoint.y)
    const minZ = Math.min(startPoint.z, endPoint.z)
    const maxZ = Math.max(startPoint.z, endPoint.z)

    // Check each point
    for (let i = 0; i < positions.length - 2; i += 3) {
      const x = positions[i]!
      const y = positions[i + 1]!
      const z = positions[i + 2]!

      // Check if point is within cube bounds
      if (x >= minX && x <= maxX &&
          y >= minY && y <= maxY &&
          z >= minZ && z <= maxZ) {
        points.push(i / 3)
      }
    }

    return points
  }

  private findPointsInRadius(center: Vector3, radius: number, shape: 'sphere' | 'cylinder' | 'box'): number[] {
    if (!this.currentPointCloud) {
      return []
    }

    const points: number[] = []
    const positions = this.currentPointCloud.positions
    const radiusSquared = radius * radius
    
    // Performance optimization: Early bounds checking
    const minX = center.x - radius
    const maxX = center.x + radius
    const minY = center.y - radius
    const maxY = center.y + radius
    const minZ = center.z - radius
    const maxZ = center.z + radius

    // Process points with optimized loop
    for (let i = 0; i < positions.length - 2; i += 3) {
      const pointIndex = i / 3
      const x = positions[i]!
      const y = positions[i + 1]!
      const z = positions[i + 2]!

      // Quick bounds check first (much faster than distance calculations)
      if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) {
        continue
      }

      let inRadius = false

      switch (shape) {
        case 'sphere': {
          const distanceSquared =
            (x - center.x) ** 2 +
            (y - center.y) ** 2 +
            (z - center.z) ** 2
          inRadius = distanceSquared <= radiusSquared
          break
        }
        case 'cylinder': {
          const horizontalDistanceSquared =
            (x - center.x) ** 2 +
            (z - center.z) ** 2
          inRadius = horizontalDistanceSquared <= radiusSquared &&
                     Math.abs(y - center.y) <= radius
          break
        }
        case 'box':
          inRadius =
            Math.abs(x - center.x) <= radius &&
            Math.abs(y - center.y) <= radius &&
            Math.abs(z - center.z) <= radius
          break
      }

      if (inRadius) {
        points.push(pointIndex)
      }
    }

    return points
  }

  private performRegionGrowing(seedIndex: number, config: SmartSelectConfig): number[] {
    if (!this.currentPointCloud) {
      return []
    }

    const selected = new Set<number>()
    const queue = [seedIndex]
    const positions = this.currentPointCloud.positions
    const colors = this.currentPointCloud.colors

    // Validate seed index
    if (seedIndex * 3 + 2 >= positions.length) {
      return []
    }

    const seedX = positions[seedIndex * 3]!
    const seedY = positions[seedIndex * 3 + 1]!
    const seedZ = positions[seedIndex * 3 + 2]!
    
    const seedR = colors ? colors[seedIndex * 3] || 0 : 0
    const seedG = colors ? colors[seedIndex * 3 + 1] || 0 : 0
    const seedB = colors ? colors[seedIndex * 3 + 2] || 0 : 0

    while (queue.length > 0 && selected.size < config.maxPoints) {
      const currentIndex = queue.shift()!
      
      if (selected.has(currentIndex)) {
        continue
      }

      // Validate current index
      if (currentIndex * 3 + 2 >= positions.length) {
        continue
      }

      const x = positions[currentIndex * 3]!
      const y = positions[currentIndex * 3 + 1]!
      const z = positions[currentIndex * 3 + 2]!

      // Check spatial proximity
      const distance = Math.sqrt(
        (x - seedX) ** 2 + 
        (y - seedY) ** 2 + 
        (z - seedZ) ** 2,
      )

      if (distance > config.spatialThreshold) {
        continue
      }

      // Check color similarity if colors are available
      if (colors && currentIndex * 3 + 2 < colors.length) {
        const r = colors[currentIndex * 3] || 0
        const g = colors[currentIndex * 3 + 1] || 0
        const b = colors[currentIndex * 3 + 2] || 0

        const colorDistance = Math.sqrt(
          (r - seedR) ** 2 + 
          (g - seedG) ** 2 + 
          (b - seedB) ** 2,
        ) / Math.sqrt(3) // Normalize to [0, 1]

        if (colorDistance > config.colorThreshold) {
          continue
        }
      }

      selected.add(currentIndex)

      // Optimized neighbor search with spatial bounds
      const neighborThreshold = config.spatialThreshold * 0.5
      const neighborThresholdSq = neighborThreshold * neighborThreshold
      
      // Bounds for quick neighbor filtering
      const minNX = x - neighborThreshold
      const maxNX = x + neighborThreshold
      const minNY = y - neighborThreshold
      const maxNY = y + neighborThreshold
      const minNZ = z - neighborThreshold
      const maxNZ = z + neighborThreshold

      for (let i = 0; i < positions.length - 2; i += 3) {
        const neighborIndex = i / 3
        if (selected.has(neighborIndex)) {
          continue
        }

        const nx = positions[i]!
        const ny = positions[i + 1]!
        const nz = positions[i + 2]!

        // Quick bounds check first
        if (nx < minNX || nx > maxNX || ny < minNY || ny > maxNY || nz < minNZ || nz > maxNZ) {
          continue
        }

        const neighborDistanceSquared = 
          (nx - x) ** 2 + 
          (ny - y) ** 2 + 
          (nz - z) ** 2

        if (neighborDistanceSquared <= neighborThresholdSq) {
          queue.push(neighborIndex)
        }
      }
    }

    return Array.from(selected)
  }

  private addToCurrentSelection(indices: number[]): void {
    if (indices.length === 0) {
      return
    }

    if (!this.state.currentSelection) {
      this.state.currentSelection = new Uint32Array(indices)
    } else {
      const existing = new Set(this.state.currentSelection)
      indices.forEach(index => existing.add(index))
      this.state.currentSelection = new Uint32Array(Array.from(existing))
    }
    
    // Emit selection update for visual feedback
    this.emitter.emit('selection:updated', {
      id: 'current',
      labelId: this.state.activeLabel?.id || '',
      pointIndices: this.state.currentSelection,
      createdAt: new Date(),
      toolUsed: this.state.activeTool,
    })
  }

  private removeFromAllSelections(indicesToRemove: number[]): void {
    const toRemove = new Set(indicesToRemove)
    
    // Remove from current selection
    if (this.state.currentSelection) {
      const remainingCurrent = Array.from(this.state.currentSelection).filter(index => !toRemove.has(index))
      this.state.currentSelection = new Uint32Array(remainingCurrent)
    }
    
    // Remove from all pending selections
    this.state.pendingSelections = this.state.pendingSelections.map(selection => {
      const remainingPending = Array.from(selection).filter(index => !toRemove.has(index))
      return new Uint32Array(remainingPending)
    }).filter(selection => selection.length > 0) // Remove empty selections
    
    // Emit selection updates for visual feedback
    this.emitter.emit('selection:updated', {
      id: 'current',
      labelId: this.state.activeLabel?.id || '',
      pointIndices: this.state.currentSelection || new Uint32Array([]),
      createdAt: new Date(),
      toolUsed: this.state.activeTool,
    })
    
    // Emit pending update
    const totalPendingPoints = this.state.pendingSelections.reduce((sum, selection) => sum + selection.length, 0)
    this.emitter.emit('selection:pending', { 
      count: totalPendingPoints, 
      areas: this.state.pendingSelections.length, 
    })
  }

  private finalizeCurrentSelection(): void {
    // Selection is already in currentSelection from direct assignment
  }

  private generateSelectionId(): string {
    return `selection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private addToHistory(
    action: SelectionHistoryEntry['action'], 
    selection?: Selection, 
    pointIndices?: Uint32Array, 
    labelId?: string,
    pendingSelections?: Uint32Array[],
  ): void {
    // Remove any future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1)
    }

    const entry: SelectionHistoryEntry = {
      id: this.generateSelectionId(),
      action,
      timestamp: new Date(),
      ...(selection && { selection }),
      ...(pointIndices && { pointIndices }),
      ...(labelId && { labelId }),
      ...(pendingSelections && { pendingSelections: pendingSelections.map(sel => new Uint32Array(sel)) }),
    }

    this.history.push(entry)
    this.historyIndex = this.history.length - 1

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
      this.historyIndex--
    }

    this.updateHistoryState()
  }

  /**
   * Set selection mode
   */
  setSelectionMode(mode: 'immediate' | 'accumulate'): void {
    this.state.selectionMode = mode
    if (mode === 'immediate') {
      this.clearPendingSelections()
    }
  }

  /**
   * Get selection mode
   */
  getSelectionMode(): 'immediate' | 'accumulate' {
    return this.state.selectionMode
  }

  /**
   * Add current selection to pending selections
   */
  addToPendingSelections(): void {
    if (!this.state.currentSelection || this.state.currentSelection.length === 0) {
      return
    }

    // Add to pending selections
    this.state.pendingSelections.push(new Uint32Array(this.state.currentSelection))
    
    // Add to history
    this.addToHistory('accumulate', undefined, undefined, undefined, [...this.state.pendingSelections])
    
    // Clear current selection for next area
    this.clearCurrentSelection()
    
    // Emit pending update
    const totalPoints = this.state.pendingSelections.reduce((sum, selection) => sum + selection.length, 0)
    this.emitter.emit('selection:pending', { 
      count: totalPoints, 
      areas: this.state.pendingSelections.length, 
    })
    
  }

  /**
   * Confirm pending selections and assign to label
   */
  confirmPendingSelections(): boolean {
    if (this.state.pendingSelections.length === 0 || !this.state.activeLabel) {
      return false
    }

    // Combine all pending selections with NO DUPLICATES
    const allIndices = new Set<number>()
    
    // Add current selection first
    if (this.state.currentSelection) {
      Array.from(this.state.currentSelection).forEach(index => allIndices.add(index))
    }
    
    // Add all pending selections
    this.state.pendingSelections.forEach(selection => {
      Array.from(selection).forEach(index => allIndices.add(index))
    })

    const combinedIndices = Array.from(allIndices)
    
    
    // Remove points from previous labels (handle reassignment)
    const reassignedCount = combinedIndices.filter(pointIndex => {
      const previousLabelId = this.assignedPoints.get(pointIndex)
      if (previousLabelId && previousLabelId !== this.state.activeLabel!.id) {
        const previousLabel = labelManager.getLabel(previousLabelId)
        if (previousLabel) {
          labelManager.updateLabelPointCount(previousLabelId, Math.max(0, previousLabel.pointCount - 1))
        }
        return true
      }
      return false
    }).length

    // Assign points to new label
    combinedIndices.forEach(pointIndex => {
      this.assignedPoints.set(pointIndex, this.state.activeLabel!.id)
    })

    // Update label point count (only count points not already assigned to this label)
    const currentLabel = labelManager.getLabel(this.state.activeLabel.id)
    if (currentLabel) {
      const newPointsCount = combinedIndices.length - (currentLabel.pointCount - reassignedCount)
      const newTotalCount = currentLabel.pointCount + newPointsCount
      labelManager.updateLabelPointCount(this.state.activeLabel.id, newTotalCount)
    }

    // Create selection record with unique points
    const selection: Selection = {
      id: this.generateSelectionId(),
      labelId: this.state.activeLabel.id,
      pointIndices: new Uint32Array(combinedIndices),
      toolUsed: this.state.activeTool,
      createdAt: new Date(),
    }

    this.selections.set(selection.id, selection)
    this.addToHistory('assign', selection, new Uint32Array(combinedIndices), this.state.activeLabel.id)

    this.emitter.emit('selection:confirmed', selection)
    this.emitter.emit('points:assigned', { 
      labelId: this.state.activeLabel.id, 
      pointIndices: combinedIndices, 
    })

    // Clear all selections
    this.clearCurrentSelection()
    this.clearPendingSelections()
    return true
  }

  /**
   * Clear pending selections
   */
  clearPendingSelections(): void {
    if (this.state.pendingSelections.length > 0) {
      this.addToHistory('clear', undefined, undefined, undefined, [])
      this.state.pendingSelections = []
      this.emitter.emit('selection:pending', { count: 0, areas: 0 })
    }
  }

  /**
   * Get total pending selection count
   */
  getPendingSelectionCount(): { points: number; areas: number } {
    const points = this.state.pendingSelections.reduce((sum, selection) => sum + selection.length, 0)
    return { points, areas: this.state.pendingSelections.length }
  }

  /**
   * Undo last action
   */
  undo(): boolean {
    if (this.historyIndex <= 0) {
      return false
    }

    this.historyIndex--
    const entry = this.history[this.historyIndex]
    if (!entry) return false

    // Restore state based on action type
    switch (entry.action) {
      case 'accumulate':
        if (entry.pendingSelections) {
          this.state.pendingSelections = entry.pendingSelections.map(sel => new Uint32Array(sel))
        }
        break
      case 'assign':
        if (entry.pointIndices && entry.labelId) {
          const pointIndices = entry.pointIndices
          const labelId = entry.labelId
          
          // Remove assignment
          Array.from(pointIndices).forEach(pointIndex => {
            this.assignedPoints.delete(pointIndex)
          })
          // Update label count
          const label = labelManager.getLabel(labelId)
          if (label) {
            labelManager.updateLabelPointCount(labelId, Math.max(0, label.pointCount - pointIndices.length))
          }
          
          // Emit visual update
          this.emitter.emit('points:assigned', { 
            labelId: '', // Empty means unlabeled
            pointIndices: Array.from(pointIndices), 
          })
        }
        break
      case 'clear':
        // Restore previous pending selections (would need previous state)
        break
    }

    this.updateHistoryState()
    return true
  }

  /**
   * Redo last undone action
   */
  redo(): boolean {
    if (this.historyIndex >= this.history.length - 1) {
      return false
    }

    this.historyIndex++
    const entry = this.history[this.historyIndex + 1]
    if (!entry) return false

    // Re-apply the action
    switch (entry.action) {
      case 'accumulate':
        if (entry.pendingSelections) {
          this.state.pendingSelections = entry.pendingSelections.map(sel => new Uint32Array(sel))
        }
        break
      case 'assign':
        if (entry.pointIndices && entry.labelId) {
          const pointIndices = entry.pointIndices
          const labelId = entry.labelId
          
          // Re-assign points
          Array.from(pointIndices).forEach(pointIndex => {
            this.assignedPoints.set(pointIndex, labelId)
          })
          // Update label count
          const label = labelManager.getLabel(labelId)
          if (label) {
            labelManager.updateLabelPointCount(labelId, label.pointCount + pointIndices.length)
          }
          
          // Emit visual update
          this.emitter.emit('points:assigned', { 
            labelId,
            pointIndices: Array.from(pointIndices), 
          })
        }
        break
    }

    this.updateHistoryState()
    return true
  }

  /**
   * Update history state and emit changes
   */
  private updateHistoryState(): void {
    this.state.canUndo = this.historyIndex > 0
    this.state.canRedo = this.historyIndex < this.history.length - 1
    this.emitter.emit('history:changed', { 
      canUndo: this.state.canUndo, 
      canRedo: this.state.canRedo, 
    })
  }

  /**
   * Get current cube selection data
   */
  getCubeSelectionData(): CubeSelectionState {
    return { ...this.cubeSelection }
  }

  /**
   * Update cube selection state
   */
  updateCubeSelection(newState: CubeSelectionState): void {
    this.cubeSelection = { ...newState }
    this.updateCubeSelectionPreview()
    
    // Emit update event for visual feedback
    this.emitter.emit('cube:updated', this.getCubeSelectionData())
  }

  /**
   * Find points in cube based on current state
   */
  private findPointsInCubeFromState(): number[] {
    if (!this.currentPointCloud || !this.cubeSelection.isActive) {
      return []
    }

    const { center, size } = this.cubeSelection
    const halfSize = {
      x: size.x / 2,
      y: size.y / 2,
      z: size.z / 2,
    }

    return this.findPointsInCube(
      new ThreeVector3(
        center.x - halfSize.x,
        center.y - halfSize.y,
        center.z - halfSize.z,
      ),
      new ThreeVector3(
        center.x + halfSize.x,
        center.y + halfSize.y,
        center.z + halfSize.z,
      ),
    )
  }

  /**
   * Confirm the current cube selection
   */
  confirmCubeSelection(): boolean {
    return this.confirmCubeSelectionPrivate()
  }

  /**
   * Cancel the current cube selection
   */
  cancelCubeSelection(): void {
    this.cancelCubeSelectionPrivate()
  }

  /**
   * Check if cube selection is currently persistent
   */
  isCubeSelectionPersistent(): boolean {
    return this.cubeSelection.isActive && this.cubeSelection.isPersistent === true
  }
}

// Global selection manager instance
export const selectionManager = new SelectionManager()

// Export utility functions
export function getToolDisplayName(tool: SelectionTool): string {
  const names: Record<SelectionTool, string> = {
    brush: 'Brush',
    smart: 'Smart Select',
    polygon: 'Polygon',
  }
  return names[tool] || tool
}

export function getToolIcon(tool: SelectionTool): string {
  const icons: Record<SelectionTool, string> = {
    brush: 'B',
    smart: 'S',
    polygon: 'P',
  }
  return icons[tool] || '?'
}
