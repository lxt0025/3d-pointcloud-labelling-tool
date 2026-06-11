/**
 * File Processing Utilities
 * 
 * This module provides the main file processing functionality for the Point Cloud Labelling Tool.
 * It handles file validation, format detection, and coordinates with Web Workers for parsing.
 * 
 * Supported formats:
 * - PLY (Stanford Triangle Format) - Binary and ASCII
 * - E57 (ASTM E57 Format) - Structured 3D data
 * - PCD (Point Cloud Data) - PCL format
 * - XYZ (Simple text format) - Basic coordinate data
 */

import { Vector3 } from 'three'
import type { PointCloudData, FileProcessingProgress, FileValidationResult, BoundingBox } from '../types/index'
import { SUPPORTED_FORMATS, FILE_VALIDATION } from './constants'

// Web Worker instances for background processing
let plyWorker: Worker | null = null
let e57Worker: Worker | null = null

/**
 * File Processing Events
 */
export interface FileProcessingEvents {
  'progress': FileProcessingProgress
  'complete': PointCloudData
  'error': Error
}

/**
 * Event Emitter for File Processing
 */
class FileProcessingEmitter {
  // eslint-disable-next-line @typescript-eslint/ban-types
  private listeners: Map<keyof FileProcessingEvents, Set<Function>> = new Map()

