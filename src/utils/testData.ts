/**
 * Test Data Generation Utilities
 * 
 * This module provides utilities for generating test point cloud data
 * to help with development and testing of the 3D viewport without
 * requiring actual point cloud files.
 */

import type { PointCloudData, PointCloudMetadata } from '../types/index'
import { Vector3 } from 'three'

/**
 * Generate a simple cube point cloud for testing
 */
export function generateCubePointCloud(): PointCloudData {
  const pointCount = 1000
  const positions = new Float32Array(pointCount * 3)
  const colors = new Float32Array(pointCount * 3)
  
  for (let i = 0; i < pointCount; i++) {
    const i3 = i * 3
    
    // Generate random points within a cube
    positions[i3] = (Math.random() - 0.5) * 10     // x
    positions[i3 + 1] = (Math.random() - 0.5) * 10 // y
    positions[i3 + 2] = (Math.random() - 0.5) * 10 // z
    
    // Generate colors based on position
    colors[i3] = Math.abs(positions[i3] || 0) / 5       // r
    colors[i3 + 1] = Math.abs(positions[i3 + 1] || 0) / 5 // g
    colors[i3 + 2] = Math.abs(positions[i3 + 2] || 0) / 5 // b
  }
  
  const metadata: PointCloudMetadata = {
    filename: 'test-cube.ply',
    format: '.ply',
    pointCount,
    fileSize: pointCount * 24, // 6 floats * 4 bytes
    hasColors: true,
    hasNormals: false,
    hasTextureCoords: false,
    boundingBox: {
      min: new Vector3(-5, -5, -5),
      max: new Vector3(5, 5, 5),
      center: new Vector3(0, 0, 0),
      size: new Vector3(10, 10, 10),
    },
    density: pointCount / 1000, // points per cubic unit
    createdAt: new Date(),
    lastModified: new Date(),
  }
  
  return {
    id: `test-cube-${  Date.now()}`,
    metadata,
    positions,
    colors,
  }
}

/**
 * Generate a sphere point cloud for testing
 */
export function generateSpherePointCloud(): PointCloudData {
  const pointCount = 2000
  const positions = new Float32Array(pointCount * 3)
  const colors = new Float32Array(pointCount * 3)
  const radius = 5
  
  for (let i = 0; i < pointCount; i++) {
    const i3 = i * 3
    
    // Generate random points on sphere surface
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    
    const x = radius * Math.sin(phi) * Math.cos(theta)
    const y = radius * Math.sin(phi) * Math.sin(theta)
    const z = radius * Math.cos(phi)
    
    positions[i3] = x
    positions[i3 + 1] = y
    positions[i3 + 2] = z
    
    // Generate colors based on spherical coordinates
    colors[i3] = (Math.sin(theta) + 1) / 2       // r
    colors[i3 + 1] = (Math.cos(phi) + 1) / 2     // g
    colors[i3 + 2] = (Math.sin(phi) + 1) / 2     // b
  }
  
  const metadata: PointCloudMetadata = {
    filename: 'test-sphere.ply',
    format: '.ply',
    pointCount,
    fileSize: pointCount * 24,
    hasColors: true,
    hasNormals: false,
    hasTextureCoords: false,
    boundingBox: {
      min: new Vector3(-radius, -radius, -radius),
      max: new Vector3(radius, radius, radius),
      center: new Vector3(0, 0, 0),
      size: new Vector3(radius * 2, radius * 2, radius * 2),
    },
    density: pointCount / ((4/3) * Math.PI * radius * radius * radius),
    createdAt: new Date(),
    lastModified: new Date(),
  }
  
  return {
    id: `test-sphere-${  Date.now()}`,
    metadata,
    positions,
    colors,
  }
}

/**
 * Generate a simple building-like structure for testing
 */
