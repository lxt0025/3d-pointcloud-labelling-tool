/**
 * Test Utilities and Validation Functions
 * 
 * Provides comprehensive testing utilities for the point cloud labelling tool including:
 * - Data validation functions
 * - Performance testing utilities
 * - File format validation
 * - Error simulation and handling
 * - Integration test helpers
 */

import * as THREE from 'three'
import type { 
  PointCloudData, 
  Label, 
  Selection, 
  PerformanceMetrics,
  PointCloudFormat,
  FileValidationResult,
} from '../types/index'

export interface TestConfig {
  /** Enable performance logging */
  enablePerformanceLogging: boolean
  /** Enable memory tracking */
  enableMemoryTracking: boolean
  /** Simulate slow operations */
  simulateSlowOperations: boolean
  /** Memory threshold for warnings (MB) */
  memoryWarningThreshold: number
  /** FPS threshold for warnings */
  fpsWarningThreshold: number
}

export interface TestResult {
  /** Test name */
  name: string
  /** Test passed */
  passed: boolean
  /** Test duration (ms) */
  duration: number
  /** Error message if failed */
  error?: string
  /** Additional test data */
  data?: Record<string, unknown>
}

export interface PerformanceTestResult extends TestResult {
  /** Performance metrics */
  metrics: PerformanceMetrics
  /** Memory usage before test */
  memoryBefore: number
  /** Memory usage after test */
  memoryAfter: number
  /** Memory leak detected */
  memoryLeak: boolean
}

export class TestUtils {
  private config: TestConfig
  private testResults: TestResult[] = []
  private performanceResults: PerformanceTestResult[] = []

  constructor(config?: Partial<TestConfig>) {
    this.config = {
      enablePerformanceLogging: true,
      enableMemoryTracking: true,
      simulateSlowOperations: false,
      memoryWarningThreshold: 512, // 512MB
      fpsWarningThreshold: 30,
      ...config,
    }
  }