  on<K extends keyof FileProcessingEvents>(event: K, listener: (data: FileProcessingEvents[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  off<K extends keyof FileProcessingEvents>(event: K, listener: (data: FileProcessingEvents[K]) => void): void {
    this.listeners.get(event)?.delete(listener)
  }

  emit<K extends keyof FileProcessingEvents>(event: K, data: FileProcessingEvents[K]): void {
    this.listeners.get(event)?.forEach(listener => listener(data))
  }
}

/**
 * Validate uploaded file
 */
export function validateFile(file: File): FileValidationResult {
  const result: FileValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    },
  }

  // Check file size
  if (file.size > FILE_VALIDATION.maxFileSize) {
    result.isValid = false
    result.errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(FILE_VALIDATION.maxFileSize)})`)
  }

  if (file.size === 0) {
    result.isValid = false
    result.errors.push('File is empty')
  }

  // Check file extension
  const extension = getFileExtension(file.name).toLowerCase()
  if (!FILE_VALIDATION.supportedExtensions.includes(extension as '.ply' | '.e57' | '.pcd' | '.xyz')) {
    result.isValid = false
    result.errors.push(`Unsupported file format: ${extension}. Supported formats: ${FILE_VALIDATION.supportedExtensions.join(', ')}`)
  }

  // Format-specific validation
  const formatInfo = SUPPORTED_FORMATS[extension as keyof typeof SUPPORTED_FORMATS]
  if (formatInfo) {
    if (file.size > formatInfo.maxSize) {
      result.isValid = false
      result.errors.push(`File size exceeds format limit for ${formatInfo.name} (${formatFileSize(formatInfo.maxSize)})`)
    }

    if (file.type && !(formatInfo.mimeTypes as readonly string[]).includes(file.type)) {
      result.warnings.push(`File MIME type (${file.type}) may not match expected format`)
    }
  }

  return result
}

/**
 * Process uploaded file
 */
export async function processFile(
  file: File,
  onProgress?: (progress: FileProcessingProgress) => void,
  onComplete?: (pointCloud: PointCloudData) => void,
  onError?: (error: Error) => void,
): Promise<PointCloudData> {
  return new Promise((resolve, reject) => {
    // Validate file first
    const validation = validateFile(file)
    if (!validation.isValid) {
      const error = new Error(`File validation failed: ${validation.errors.join(', ')}`)
      onError?.(error)
      reject(error)
      return
    }

    // Show validation warnings
    if (validation.warnings.length > 0) {
      console.warn('File validation warnings:', validation.warnings)
    }

    // Detect file format
    const extension = getFileExtension(file.name).toLowerCase()
    const emitter = new FileProcessingEmitter()

    // Set up event listeners
    if (onProgress) emitter.on('progress', onProgress)
    if (onComplete) emitter.on('complete', onComplete)
    if (onError) emitter.on('error', onError)

    // Process based on file format
    switch (extension) {
      case '.ply':
        processPLYFile(file, emitter)
          .then(resolve)
          .catch(reject)
        break
        
      case '.e57':
        processE57File(file, emitter)
          .then(resolve)
          .catch(reject)
        break
        
      case '.pcd':
        processPCDFile(file, emitter)
          .then(resolve)
          .catch(reject)
        break
        
      case '.xyz':
        processXYZFile(file, emitter)
          .then(resolve)
          .catch(reject)
        break
        
      default: {
        const error = new Error(`Unsupported file format: ${extension}`)
        emitter.emit('error', error)
        reject(error)
        break
      }
    }
  })
}

/**
 * Process PLY file using Web Worker
 */
async function processPLYFile(file: File, emitter: FileProcessingEmitter): Promise<PointCloudData> {
  return new Promise((resolve, reject) => {
    // initialise PLY worker if not already done
    if (!plyWorker) {
      plyWorker = new Worker(new URL('../workers/plyParser.worker.ts', import.meta.url), {
        type: 'module',
      })
    }

    // Set up worker message handling
    const handleMessage = (e: MessageEvent) => {
      const { type, data } = e.data

      switch (type) {
        case 'progress':
          emitter.emit('progress', data)
          break
          
        case 'complete':
          emitter.emit('complete', data)
          cleanup()
          resolve(data)
          break
          
        case 'error':
          emitter.emit('error', new Error(data.message))
          cleanup()
          reject(new Error(data.message))
          break
      }
    }

    const handleError = (error: ErrorEvent) => {
      emitter.emit('error', new Error(`PLY Worker error: ${error.message}`))
      cleanup()
      reject(new Error(`PLY Worker error: ${error.message}`))
    }

    const cleanup = () => {
      plyWorker?.removeEventListener('message', handleMessage)
      plyWorker?.removeEventListener('error', handleError)
    }

    plyWorker.addEventListener('message', handleMessage)
    plyWorker.addEventListener('error', handleError)

    // Send file to worker
    plyWorker.postMessage({
      type: 'parse',
      file,
      fileName: file.name,
    })
  })
}

/**
 * Process E57 file using Web Worker
 */
async function processE57File(_file: File, emitter: FileProcessingEmitter): Promise<PointCloudData> {
  return new Promise((_resolve, reject) => {
    // E57 format is extremely complex and requires specialized parsing libraries
    // For now, we'll provide a clear error message instead of fake data
    
    emitter.emit('progress', {
      stage: 'parsing',
      progress: 0.1,
      message: 'Analyzing E57 file...',
      pointsProcessed: 0,
      totalPoints: 0,
    })

    const error = new Error(
      'E57 format is not yet fully supported. E57 files use a complex XML+binary structure that requires specialized parsing libraries. ' +
      'For now, please convert your E57 files to PLY format using tools like CloudCompare, MeshLab, or similar point cloud software. ' +
      'PLY format is fully supported and will give you the best results for labeling.',
    )
    
    emitter.emit('error', error)
    reject(error)
  })
}

/**
 * Process PCD file (simplified implementation)
 */
async function processPCDFile(_file: File, emitter: FileProcessingEmitter): Promise<PointCloudData> {
  return new Promise((_resolve, reject) => {
    const error = new Error('PCD format parsing is not yet implemented. Please use PLY format for now.')
    emitter.emit('error', error)
    reject(error)
  })
}

/**
 * Process XYZ file (simple text format)
 */
async function processXYZFile(file: File, emitter: FileProcessingEmitter): Promise<PointCloudData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      try {
        const text = reader.result as string
        const lines = text.split('\n').filter(line => line.trim())
        
        emitter.emit('progress', {
          stage: 'parsing',
          progress: 0.1,
          message: 'Reading XYZ file...',
          pointsProcessed: 0,
          totalPoints: lines.length,
        })

        const positions: number[] = []
        const colors: number[] = []
        let hasColors = false

        for (let i = 0; i < lines.length; i++) {
          const parts = (lines[i] ?? '').trim().split(/\s+/)

          if (parts.length >= 3) {
            positions.push(
              parseFloat(parts[0] ?? '0'),
              parseFloat(parts[1] ?? '0'),
              parseFloat(parts[2] ?? '0'),
            )

            if (parts.length >= 6) {
              hasColors = true
              colors.push(
                parseFloat(parts[3] ?? '255') / 255,
                parseFloat(parts[4] ?? '255') / 255,
                parseFloat(parts[5] ?? '255') / 255,
              )
            } else if (hasColors) {
              colors.push(1, 1, 1)
            }
          }

          // Report progress
          if (i % 10000 === 0) {
            emitter.emit('progress', {
              stage: 'parsing',
              progress: (i / lines.length) * 0.8,
              message: `Processing point ${i + 1} of ${lines.length}...`,
              pointsProcessed: i,
              totalPoints: lines.length,
            })
          }
        }

        const bounds = calculateBounds(positions)
        const pointCount = positions.length / 3
        const now = new Date()
        const pointCloud: PointCloudData = {
          id: `xyz_${Date.now()}`,
          positions: new Float32Array(positions),
          ...(hasColors ? { colors: new Float32Array(colors) } : {}),
          metadata: {
            filename: file.name,
            format: '.xyz',
            pointCount,
            fileSize: file.size,
            hasColors,
            hasNormals: false,
            hasTextureCoords: false,
            boundingBox: bounds,
            createdAt: now,
            lastModified: now,
          },
        }

        emitter.emit('progress', {
          stage: 'complete',
          progress: 1,
          message: 'XYZ file processed successfully',
          pointsProcessed: pointCount,
          totalPoints: pointCount,
        })

        emitter.emit('complete', pointCloud)
        resolve(pointCloud)

      } catch (error) {
        const err = new Error(`Failed to parse XYZ file: ${error}`)
        emitter.emit('error', err)
        reject(err)
      }
    }

    reader.onerror = () => {
      const error = new Error('Failed to read file')
      emitter.emit('error', error)
      reject(error)
    }

    reader.readAsText(file)
  })
}

/**
 * Calculate bounding box for point cloud
 */
function calculateBounds(positions: number[]): BoundingBox {
  if (positions.length === 0) {
    return {
      min: new Vector3(0, 0, 0),
      max: new Vector3(0, 0, 0),
      center: new Vector3(0, 0, 0),
      size: new Vector3(0, 0, 0),
    }
  }

  let minX = positions[0] ?? 0, minY = positions[1] ?? 0, minZ = positions[2] ?? 0
  let maxX = minX, maxY = minY, maxZ = minZ

  for (let i = 3; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i] ?? 0)
    minY = Math.min(minY, positions[i + 1] ?? 0)
    minZ = Math.min(minZ, positions[i + 2] ?? 0)
    maxX = Math.max(maxX, positions[i] ?? 0)
    maxY = Math.max(maxY, positions[i + 1] ?? 0)
    maxZ = Math.max(maxZ, positions[i + 2] ?? 0)
  }

  const min = new Vector3(minX, minY, minZ)
  const max = new Vector3(maxX, maxY, maxZ)
  return {
    min,
    max,
    center: new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    size: new Vector3(maxX - minX, maxY - minY, maxZ - minZ),
  }
}

/**
 * Utility function to get file extension
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : ''
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Cleanup function to terminate workers
 */
export function cleanupFileProcessing(): void {
  if (plyWorker) {
    plyWorker.terminate()
    plyWorker = null
  }
  
  if (e57Worker) {
    e57Worker.terminate()
    e57Worker = null
  }
} 