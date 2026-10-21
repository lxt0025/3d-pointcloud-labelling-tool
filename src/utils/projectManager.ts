/**
 * Project Manager
 * 
 * This module handles project persistence, auto-save functionality, and export capabilities
 * for the Point Cloud Labelling Tool. It provides:
 * 
 * - Project save/load to browser storage (IndexedDB)
 * - Export labeled data for ML training (multiple formats)
 * - Import/export label configurations
 * - Auto-save with conflict resolution
 * - Project metadata management
 * - Backup and recovery functionality
 */

import type { 
  PointCloudData, 
  Label, 
  SimpleProject,
  EnhancedProject,
  ProjectFile,
  ProjectMetadata,
  ExportFormat,
  ExportOptions,
  ImportResult,
  Selection,
} from '../types/index'
import { labelManager } from './labelManager'

// Project storage configuration
const PROJECT_STORE_NAME = 'projects'
const AUTOSAVE_STORE_NAME = 'autosave'
const DB_NAME = 'pointcloud_labelling_tool'
const DB_VERSION = 1

// Auto-save configuration
const AUTOSAVE_INTERVAL = 30000 // 30 seconds
const MAX_AUTOSAVE_VERSIONS = 10

export interface ProjectManagerEvents {
  'project:saved': (project: SimpleProject) => void
  'project:loaded': (project: SimpleProject) => void
  'project:exported': (format: ExportFormat, data: any) => void
  'project:imported': (result: ImportResult) => void
  'autosave:created': (project: SimpleProject) => void
  'autosave:restored': (project: SimpleProject) => void
  'error': (error: Error) => void
}

class ProjectManager extends EventTarget {
  private db: IDBDatabase | null = null
  private currentProject: SimpleProject | null = null
  private currentEnhancedProject: EnhancedProject | null = null
  private autosaveInterval: NodeJS.Timeout | null = null
  private isDirty = false
  private isinitialised = false