  /**
   * Validate point cloud data structure
   */
  public validatePointCloudData(pointCloud: PointCloudData): TestResult {
    const startTime = performance.now()
    const testName = 'Point Cloud Data Validation'
    
    try {
      // Check required properties
      if (!pointCloud.id) {
        throw new Error('Point cloud missing ID')
      }
      
      if (!pointCloud.metadata) {
        throw new Error('Point cloud missing metadata')
      }
      
      if (!pointCloud.positions || pointCloud.positions.length === 0) {
        throw new Error('Point cloud missing or empty positions array')
      }
      
      // Validate positions array
      if (pointCloud.positions.length % 3 !== 0) {
        throw new Error('Positions array length must be divisible by 3')
      }
      
      // Check for NaN or infinite values
      const hasInvalidValues = Array.from(pointCloud.positions).some(value => 
        !isFinite(value) || isNaN(value),
      )
      
      if (hasInvalidValues) {
        throw new Error('Positions array contains NaN or infinite values')
      }
      
      // Validate colors if present
      if (pointCloud.colors) {
        if (pointCloud.colors.length !== pointCloud.positions.length) {
          throw new Error('Colors array length must match positions array length')
        }
        
        const hasInvalidColors = Array.from(pointCloud.colors).some(value => 
          value < 0 || value > 1 || !isFinite(value) || isNaN(value),
        )
        
        if (hasInvalidColors) {
          throw new Error('Colors array contains invalid values (must be 0-1)')
        }
      }
      
      // Validate normals if present
      if (pointCloud.normals) {
        if (pointCloud.normals.length !== pointCloud.positions.length) {
          throw new Error('Normals array length must match positions array length')
        }
      }
      
      // Validate metadata
      const pointCount = pointCloud.positions.length / 3
      if (pointCloud.metadata.pointCount !== pointCount) {
        console.warn(`Metadata point count (${pointCloud.metadata.pointCount}) doesn't match actual count (${pointCount})`)
      }
      
      const duration = performance.now() - startTime
      const result: TestResult = {
        name: testName,
        passed: true,
        duration,
        data: {
          pointCount,
          hasColors: !!pointCloud.colors,
          hasNormals: !!pointCloud.normals,
          memoryUsage: this.estimatePointCloudMemoryUsage(pointCloud),
        },
      }
      
      this.testResults.push(result)
      return result
      
    } catch (error) {
      const duration = performance.now() - startTime
      const result: TestResult = {
        name: testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      
      this.testResults.push(result)
      return result
    }
  }

  /**
   * Validate file format and structure
   */
  public validateFileFormat(file: File, expectedFormat: PointCloudFormat): FileValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check file extension
    const fileExtension = (`.${  file.name.split('.').pop()?.toLowerCase()}`) as PointCloudFormat
    if (fileExtension !== expectedFormat) {
      errors.push(`File extension ${fileExtension} does not match expected format ${expectedFormat}`)
    }
    
    // Check file size
    const maxFileSize = 200 * 1024 * 1024 // 200MB
    if (file.size > maxFileSize) {
      errors.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (200MB)`)
    }
    
    if (file.size < 1024) {
      warnings.push('File size is very small, may not contain sufficient point cloud data')
    }
    
    // Check file name
    if (file.name.length > 255) {
      errors.push('File name is too long')
    }
    
    if (!/^[\w\-. ]+$/.test(file.name)) {
      warnings.push('File name contains special characters that may cause issues')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      },
    }
  }

  /**
   * Test rendering performance
   */
  public async testRenderingPerformance(
    pointCloud: PointCloudData,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): Promise<PerformanceTestResult> {
    const testName = 'Rendering Performance Test'
    const startTime = performance.now()
    const memoryBefore = this.getMemoryUsage()
    
    try {
      // Create test geometry
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(pointCloud.positions, 3))
      
      if (pointCloud.colors) {
        geometry.setAttribute('color', new THREE.BufferAttribute(pointCloud.colors, 3))
      }
      
      const material = new THREE.PointsMaterial({
        size: 2,
        vertexColors: !!pointCloud.colors,
      })
      
      const points = new THREE.Points(geometry, material)
      scene.add(points)
      
      // Render multiple frames to get average performance
      const frameCount = 60
      const frameMetrics: PerformanceMetrics[] = []
      
      for (let i = 0; i < frameCount; i++) {
        const frameStart = performance.now()
        
        // Rotate camera for varied rendering load
        camera.position.x = Math.cos(i * 0.1) * 10
        camera.position.z = Math.sin(i * 0.1) * 10
        camera.lookAt(0, 0, 0)
        
        renderer.render(scene, camera)
        
        const frameEnd = performance.now()
        const frameTime = frameEnd - frameStart
        
        frameMetrics.push({
          fps: 1000 / frameTime,
          frameTime,
          memoryUsage: this.getMemoryUsage(),
          pointCount: pointCloud.positions.length / 3,
        })
        
        // Simulate delay if testing slow operations
        if (this.config.simulateSlowOperations) {
          await this.delay(16) // ~60fps
        }
      }
      
      // Clean up
      scene.remove(points)
      geometry.dispose()
      material.dispose()
      
      // Calculate average metrics
      const avgMetrics: PerformanceMetrics = {
        fps: frameMetrics.reduce((sum, m) => sum + m.fps, 0) / frameCount,
        frameTime: frameMetrics.reduce((sum, m) => sum + m.frameTime, 0) / frameCount,
        memoryUsage: frameMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / frameCount,
        pointCount: pointCloud.positions.length / 3,
      }
      
      const duration = performance.now() - startTime
      const memoryAfter = this.getMemoryUsage()
      const memoryLeak = memoryAfter > memoryBefore + 10 // 10MB threshold
      
      const result: PerformanceTestResult = {
        name: testName,
        passed: avgMetrics.fps >= this.config.fpsWarningThreshold,
        duration,
        metrics: avgMetrics,
        memoryBefore,
        memoryAfter,
        memoryLeak,
        data: {
          frameCount,
          minFPS: Math.min(...frameMetrics.map(m => m.fps)),
          maxFPS: Math.max(...frameMetrics.map(m => m.fps)),
          memoryDelta: memoryAfter - memoryBefore,
        },
      }
      
      this.performanceResults.push(result)
      return result
      
    } catch (error) {
      const duration = performance.now() - startTime
      const memoryAfter = this.getMemoryUsage()
      
      const result: PerformanceTestResult = {
        name: testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          fps: 0,
          frameTime: 0,
          memoryUsage: memoryAfter,
          pointCount: 0,
        },
        memoryBefore,
        memoryAfter,
        memoryLeak: false,
      }
      
      this.performanceResults.push(result)
      return result
    }
  }

  /**
   * Test label operations
   */
  public testLabelOperations(labels: Label[]): TestResult {
    const startTime = performance.now()
    const testName = 'Label Operations Test'
    
    try {
      // Test label uniqueness
      const labelIds = labels.map(l => l.id)
      const uniqueIds = new Set(labelIds)
      if (labelIds.length !== uniqueIds.size) {
        throw new Error('Duplicate label IDs found')
      }
      
      // Test label names
      const labelNames = labels.map(l => l.name)
      const uniqueNames = new Set(labelNames)
      if (labelNames.length !== uniqueNames.size) {
        throw new Error('Duplicate label names found')
      }
      
      // Test color format
      for (const label of labels) {
        if (!/^#[0-9A-F]{6}$/i.test(label.color)) {
          throw new Error(`Invalid color format for label ${label.name}: ${label.color}`)
        }
      }
      
      // Test point counts
      for (const label of labels) {
        if (label.pointCount < 0) {
          throw new Error(`Negative point count for label ${label.name}`)
        }
      }
      
      const duration = performance.now() - startTime
      const result: TestResult = {
        name: testName,
        passed: true,
        duration,
        data: {
          labelCount: labels.length,
          totalPoints: labels.reduce((sum, l) => sum + l.pointCount, 0),
        },
      }
      
      this.testResults.push(result)
      return result
      
    } catch (error) {
      const duration = performance.now() - startTime
      const result: TestResult = {
        name: testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      
      this.testResults.push(result)
      return result
    }
  }

  /**
   * Test selection operations
   */
  public testSelectionOperations(selections: Selection[], pointCloudSize: number): TestResult {
    const startTime = performance.now()
    const testName = 'Selection Operations Test'
    
    try {
      for (const selection of selections) {
        // Test point indices are valid
        for (const index of selection.pointIndices) {
          if (index < 0 || index >= pointCloudSize) {
            throw new Error(`Invalid point index ${index} in selection ${selection.id}`)
          }
        }
        
        // Test selection has valid label ID
        if (!selection.labelId) {
          throw new Error(`Selection ${selection.id} missing label ID`)
        }
      }
      
      const duration = performance.now() - startTime
      const result: TestResult = {
        name: testName,
        passed: true,
        duration,
        data: {
          selectionCount: selections.length,
          totalSelectedPoints: selections.reduce((sum, s) => sum + s.pointIndices.length, 0),
        },
      }
      
      this.testResults.push(result)
      return result
      
    } catch (error) {
      const duration = performance.now() - startTime
      const result: TestResult = {
        name: testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      
      this.testResults.push(result)
      return result
    }
  }

  /**
   * Generate comprehensive test report
   */
  public generateTestReport(): {
    summary: {
      totalTests: number
      passedTests: number
      failedTests: number
      totalDuration: number
      overallPassed: boolean
    }
    results: TestResult[]
    performanceResults: PerformanceTestResult[]
    recommendations: string[]
    } {
    const allTests = [...this.testResults, ...this.performanceResults]
    const passedTests = allTests.filter(t => t.passed).length
    const failedTests = allTests.length - passedTests
    const totalDuration = allTests.reduce((sum, t) => sum + t.duration, 0)
    
    const recommendations: string[] = []
    
    // Performance recommendations
    const avgFPS = this.performanceResults.length > 0 
      ? this.performanceResults.reduce((sum, r) => sum + r.metrics.fps, 0) / this.performanceResults.length
      : 0
    
    if (avgFPS < this.config.fpsWarningThreshold) {
      recommendations.push('Consider optimizing rendering performance or reducing point cloud size')
    }
    
    // Memory recommendations
    const memoryLeaks = this.performanceResults.filter(r => r.memoryLeak)
    if (memoryLeaks.length > 0) {
      recommendations.push('Memory leaks detected - check for proper cleanup of Three.js objects')
    }
    
    // Failed test recommendations
    if (failedTests > 0) {
      recommendations.push('Some tests failed - review error messages and fix issues before deployment')
    }
    
    return {
      summary: {
        totalTests: allTests.length,
        passedTests,
        failedTests,
        totalDuration,
        overallPassed: failedTests === 0,
      },
      results: this.testResults,
      performanceResults: this.performanceResults,
      recommendations,
    }
  }

  /**
   * Clear test results
   */
  public clearResults(): void {
    this.testResults = []
    this.performanceResults = []
  }

  /**
   * Estimate memory usage of point cloud
   */
  private estimatePointCloudMemoryUsage(pointCloud: PointCloudData): number {
    let memoryUsage = 0
    
    // Positions
    memoryUsage += pointCloud.positions.byteLength
    
    // Colors
    if (pointCloud.colors) {
      memoryUsage += pointCloud.colors.byteLength
    }
    
    // Normals
    if (pointCloud.normals) {
      memoryUsage += pointCloud.normals.byteLength
    }
    
    // Other arrays
    if (pointCloud.intensities) {
      memoryUsage += pointCloud.intensities.byteLength
    }
    
    if (pointCloud.classifications) {
      memoryUsage += pointCloud.classifications.byteLength
    }
    
    return memoryUsage / (1024 * 1024) // Convert to MB
  }

  /**
   * Get current memory usage estimate
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024)
    }
    
    // Fallback estimate
    return 0
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default TestUtils 