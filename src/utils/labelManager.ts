/**
 * Label Management Utilities
 * 
 * This module provides comprehensive label management functionality for the Point Cloud Labelling Tool.
 * It handles label creation, editing, deletion, persistence, color assignment, and validation.
 */

import type { Label, LabelColorPalette } from '../types/index'
import { DEFAULT_LABEL_COLORS } from './constants'

// Local storage keys
const STORAGE_KEYS = {
  LABELS: 'pointcloud_labels',
  COLOR_PALETTE: 'pointcloud_color_palette',
  LABEL_SETTINGS: 'pointcloud_label_settings',
} as const

/**
 * Label Manager Events
 */
export interface LabelManagerEvents {
  'label:created': Label
  'label:updated': Label
  'label:deleted': string
  'labels:imported': Label[]
  'labels:cleared': void
}

/**
 * Label Settings
 */
export interface LabelSettings {
  autoAssignColors: boolean
  allowDuplicateNames: boolean
  defaultColorPalette: 'primary' | 'secondary' | 'custom'
  maxLabels: number
}

/**
 * Event Emitter for Label Management
 */
class LabelManagerEmitter {
  // eslint-disable-next-line @typescript-eslint/ban-types
  private listeners: Map<keyof LabelManagerEvents, Set<Function>> = new Map()