export function generateBuildingPointCloud(): PointCloudData {
  const pointCount = 5000
  const positions = new Float32Array(pointCount * 3)
  const colors = new Float32Array(pointCount * 3)
  
  for (let i = 0; i < pointCount; i++) {
    const i3 = i * 3
    
    // Generate building-like structure
    const section = Math.random()
    
    if (section < 0.5) {
      // Ground floor (larger)
      positions[i3] = (Math.random() - 0.5) * 20     // x
      positions[i3 + 1] = Math.random() * 5          // y (0-5)
      positions[i3 + 2] = (Math.random() - 0.5) * 15 // z
      
      // Brown/gray colors for ground floor
      colors[i3] = 0.4 + Math.random() * 0.2
      colors[i3 + 1] = 0.3 + Math.random() * 0.2
      colors[i3 + 2] = 0.2 + Math.random() * 0.2
    } else if (section < 0.8) {
      // Second floor (medium)
      positions[i3] = (Math.random() - 0.5) * 15
      positions[i3 + 1] = 5 + Math.random() * 4       // y (5-9)
      positions[i3 + 2] = (Math.random() - 0.5) * 12
      
      // Lighter colors for upper floors
      colors[i3] = 0.6 + Math.random() * 0.2
      colors[i3 + 1] = 0.5 + Math.random() * 0.2
      colors[i3 + 2] = 0.4 + Math.random() * 0.2
    } else {
      // Top floor (smaller)
      positions[i3] = (Math.random() - 0.5) * 10
      positions[i3 + 1] = 9 + Math.random() * 3       // y (9-12)
      positions[i3 + 2] = (Math.random() - 0.5) * 8
      
      // Roof colors
      colors[i3] = 0.2 + Math.random() * 0.1
      colors[i3 + 1] = 0.1 + Math.random() * 0.1
      colors[i3 + 2] = 0.1 + Math.random() * 0.1
    }
  }
  
  const metadata: PointCloudMetadata = {
    filename: 'test-building.ply',
    format: '.ply',
    pointCount,
    fileSize: pointCount * 24,
    hasColors: true,
    hasNormals: false,
    hasTextureCoords: false,
    boundingBox: {
      min: new Vector3(-10, 0, -10),
      max: new Vector3(10, 12, 10),
      center: new Vector3(0, 6, 0),
      size: new Vector3(20, 12, 20),
    },
    density: pointCount / (20 * 12 * 20),
    createdAt: new Date(),
    lastModified: new Date(),
  }
  
  return {
    id: `test-building-${  Date.now()}`,
    metadata,
    positions,
    colors,
  }
}

/**
 * Generate a simple car-like point cloud for testing
 */
export function generateCarPointCloud(): PointCloudData {
  const pointCount = 3000
  const positions = new Float32Array(pointCount * 3)
  const colors = new Float32Array(pointCount * 3)
  
  for (let i = 0; i < pointCount; i++) {
    const i3 = i * 3
    
    // Generate car-like shape
    const section = Math.random()
    
    if (section < 0.6) {
      // Car body
      positions[i3] = (Math.random() - 0.5) * 4       // x (-2 to 2)
      positions[i3 + 1] = Math.random() * 1.5         // y (0 to 1.5)
      positions[i3 + 2] = (Math.random() - 0.5) * 8   // z (-4 to 4)
      
      // Car body colors (metallic blue/gray)
      colors[i3] = 0.2 + Math.random() * 0.1
      colors[i3 + 1] = 0.3 + Math.random() * 0.2
      colors[i3 + 2] = 0.6 + Math.random() * 0.2
    } else if (section < 0.8) {
      // Windows
      positions[i3] = (Math.random() - 0.5) * 3
      positions[i3 + 1] = 1.5 + Math.random() * 0.8   // y (1.5 to 2.3)
      positions[i3 + 2] = (Math.random() - 0.5) * 4
      
      // Window colors (dark)
      colors[i3] = 0.1 + Math.random() * 0.1
      colors[i3 + 1] = 0.1 + Math.random() * 0.1
      colors[i3 + 2] = 0.1 + Math.random() * 0.1
    } else {
      // Wheels
      const wheelPositions = [
        [-1.5, 0, -2.5], [1.5, 0, -2.5], 
        [-1.5, 0, 2.5], [1.5, 0, 2.5],
      ]
      const wheelIndex = Math.floor(Math.random() * wheelPositions.length)
      const wheelPos = wheelPositions[wheelIndex]
      
      if (wheelPos && wheelPos.length >= 3) {
        const angle = Math.random() * Math.PI * 2
        const radius = 0.5
        const x = wheelPos[0] ?? 0
        const y = wheelPos[1] ?? 0
        const z = wheelPos[2] ?? 0
        positions[i3] = x + Math.cos(angle) * radius
        positions[i3 + 1] = y + Math.sin(angle) * radius
        positions[i3 + 2] = z + (Math.random() - 0.5) * 0.4
      } else {
        // Fallback to default wheel position
        positions[i3] = 0
        positions[i3 + 1] = 0
        positions[i3 + 2] = 0
      }
      
      // Wheel colors (black/dark gray)
      colors[i3] = 0.05 + Math.random() * 0.1
      colors[i3 + 1] = 0.05 + Math.random() * 0.1
      colors[i3 + 2] = 0.05 + Math.random() * 0.1
    }
  }
  
  const metadata: PointCloudMetadata = {
    filename: 'test-car.ply',
    format: '.ply',
    pointCount,
    fileSize: pointCount * 24,
    hasColors: true,
    hasNormals: false,
    hasTextureCoords: false,
    boundingBox: {
      min: new Vector3(-2.5, -0.5, -4.5),
      max: new Vector3(2.5, 2.5, 4.5),
      center: new Vector3(0, 1, 0),
      size: new Vector3(5, 3, 9),
    },
    density: pointCount / (5 * 3 * 9),
    createdAt: new Date(),
    lastModified: new Date(),
  }
  
  return {
    id: `test-car-${  Date.now()}`,
    metadata,
    positions,
    colors,
  }
}