  /**
   * initialise the project manager and open IndexedDB connection
   */
  async initialise(): Promise<void> {
    if (this.isinitialised) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        const error = new Error('Failed to open project database')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.isinitialised = true
        this.startAutoSave()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create projects store
        if (!db.objectStoreNames.contains(PROJECT_STORE_NAME)) {
          const projectStore = db.createObjectStore(PROJECT_STORE_NAME, { keyPath: 'id' })
          projectStore.createIndex('name', 'metadata.name', { unique: false })
          projectStore.createIndex('createdAt', 'metadata.createdAt', { unique: false })
          projectStore.createIndex('updatedAt', 'metadata.updatedAt', { unique: false })
        }

        // Create autosave store
        if (!db.objectStoreNames.contains(AUTOSAVE_STORE_NAME)) {
          const autosaveStore = db.createObjectStore(AUTOSAVE_STORE_NAME, { keyPath: 'id' })
          autosaveStore.createIndex('timestamp', 'timestamp', { unique: false })
          autosaveStore.createIndex('projectId', 'projectId', { unique: false })
        }
      }
    })
  }

  /**
   * Create a new project
   */
  createProject(name: string, description?: string): SimpleProject {
    const now = new Date().toISOString()
    const project: SimpleProject = {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description: description || '',
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        author: 'Point Cloud Labelling Tool User',
        tags: [],
        statistics: {
          totalPoints: 0,
          labeledPoints: 0,
          totalLabels: 0,
          totalFiles: 0,
          completionPercentage: 0,
        },
      },
      pointCloud: null,
      labels: [],
      selections: [],
      settings: {
        renderingSettings: {
          pointSize: 0.001,
          colorMode: 'rgb',
          backgroundColor: '#1a1a1a',
        },
        labelingSettings: {
          autoSave: true,
          showStatistics: true,
          defaultBrushSize: 0.005,
        },
      },
    }

    this.currentProject = project
    this.markDirty()
    
    this.dispatchEvent(new CustomEvent('project:loaded', { detail: project }))
    
    return project
  }

  /**
   * Save the current project
   */
  async saveProject(project?: SimpleProject): Promise<void> {
    if (!this.db) {
      throw new Error('Project manager not initialised')
    }

    const projectToSave = project || this.currentProject
    if (!projectToSave) {
      throw new Error('No project to save')
    }

    // Labels are edited through labelManager, so copy its current state into
    // the project before persisting it to IndexedDB.
    projectToSave.labels = labelManager.getAllLabels()

    // Update metadata
    projectToSave.metadata.updatedAt = new Date().toISOString()
    
    // Update statistics
    this.updateProjectStatistics(projectToSave)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECT_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(PROJECT_STORE_NAME)
      const request = store.put(projectToSave)

      request.onsuccess = () => {
        this.isDirty = false
        this.dispatchEvent(new CustomEvent('project:saved', { detail: projectToSave }))
        resolve()
      }

      request.onerror = () => {
        const error = new Error('Failed to save project')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }
    })
  }

  /**
   * Load a project by ID
   */
  async loadProject(projectId: string): Promise<SimpleProject> {
    if (!this.db) {
      throw new Error('Project manager not initialised')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECT_STORE_NAME], 'readonly')
      const store = transaction.objectStore(PROJECT_STORE_NAME)
      const request = store.get(projectId)

      request.onsuccess = () => {
        const project = request.result
        if (!project) {
          reject(new Error(`Project not found: ${projectId}`))
          return
        }

        this.currentProject = project
        this.isDirty = false
        
        // Restore labels with their original IDs so saved point assignments
        // continue to reference the correct labels.
        labelManager.importLabels(project.labels, { replaceExisting: true })

        this.dispatchEvent(new CustomEvent('project:loaded', { detail: project }))
        resolve(project)
      }

      request.onerror = () => {
        const error = new Error('Failed to load project')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }
    })
  }

  /**
   * Get list of all projects
   */
  async getAllProjects(): Promise<ProjectMetadata[]> {
    if (!this.db) {
      throw new Error('Project manager not initialised')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECT_STORE_NAME], 'readonly')
      const store = transaction.objectStore(PROJECT_STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const projects = request.result.map((project: SimpleProject) => project.metadata)
        resolve(projects)
      }

      request.onerror = () => {
        const error = new Error('Failed to get projects list')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }
    })
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Project manager not initialised')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECT_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(PROJECT_STORE_NAME)
      const request = store.delete(projectId)

      request.onsuccess = () => {
        if (this.currentProject?.id === projectId) {
          this.currentProject = null
          this.isDirty = false
        }
        resolve()
      }

      request.onerror = () => {
        const error = new Error('Failed to delete project')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }
    })
  }

  /**
   * Export project data in various formats
   */
  async exportProject(format: ExportFormat, options: ExportOptions = {}): Promise<Blob> {
    const project = this.currentProject
    if (!project) {
      throw new Error('No project to export')
    }

    let data: any
    let mimeType: string
    let fileName: string

    switch (format) {
      case 'json':
        data = JSON.stringify(project, null, 2)
        mimeType = 'application/json'
        fileName = `${project.metadata.name}_project.json`
        break

      case 'csv':
        data = this.exportToCSV(project, options)
        mimeType = 'text/csv'
        fileName = `${project.metadata.name}_labels.csv`
        break

      case 'ply':
        data = this.exportToPLY(project, options)
        mimeType = 'application/octet-stream'
        fileName = `${project.metadata.name}_labeled.ply`
        break

      case 'las':
        data = this.exportToLAS(project, options)
        mimeType = 'application/octet-stream'
        fileName = `${project.metadata.name}_labeled.las`
        break

      case 'annotations':
        data = this.exportAnnotations(project, options)
        mimeType = 'application/json'
        fileName = `${project.metadata.name}_annotations.json`
        break

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }

    const blob = new Blob([data], { type: mimeType })
    
    // Trigger download
    if (options.download !== false) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    this.dispatchEvent(new CustomEvent('project:exported', { detail: { format, data } }))
    return blob
  }

  /**
   * Export one dataset from the active enhanced project for semantic segmentation.
   * Coordinates and RGB come from the original point cloud; annotations are
   * written to a separate integer `label` field for every point.
   */
  async exportEnhancedDataset(
    project: EnhancedProject,
    fileId: string,
    format: 'ply' | 'csv',
    options: ExportOptions = {},
  ): Promise<Blob> {
    const file = project.files.find(projectFile => projectFile.id === fileId)
    if (!file?.data) {
      throw new Error('No active point cloud data to export')
    }

    const labelValues = this.createLabelValueMap(project.labels)
    const pointLabels = this.createPointLabelArray(
      file.data.positions.length / 3,
      project.selections[fileId] || [],
      labelValues,
    )
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'pointcloud'

    let data: string
    let mimeType: string
    let fileName: string

    if (format === 'ply') {
      data = this.exportEnhancedToPLY(file.data, project.labels, labelValues, pointLabels)
      mimeType = 'application/octet-stream'
      fileName = `${baseName}_labeled.ply`
    } else {
      data = this.exportEnhancedToCSV(file.data, project.labels, labelValues, pointLabels)
      mimeType = 'text/csv;charset=utf-8'
      fileName = `${baseName}_labeled.csv`
    }

    const blob = new Blob([data], { type: mimeType })
    if (options.download !== false) {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    this.dispatchEvent(new CustomEvent('project:exported', {
      detail: { format, data, fileId },
    }))
    return blob
  }

  /**
   * Import project from file
   */
  async importProject(file: File): Promise<ImportResult> {
    try {
      const text = await file.text()
      const projectData = JSON.parse(text) as SimpleProject

      // Validate project structure
      if (!this.validateProjectStructure(projectData)) {
        throw new Error('Invalid project file format')
      }

      // Import the project
      this.currentProject = projectData
      this.markDirty()

      // Restore labels
      labelManager.clearAllLabels()
      for (const label of projectData.labels) {
        labelManager.importLabels([label])
      }

      const result: ImportResult = {
        success: true,
        warnings: [],
        processingTime: 0,
      }

      this.dispatchEvent(new CustomEvent('project:imported', { detail: result }))
      this.dispatchEvent(new CustomEvent('project:loaded', { detail: projectData }))

      return result
    } catch (error) {
      const result: ImportResult = {
        success: false,
        warnings: [],
        error: error instanceof Error ? error.message : 'Unknown import error',
        processingTime: 0,
      }
      
      this.dispatchEvent(new CustomEvent('error', { detail: error }))
      return result
    }
  }

  /**
   * Update current project with new data
   */
  updateProject(updates: Partial<SimpleProject>): void {
    if (!this.currentProject) return

    this.currentProject = { ...this.currentProject, ...updates }
    this.currentProject.metadata.updatedAt = new Date().toISOString()
    this.markDirty()
  }

  /**
   * Set point cloud data for current project
   */
  setPointCloud(pointCloud: PointCloudData | null): void {
    if (!this.currentProject) return

    this.currentProject.pointCloud = pointCloud
    this.updateProjectStatistics(this.currentProject)
    this.markDirty()
  }

  /**
   * Add or update labels in current project
   */
  updateLabels(labels: Label[]): void {
    if (!this.currentProject) return

    this.currentProject.labels = labels
    this.updateProjectStatistics(this.currentProject)
    this.markDirty()
  }

  /**
   * Get current project
   */
  getCurrentProject(): SimpleProject | null {
    return this.currentProject
  }

  /**
   * Save enhanced project to IndexedDB
   */
  async saveEnhancedProject(project?: EnhancedProject): Promise<void> {
    if (!this.db) {
      throw new Error('Project manager not initialised')
    }

    const projectToSave = project || this.currentEnhancedProject
    if (!projectToSave) {
      throw new Error('No enhanced project to save')
    }

    // The active UI uses EnhancedProject. Keep its project-level labels in
    // sync with labelManager before every manual or file-triggered save.
    projectToSave.labels = labelManager.getAllLabels()
    projectToSave.metadata.updatedAt = new Date().toISOString()
    projectToSave.metadata.statistics.totalLabels = projectToSave.labels.length

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECT_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(PROJECT_STORE_NAME)
      const request = store.put(projectToSave)

      request.onsuccess = () => {
        this.currentEnhancedProject = projectToSave
        this.isDirty = false
        this.dispatchEvent(new CustomEvent('project:saved', { detail: projectToSave }))
        resolve()
      }

      request.onerror = () => {
        const error = new Error('Failed to save enhanced project')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }
    })
  }

  /**
   * Load enhanced project by ID
   */
  async loadEnhancedProject(projectId: string): Promise<EnhancedProject> {
    if (!this.db) {
      throw new Error('Project manager not initialised')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECT_STORE_NAME], 'readonly')
      const store = transaction.objectStore(PROJECT_STORE_NAME)
      const request = store.get(projectId)

      request.onsuccess = () => {
        const project = request.result
        if (!project) {
          reject(new Error(`Enhanced project not found: ${projectId}`))
          return
        }

        // Check if this is an enhanced project (has files array)
        if (!project.files) {
          reject(new Error(`Project ${projectId} is not an enhanced project`))
          return
        }

        this.currentEnhancedProject = project
        this.isDirty = false
        
        // Restore labels with their original IDs so saved point assignments
        // continue to reference the correct labels.
        labelManager.importLabels(project.labels, { replaceExisting: true })

        this.dispatchEvent(new CustomEvent('project:loaded', { detail: project }))
        resolve(project)
      }

      request.onerror = () => {
        const error = new Error('Failed to load enhanced project')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }
    })
  }

  /**
   * Get current enhanced project
   */
  getCurrentEnhancedProject(): EnhancedProject | null {
    return this.currentEnhancedProject
  }

  /**
   * Add file to current enhanced project
   */
  addFileToProject(file: ProjectFile): void {
    if (!this.currentEnhancedProject) {
      throw new Error('No enhanced project loaded')
    }

    this.currentEnhancedProject.files.push(file)
    this.currentEnhancedProject.metadata.statistics.totalFiles = this.currentEnhancedProject.files.length
    this.currentEnhancedProject.metadata.updatedAt = new Date().toISOString()
    
    // Set as active file if it's the first one
    if (this.currentEnhancedProject.files.length === 1) {
      this.currentEnhancedProject.activeFileIndex = 0
    }

    this.markDirty()
  }

  /**
   * Remove file from current enhanced project
   */
  removeFileFromProject(fileId: string): void {
    if (!this.currentEnhancedProject) {
      throw new Error('No enhanced project loaded')
    }

    const fileIndex = this.currentEnhancedProject.files.findIndex(f => f.id === fileId)
    if (fileIndex === -1) {
      throw new Error(`File not found: ${fileId}`)
    }

    this.currentEnhancedProject.files.splice(fileIndex, 1)
    this.currentEnhancedProject.metadata.statistics.totalFiles = this.currentEnhancedProject.files.length

    // Adjust active file index
    if (this.currentEnhancedProject.activeFileIndex >= fileIndex) {
      this.currentEnhancedProject.activeFileIndex = Math.max(0, this.currentEnhancedProject.activeFileIndex - 1)
    }

    // If no files left, set active index to -1
    if (this.currentEnhancedProject.files.length === 0) {
      this.currentEnhancedProject.activeFileIndex = -1
    }

    this.currentEnhancedProject.metadata.updatedAt = new Date().toISOString()
    this.markDirty()
  }

  /**
   * Set active file in current enhanced project
   */
  setActiveFile(fileIndex: number): void {
    if (!this.currentEnhancedProject) {
      throw new Error('No enhanced project loaded')
    }

    if (fileIndex < 0 || fileIndex >= this.currentEnhancedProject.files.length) {
      throw new Error(`Invalid file index: ${fileIndex}`)
    }

    this.currentEnhancedProject.activeFileIndex = fileIndex
    this.markDirty()
  }

  /**
   * Get active file from current enhanced project
   */
  getActiveFile(): ProjectFile | null {
    if (!this.currentEnhancedProject || this.currentEnhancedProject.activeFileIndex === -1) {
      return null
    }

    return this.currentEnhancedProject.files[this.currentEnhancedProject.activeFileIndex] || null
  }

  /**
   * Check if project has unsaved changes
   */
  isDirtyProject(): boolean {
    return this.isDirty
  }

  /**
   * Auto-save functionality
   */
  private startAutoSave(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval)
    }

    this.autosaveInterval = setInterval(async () => {
      if (this.isDirty && this.currentProject) {
        try {
          await this.createAutosave()
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }
    }, AUTOSAVE_INTERVAL)
  }

  /**
   * Create autosave backup
   */
  private async createAutosave(): Promise<void> {
    if (!this.db || !this.currentProject) return

    const autosave = {
      id: `autosave_${Date.now()}`,
      projectId: this.currentProject.id,
      timestamp: new Date().toISOString(),
      project: structuredClone(this.currentProject),
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([AUTOSAVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(AUTOSAVE_STORE_NAME)
      
      // Add new autosave
      const addRequest = store.put(autosave)
      
      addRequest.onsuccess = async () => {
        // Clean up old autosaves
        await this.cleanupAutosaves(this.currentProject!.id)
        
        this.dispatchEvent(new CustomEvent('autosave:created', { detail: this.currentProject }))
        resolve()
      }

      addRequest.onerror = () => {
        reject(new Error('Failed to create autosave'))
      }
    })
  }

  /**
   * Clean up old autosave versions
   */
  private async cleanupAutosaves(projectId: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([AUTOSAVE_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(AUTOSAVE_STORE_NAME)
      const index = store.index('projectId')
      const request = index.getAll(projectId)

      request.onsuccess = () => {
        const autosaves = request.result
        if (autosaves.length > MAX_AUTOSAVE_VERSIONS) {
          // Sort by timestamp and remove oldest
          autosaves.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          const toDelete = autosaves.slice(MAX_AUTOSAVE_VERSIONS)
          
          for (const autosave of toDelete) {
            store.delete(autosave.id)
          }
        }
        resolve()
      }

      request.onerror = () => {
        resolve() // Don't fail if cleanup fails
      }
    })
  }

  /**
   * Export to CSV format for ML training
   */
  private exportToCSV(project: SimpleProject, _options: ExportOptions): string {
    if (!project.pointCloud) {
      throw new Error('No point cloud data to export')
    }

    const lines: string[] = []
    const headers = ['x', 'y', 'z']
    
    if (project.pointCloud.colors) {
      headers.push('r', 'g', 'b')
    }
    
    headers.push('label_id', 'label_name')
    lines.push(headers.join(','))

    const positions = project.pointCloud.positions
    const colors = project.pointCloud.colors
    const pointCount = positions.length / 3

    for (let i = 0; i < pointCount; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      
      const row = [(x ?? 0).toString(), (y ?? 0).toString(), (z ?? 0).toString()]

      if (colors) {
        const r = colors[i * 3] ?? 0
        const g = colors[i * 3 + 1] ?? 0
        const b = colors[i * 3 + 2] ?? 0
        row.push(r.toString(), g.toString(), b.toString())
      }
      
      // Find label for this point (placeholder logic)
      const labelId = 'unlabeled'
      const labelName = 'Unlabeled'
      row.push(labelId, labelName)
      
      lines.push(row.join(','))
    }

    return lines.join('\n')
  }

  /**
   * Export to PLY format with labels
   */
  private exportToPLY(project: SimpleProject, _options: ExportOptions): string {
    if (!project.pointCloud) {
      throw new Error('No point cloud data to export')
    }

    const positions = project.pointCloud.positions
    const colors = project.pointCloud.colors
    const pointCount = positions.length / 3

    let header = 'ply\n'
    header += 'format ascii 1.0\n'
    header += `element vertex ${pointCount}\n`
    header += 'property float x\n'
    header += 'property float y\n'
    header += 'property float z\n'
    
    if (colors) {
      header += 'property uchar red\n'
      header += 'property uchar green\n'
      header += 'property uchar blue\n'
    }
    
    header += 'property int label_id\n'
    header += 'end_header\n'

    const lines = [header]

    for (let i = 0; i < pointCount; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      
      let line = `${x} ${y} ${z}`
      
      if (colors) {
        const r = Math.round((colors[i * 3] ?? 0) * 255)
        const g = Math.round((colors[i * 3 + 1] ?? 0) * 255)
        const b = Math.round((colors[i * 3 + 2] ?? 0) * 255)
        line += ` ${r} ${g} ${b}`
      }
      
      // Add label ID (placeholder)
      line += ' 0'
      
      lines.push(line)
    }

    return lines.join('\n')
  }

  /** Build stable semantic class values, with the medical binary labels fixed. */
  private createLabelValueMap(labels: Label[]): Map<string, number> {
    const values = new Map<string, number>()
    const healthy = labels.find(label => label.name.trim().toLowerCase() === 'healthy')
    const lesion = labels.find(label => label.name.trim().toLowerCase() === 'lesion')

    if (healthy) values.set(healthy.id, 0)
    if (lesion) values.set(lesion.id, 1)

    let nextValue = healthy || lesion ? 2 : 0
    for (const label of labels) {
      if (!values.has(label.id)) {
        values.set(label.id, nextValue++)
      }
    }

    return values
  }

  /** Convert saved selection groups into one semantic label value per point. */
  private createPointLabelArray(
    pointCount: number,
    selections: Selection[],
    labelValues: ReadonlyMap<string, number>,
  ): Int32Array {
    const pointLabels = new Int32Array(pointCount)
    pointLabels.fill(-1)

    for (const selection of selections) {
      const labelValue = labelValues.get(selection.labelId)
      if (labelValue === undefined) continue

      for (const pointIndex of Array.from(selection.pointIndices as ArrayLike<number>)) {
        if (Number.isInteger(pointIndex) && pointIndex >= 0 && pointIndex < pointCount) {
          pointLabels[pointIndex] = labelValue
        }
      }
    }

    return pointLabels
  }

  private exportEnhancedToCSV(
    pointCloud: PointCloudData,
    labels: Label[],
    labelValues: ReadonlyMap<string, number>,
    pointLabels: Int32Array,
  ): string {
    const labelsByValue = new Map<number, Label>()
    for (const label of labels) {
      const value = labelValues.get(label.id)
      if (value !== undefined) labelsByValue.set(value, label)
    }

    const hasColors = !!pointCloud.colors
    const headers = ['x', 'y', 'z']
    if (hasColors) headers.push('r', 'g', 'b')
    headers.push('label', 'label_name', 'label_id')

    const lines = [headers.join(',')]
    const pointCount = Math.floor(pointCloud.positions.length / 3)

    for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
      const offset = pointIndex * 3
      const row = [
        String(pointCloud.positions[offset] ?? 0),
        String(pointCloud.positions[offset + 1] ?? 0),
        String(pointCloud.positions[offset + 2] ?? 0),
      ]

      if (hasColors && pointCloud.colors) {
        row.push(
          String(this.toColorByte(pointCloud.colors[offset] ?? 0)),
          String(this.toColorByte(pointCloud.colors[offset + 1] ?? 0)),
          String(this.toColorByte(pointCloud.colors[offset + 2] ?? 0)),
        )
      }

      const labelValue = pointLabels[pointIndex] ?? -1
      const label = labelsByValue.get(labelValue)
      row.push(
        String(labelValue),
        this.escapeCSV(label?.name || 'unlabeled'),
        this.escapeCSV(label?.id || ''),
      )
      lines.push(row.join(','))
    }

    return lines.join('\n')
  }

  private exportEnhancedToPLY(
    pointCloud: PointCloudData,
    labels: Label[],
    labelValues: ReadonlyMap<string, number>,
    pointLabels: Int32Array,
  ): string {
    const pointCount = Math.floor(pointCloud.positions.length / 3)
    const hasColors = !!pointCloud.colors
    const header = [
      'ply',
      'format ascii 1.0',
      'comment generated_by 3d-pointcloud-labelling-tool',
      'comment label_map -1 unlabeled',
      ...labels.flatMap(label => {
        const value = labelValues.get(label.id)
        if (value === undefined) return []
        const safeName = label.name.replace(/[\r\n]+/g, ' ').trim()
        const safeId = label.id.replace(/[\r\n]+/g, ' ').trim()
        return [`comment label_map ${value} ${safeName} label_id=${safeId}`]
      }),
      `element vertex ${pointCount}`,
      'property float x',
      'property float y',
      'property float z',
      ...(hasColors ? [
        'property uchar red',
        'property uchar green',
        'property uchar blue',
      ] : []),
      'property int label',
      'end_header',
    ]

    const lines = [header.join('\n')]
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
      const offset = pointIndex * 3
      const values: Array<string | number> = [
        pointCloud.positions[offset] ?? 0,
        pointCloud.positions[offset + 1] ?? 0,
        pointCloud.positions[offset + 2] ?? 0,
      ]

      if (hasColors && pointCloud.colors) {
        values.push(
          this.toColorByte(pointCloud.colors[offset] ?? 0),
          this.toColorByte(pointCloud.colors[offset + 1] ?? 0),
          this.toColorByte(pointCloud.colors[offset + 2] ?? 0),
        )
      }

      values.push(pointLabels[pointIndex] ?? -1)
      lines.push(values.join(' '))
    }

    return `${lines.join('\n')}\n`
  }

  private toColorByte(value: number): number {
    return Math.round(Math.min(1, Math.max(0, value)) * 255)
  }

  private escapeCSV(value: string): string {
    if (!/[",\r\n]/.test(value)) return value
    return `"${value.replace(/"/g, '""')}"`
  }

  /**
   * Export to LAS format (simplified)
   */
  private exportToLAS(_project: SimpleProject, _options: ExportOptions): ArrayBuffer {
    // Simplified LAS export - in practice this would be much more complex
    const encoder = new TextEncoder()
    return encoder.encode('LAS export not yet implemented - use PLY format').buffer
  }

  /**
   * Export annotations for ML training
   */
  private exportAnnotations(project: SimpleProject, _options: ExportOptions): string {
    const annotations = {
      metadata: project.metadata,
      labels: project.labels,
      statistics: project.metadata.statistics,
      created_at: new Date().toISOString(),
      format_version: '1.0',
    }

    return JSON.stringify(annotations, null, 2)
  }

  /**
   * Validate project structure
   */
  private validateProjectStructure(project: any): project is SimpleProject {
    return (
      project &&
      typeof project.id === 'string' &&
      project.metadata &&
      typeof project.metadata.name === 'string' &&
      Array.isArray(project.labels)
    )
  }

  /**
   * Update project statistics
   */
  private updateProjectStatistics(project: SimpleProject): void {
    const totalPoints = project.pointCloud ? project.pointCloud.positions.length / 3 : 0
    const totalLabels = project.labels.length
    
    // Calculate labeled points (placeholder logic)
    const labeledPoints = 0 // TODO: Implement based on actual selections
    const completionPercentage = totalPoints > 0 ? (labeledPoints / totalPoints) * 100 : 0

    project.metadata.statistics = {
      totalPoints,
      labeledPoints,
      totalLabels,
      totalFiles: 0,
      completionPercentage,
    }
  }

  /**
   * Mark project as dirty (needing save)
   */
  private markDirty(): void {
    this.isDirty = true
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval)
      this.autosaveInterval = null
    }

    if (this.db) {
      this.db.close()
      this.db = null
    }

    this.isinitialised = false
    this.currentProject = null
    this.isDirty = false
  }

  /**
   * Clear all projects and autosaves from browser storage
   * WARNING: This will permanently delete all stored projects!
   */
  async clearAllData(): Promise<void> {
    if (!this.db) {
      throw new Error('Project manager not initialised')
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECT_STORE_NAME, AUTOSAVE_STORE_NAME], 'readwrite')
      
      // Clear projects store
      const projectStore = transaction.objectStore(PROJECT_STORE_NAME)
      projectStore.clear()

      // Clear autosave store
      const autosaveStore = transaction.objectStore(AUTOSAVE_STORE_NAME)
      autosaveStore.clear()

      transaction.oncomplete = () => {
        // Reset current project state
        this.currentProject = null
        this.currentEnhancedProject = null
        this.isDirty = false
        
        // Clear label manager
        labelManager.clearAllLabels()
        
        resolve()
      }

      transaction.onerror = () => {
        const error = new Error('Failed to clear project data')
        this.dispatchEvent(new CustomEvent('error', { detail: error }))
        reject(error)
      }
    })
  }

  /**
   * Delete the entire IndexedDB database (nuclear option)
   * This will require re-initialisation of the project manager
   */
  async clearAllDataAndReset(): Promise<void> {
    // Close current connection
    if (this.db) {
      this.db.close()
      this.db = null
    }

    // Delete the entire database
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME)
      
      deleteRequest.onsuccess = () => {
        this.isinitialised = false
        this.currentProject = null
        this.currentEnhancedProject = null
        this.isDirty = false
        
        if (this.autosaveInterval) {
          clearInterval(this.autosaveInterval)
          this.autosaveInterval = null
        }
        
        // Clear label manager
        labelManager.clearAllLabels()
        
        resolve()
      }

      deleteRequest.onerror = () => {
        const error = new Error('Failed to delete project database')
        reject(error)
      }

      deleteRequest.onblocked = () => {
        const error = new Error('Database deletion blocked - close all tabs and try again')
        reject(error)
      }
    })
  }
}

// Export singleton instance
export const projectManager = new ProjectManager()

// initialise on module load
projectManager.initialise().catch(console.error)

export default projectManager