  on<K extends keyof LabelManagerEvents>(event: K, listener: (data: LabelManagerEvents[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  off<K extends keyof LabelManagerEvents>(event: K, listener: (data: LabelManagerEvents[K]) => void): void {
    this.listeners.get(event)?.delete(listener)
  }

  emit<K extends keyof LabelManagerEvents>(event: K, data: LabelManagerEvents[K]): void {
    this.listeners.get(event)?.forEach(listener => listener(data))
  }
}

/**
 * Label Manager Class
 */
export class LabelManager {
  private labels: Map<string, Label> = new Map()
  private colorPalette: LabelColorPalette = DEFAULT_LABEL_COLORS
  private settings: LabelSettings = {
    autoAssignColors: true,
    allowDuplicateNames: false,
    defaultColorPalette: 'primary',
    maxLabels: 50,
  }
  private emitter = new LabelManagerEmitter()
  private colorIndex = 0

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Create a new label
   */
  createLabel(name: string, options?: {
    color?: string
    description?: string
    parentId?: string
  }): Label | null {
    // Validate name
    if (!this.validateLabelName(name)) {
      return null
    }

    // Check for duplicates if not allowed
    if (!this.settings.allowDuplicateNames && this.getLabelByName(name)) {
      throw new Error(`Label with name "${name}" already exists`)
    }

    // Check label limit
    if (this.labels.size >= this.settings.maxLabels) {
      throw new Error(`Maximum number of labels (${this.settings.maxLabels}) reached`)
    }

    // Generate unique ID
    const id = this.generateLabelId()

    // Assign color
    const color = options?.color || this.getNextAvailableColor()

    // Create label
    const label: Label = {
      id,
      name: name.trim(),
      color,
      ...(options?.description?.trim() && { description: options.description.trim() }),
      pointCount: 0,
      visible: true,
      createdAt: new Date(),
      ...(options?.parentId && { parentId: options.parentId }),
      metadata: {
        isBuiltIn: false,
        lastModified: new Date(),
      },
    }

    // Store label
    this.labels.set(id, label)
    this.saveToStorage()

    // Emit event
    this.emitter.emit('label:created', label)

    return label
  }

  /**
   * Update an existing label
   */
  updateLabel(id: string, updates: Partial<Omit<Label, 'id' | 'createdAt'>>): Label | null {
    const label = this.labels.get(id)
    if (!label) {
      return null
    }

    // Validate name if being updated
    if (updates.name && !this.validateLabelName(updates.name)) {
      return null
    }

    // Check for name duplicates if not allowed
    if (updates.name && !this.settings.allowDuplicateNames) {
      const existingLabel = this.getLabelByName(updates.name)
      if (existingLabel && existingLabel.id !== id) {
        throw new Error(`Label with name "${updates.name}" already exists`)
      }
    }

    // Apply updates
    const updatedLabel: Label = {
      ...label,
      ...updates,
      metadata: {
        ...label.metadata,
        lastModified: new Date(),
      },
    }

    this.labels.set(id, updatedLabel)
    this.saveToStorage()

    // Emit event
    this.emitter.emit('label:updated', updatedLabel)

    return updatedLabel
  }

  /**
   * Delete a label
   */
  deleteLabel(id: string): boolean {
    const label = this.labels.get(id)
    if (!label) {
      return false
    }

    // Check if label is being used (has points assigned)
    if (label.pointCount > 0) {
      const confirmed = confirm(
        `Label "${label.name}" has ${label.pointCount} points assigned. Are you sure you want to delete it?`,
      )
      if (!confirmed) {
        return false
      }
    }

    // Delete child labels if any
    const childLabels = this.getChildLabels(id)
    childLabels.forEach(child => {
      this.labels.delete(child.id)
    })

    this.labels.delete(id)
    this.saveToStorage()

    // Emit event
    this.emitter.emit('label:deleted', id)

    return true
  }

  /**
   * Get all labels
   */
  getAllLabels(): Label[] {
    return Array.from(this.labels.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  /**
   * Get label by ID
   */
  getLabel(id: string): Label | undefined {
    return this.labels.get(id)
  }

  /**
   * Get label by name
   */
  getLabelByName(name: string): Label | undefined {
    return Array.from(this.labels.values()).find(label => 
      label.name.toLowerCase() === name.toLowerCase(),
    )
  }

  /**
   * Get child labels of a parent label
   */
  getChildLabels(parentId: string): Label[] {
    return Array.from(this.labels.values()).filter(label => label.parentId === parentId)
  }

  /**
   * Get root labels (no parent)
   */
  getRootLabels(): Label[] {
    return Array.from(this.labels.values()).filter(label => !label.parentId)
  }

  /**
   * Update label point count
   */
  updateLabelPointCount(id: string, pointCount: number): void {
    const label = this.labels.get(id)
    if (label) {
      label.pointCount = Math.max(0, pointCount)
      this.saveToStorage()
      this.emitter.emit('label:updated', label)
    }
  }

  /**
   * Toggle label visibility
   */
  toggleLabelVisibility(id: string): boolean {
    const label = this.labels.get(id)
    if (label) {
      label.visible = !label.visible
      this.saveToStorage()
      this.emitter.emit('label:updated', label)
      return label.visible
    }
    return false
  }

  /**
   * Clear all labels
   */
  clearAllLabels(): void {
    this.labels.clear()
    this.saveToStorage()
    this.emitter.emit('labels:cleared', undefined)
  }

  /**
   * Import labels from array
   */
  importLabels(labelsData: Partial<Label>[], options?: {
    replaceExisting?: boolean
    skipDuplicates?: boolean
  }): Label[] {
    const importedLabels: Label[] = []

    if (options?.replaceExisting) {
      this.clearAllLabels()
    }

    for (const labelData of labelsData) {
      if (!labelData.name) continue

      try {
        // Check for duplicates
        if (options?.skipDuplicates && this.getLabelByName(labelData.name)) {
          continue
        }

        const createOptions: {
          color?: string
          description?: string
          parentId?: string
        } = {}
        
        if (labelData.color) createOptions.color = labelData.color
        if (labelData.description) createOptions.description = labelData.description
        if (labelData.parentId) createOptions.parentId = labelData.parentId
        
        const label = this.createLabel(labelData.name, createOptions)

        if (label) {
          importedLabels.push(label)
        }
      } catch (error) {
        console.warn(`Failed to import label "${labelData.name}":`, error)
      }
    }

    this.emitter.emit('labels:imported', importedLabels)
    return importedLabels
  }

  /**
   * Export labels to array
   */
  exportLabels(): Label[] {
    return this.getAllLabels()
  }

  /**
   * Get label statistics
   */
  getStatistics() {
    const labels = this.getAllLabels()
    const totalPoints = labels.reduce((sum, label) => sum + label.pointCount, 0)
    const visibleLabels = labels.filter(label => label.visible).length
    const labelsWithPoints = labels.filter(label => label.pointCount > 0).length

    return {
      totalLabels: labels.length,
      visibleLabels,
      labelsWithPoints,
      totalPoints,
      averagePointsPerLabel: labels.length > 0 ? totalPoints / labels.length : 0,
      colorUtilization: this.getColorUtilization(),
    }
  }

  /**
   * Event subscription methods
   */
  on<K extends keyof LabelManagerEvents>(event: K, listener: (data: LabelManagerEvents[K]) => void): void {
    this.emitter.on(event, listener)
  }

  off<K extends keyof LabelManagerEvents>(event: K, listener: (data: LabelManagerEvents[K]) => void): void {
    this.emitter.off(event, listener)
  }

  /**
   * Get or set color palette
   */
  getColorPalette(): LabelColorPalette {
    return { ...this.colorPalette }
  }

  setColorPalette(palette: Partial<LabelColorPalette>): void {
    this.colorPalette = { ...this.colorPalette, ...palette }
    this.saveToStorage()
  }

  /**
   * Get or set settings
   */
  getSettings(): LabelSettings {
    return { ...this.settings }
  }

  updateSettings(newSettings: Partial<LabelSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    this.saveToStorage()
  }

  // Private methods

  private validateLabelName(name: string): boolean {
    if (!name || typeof name !== 'string') return false
    const trimmed = name.trim()
    if (trimmed.length === 0) return false
    if (trimmed.length > 50) return false
    // Check for invalid characters
    if (!/^[\w\s\-_.()]+$/.test(trimmed)) return false
    return true
  }

  private generateLabelId(): string {
    return `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getNextAvailableColor(): string {
    if (!this.settings.autoAssignColors) {
      return '#888888' // Default gray
    }

    const paletteKey = this.settings.defaultColorPalette
    const colors = this.colorPalette[paletteKey] || this.colorPalette.primary

    // Find first unused color
    const usedColors = new Set(Array.from(this.labels.values()).map(label => label.color))
    
    for (const color of colors) {
      if (!usedColors.has(color)) {
        return color
      }
    }

    // If all colors are used, cycle through them
    const color = colors[this.colorIndex % colors.length] || '#888888'
    this.colorIndex++
    return color
  }

  private getColorUtilization(): number {
    const usedColors = new Set(Array.from(this.labels.values()).map(label => label.color))
    const totalColors = this.colorPalette.primary.length + this.colorPalette.secondary.length
    return totalColors > 0 ? usedColors.size / totalColors : 0
  }

  private loadFromStorage(): void {
    try {
      // Load labels
      const labelsData = localStorage.getItem(STORAGE_KEYS.LABELS)
      if (labelsData) {
        const labels: Label[] = JSON.parse(labelsData)
        labels.forEach(label => {
          // Convert date strings back to Date objects
          label.createdAt = new Date(label.createdAt)
          if (label.metadata?.lastModified) {
            label.metadata.lastModified = new Date(label.metadata.lastModified as string)
          } else if (label.metadata) {
            label.metadata.lastModified = new Date()
          }
          this.labels.set(label.id, label)
        })
      }

      // Load color palette
      const paletteData = localStorage.getItem(STORAGE_KEYS.COLOR_PALETTE)
      if (paletteData) {
        this.colorPalette = { ...this.colorPalette, ...JSON.parse(paletteData) }
      }

      // Load settings
      const settingsData = localStorage.getItem(STORAGE_KEYS.LABEL_SETTINGS)
      if (settingsData) {
        this.settings = { ...this.settings, ...JSON.parse(settingsData) }
      }
    } catch (error) {
      console.warn('Failed to load labels from storage:', error)
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LABELS, JSON.stringify(this.getAllLabels()))
      localStorage.setItem(STORAGE_KEYS.COLOR_PALETTE, JSON.stringify(this.colorPalette))
      localStorage.setItem(STORAGE_KEYS.LABEL_SETTINGS, JSON.stringify(this.settings))
    } catch (error) {
      console.warn('Failed to save labels to storage:', error)
    }
  }
}

// Global label manager instance
export const labelManager = new LabelManager()

// Export utility functions
export function createDefaultLabels(): Label[] {
  const defaultLabelNames = [
    'Car',
    'Building', 
    'Person',
    'Tree',
    'Road',
    'Sidewalk',
  ]

  const createdLabels: Label[] = []

  defaultLabelNames.forEach(name => {
    try {
      const label = labelManager.createLabel(name)
      if (label) {
        createdLabels.push(label)
      }
    } catch (error) {
      console.warn(`Failed to create default label "${name}":`, error)
    }
  })

  return createdLabels
}

export function resetToDefaultLabels(): Label[] {
  labelManager.clearAllLabels()
  return createDefaultLabels()
} 