/**
 * Get a random test point cloud
 */
export function getRandomTestPointCloud(): PointCloudData {
  const generators = [
    generateCubePointCloud,
    generateSpherePointCloud,
    generateBuildingPointCloud,
    generateCarPointCloud,
  ]
  
  const randomIndex = Math.floor(Math.random() * generators.length)
  const generator = generators[randomIndex]
  if (generator) {
    return generator()
  }
  // Fallback to cube if something goes wrong
  return generateCubePointCloud()
}

/**
 * Get all available test point clouds
 */
export function getAllTestPointClouds(): PointCloudData[] {
  return [
    generateCubePointCloud(),
    generateSpherePointCloud(),
    generateBuildingPointCloud(),
    generateCarPointCloud(),
  ]
}

/**
 * Generate test XYZ file content that can be downloaded and uploaded
 */
export function generateTestXYZFile(type: 'cube' | 'sphere' | 'building' | 'car' = 'cube'): string {
  let pointCloud: PointCloudData
  
  switch (type) {
    case 'sphere':
      pointCloud = generateSpherePointCloud()
      break
    case 'building':
      pointCloud = generateBuildingPointCloud()
      break
    case 'car':
      pointCloud = generateCarPointCloud()
      break
    case 'cube':
    default:
      pointCloud = generateCubePointCloud()
      break
  }

  // Convert to XYZ format: X Y Z R G B
  const lines: string[] = []
  const hasColors = !!pointCloud.colors
  
  for (let i = 0; i < pointCloud.positions.length; i += 3) {
    const x = pointCloud.positions[i] ?? 0
    const y = pointCloud.positions[i + 1] ?? 0
    const z = pointCloud.positions[i + 2] ?? 0
    
    let line = `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`
    
    if (hasColors && pointCloud.colors) {
      const colorIndex = i // Same index since colors are also x3
      const r = Math.round((pointCloud.colors[colorIndex] ?? 0) * 255)
      const g = Math.round((pointCloud.colors[colorIndex + 1] ?? 0) * 255)
      const b = Math.round((pointCloud.colors[colorIndex + 2] ?? 0) * 255)
      line += ` ${r} ${g} ${b}`
    }
    
    lines.push(line)
  }
  
  return lines.join('\n')
}

/**
 * Download a test XYZ file
 */
export function downloadTestXYZFile(type: 'cube' | 'sphere' | 'building' | 'car' = 'cube'): void {
  const content = generateTestXYZFile(type)
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `test_${type}_pointcloud.xyz`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
  
} 