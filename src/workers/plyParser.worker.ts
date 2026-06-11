/**
 * PLY Parser Web Worker
 * 
 * Complete implementation for parsing PLY (Stanford Triangle Format) files.
 * Supports both ASCII and binary formats with colors, normals, and vertex data.
 */

import type { PointCloudData } from '../types/index'

interface PLYHeader {
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian'
  vertexCount: number
  faceCount: number
  properties: PLYProperty[]
}

interface PLYProperty {
  type: 'float' | 'double' | 'int' | 'uint' | 'uchar' | 'char' | 'short' | 'ushort'
  name: string
  listType?: string
  listCountType?: string
}

// Simple Vector3 implementation for worker
class Vector3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
}

// Worker message handling
self.onmessage = async (e: MessageEvent) => {
  const { type, file, fileName } = e.data

  if (type === 'parse') {
    try {
      const pointCloud = await parsePLYFile(file, fileName)
      postMessage({
        type: 'complete',
        data: pointCloud,
      })
    } catch (error) {
      postMessage({
        type: 'error',
        data: { 
          message: error instanceof Error ? error.message : 'PLY parsing failed', 
        },
      })
    }
  }
}

/**
 * Parse PLY file
 */
async function parsePLYFile(file: File, fileName: string): Promise<PointCloudData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer
        const pointCloud = parsePLYData(arrayBuffer, fileName)
        resolve(pointCloud)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read PLY file'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse PLY data from ArrayBuffer
 */
function parsePLYData(buffer: ArrayBuffer, fileName: string): PointCloudData {
  const decoder = new TextDecoder()
  const text = decoder.decode(buffer)
  
  // Find end of header
  const headerEndIndex = text.indexOf('end_header\n')
  if (headerEndIndex === -1) {
    throw new Error('Invalid PLY file: missing end_header')
  }
  
  const headerText = text.substring(0, headerEndIndex)
  const header = parsePLYHeader(headerText)
  
  postMessage({
    type: 'progress',
    data: {
      stage: 'parsing',
      progress: 0.1,
      message: `Parsing ${header.format} PLY file...`,
      pointsProcessed: 0,
      totalPoints: header.vertexCount,
    },
  })
  
  // Parse vertex data
  const dataStartOffset = headerEndIndex + 'end_header\n'.length
  let positions: number[] = []
  let colors: number[] = []
  let normals: number[] = []
  
  if (header.format === 'ascii') {
    ({ positions, colors, normals } = parseASCIIVertices(text, dataStartOffset, header))
  } else {
    ({ positions, colors, normals } = parseBinaryVertices(buffer, dataStartOffset, header))
  }
  
  postMessage({
    type: 'progress',
    data: {
      stage: 'finalizing',
      progress: 0.9,
      message: 'Creating point cloud data...',
      pointsProcessed: header.vertexCount,
      totalPoints: header.vertexCount,
    },
  })
  
  // Worker's Vector3 is structurally compatible with Three.js Vector3 for serialization purposes
  const bounds = calculateBounds(positions) as unknown as import('../types/index').BoundingBox

  const pointCloud: PointCloudData = {
    id: `ply_${Date.now()}`,
    metadata: {
      filename: fileName,
      format: '.ply',
      pointCount: header.vertexCount,
      fileSize: buffer.byteLength,
      hasColors: colors.length > 0,
      hasNormals: normals.length > 0,
      hasTextureCoords: false,
      boundingBox: bounds,
      density: header.vertexCount / (bounds.size.x * bounds.size.y * bounds.size.z),
      createdAt: new Date(),
      lastModified: new Date(),
    },
    positions: new Float32Array(positions),
    ...(colors.length > 0 ? { colors: new Float32Array(colors) } : {}),
    ...(normals.length > 0 ? { normals: new Float32Array(normals) } : {}),
  }
  
  return pointCloud
}

/**
 * Parse PLY header
 */
function parsePLYHeader(headerText: string): PLYHeader {
  const lines = headerText.split('\n')
  
  if (lines[0] !== 'ply') {
    throw new Error('Invalid PLY file: missing PLY signature')
  }
  
  let format: PLYHeader['format'] = 'ascii'
  let vertexCount = 0
  let faceCount = 0
  const properties: PLYProperty[] = []
  
  let currentElement = ''
  
  for (let i = 1; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (!line || line.startsWith('comment')) continue

    const parts = line.split(/\s+/)
    const command = parts[0]

    switch (command) {
      case 'format':
        format = (parts[1] ?? 'ascii') as PLYHeader['format']
        break

      case 'element': {
        currentElement = parts[1] ?? ''
        const count = parseInt(parts[2] ?? '0')
        if (currentElement === 'vertex') {
          vertexCount = count
        } else if (currentElement === 'face') {
          faceCount = count
        }
        break
      }

      case 'property':
        if (currentElement === 'vertex') {
          if (parts[1] === 'list') {
            properties.push({
              type: (parts[3] ?? 'float') as PLYProperty['type'],
              name: parts[4] ?? '',
              listType: parts[3] ?? '',
              listCountType: parts[2] ?? '',
            })
          } else {
            properties.push({
              type: (parts[1] ?? 'float') as PLYProperty['type'],
              name: parts[2] ?? '',
            })
          }
        }
        break
    }
  }
  
  return { format, vertexCount, faceCount, properties }
}

/**
 * Calculate bounding box from positions
 */
function calculateBounds(positions: number[]) {
  if (positions.length === 0) {
    return {
      min: new Vector3(),
      max: new Vector3(),
      center: new Vector3(),
      size: new Vector3(),
    }
  }
  
  let minX = positions[0] ?? 0
  let minY = positions[1] ?? 0
  let minZ = positions[2] ?? 0
  let maxX = positions[0] ?? 0
  let maxY = positions[1] ?? 0
  let maxZ = positions[2] ?? 0
  
  for (let i = 3; i < positions.length; i += 3) {
    const x = positions[i] ?? 0
    const y = positions[i + 1] ?? 0
    const z = positions[i + 2] ?? 0
    
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  
  return {
    min: new Vector3(minX, minY, minZ),
    max: new Vector3(maxX, maxY, maxZ),
    center: new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    size: new Vector3(maxX - minX, maxY - minY, maxZ - minZ),
  }
}

/**
 * Parse ASCII vertex data
 */
function parseASCIIVertices(text: string, dataStartOffset: number, header: PLYHeader) {
  const positions: number[] = []
  const colors: number[] = []
  const normals: number[] = []
  
  const dataText = text.substring(dataStartOffset)
  const lines = dataText.split('\n').filter(line => line.trim())
  
  // Find property indices
  const xIndex = header.properties.findIndex(p => p.name === 'x')
  const yIndex = header.properties.findIndex(p => p.name === 'y')
  const zIndex = header.properties.findIndex(p => p.name === 'z')
  const redIndex = header.properties.findIndex(p => p.name === 'red' || p.name === 'r')
  const greenIndex = header.properties.findIndex(p => p.name === 'green' || p.name === 'g')
  const blueIndex = header.properties.findIndex(p => p.name === 'blue' || p.name === 'b')
  const nxIndex = header.properties.findIndex(p => p.name === 'nx')
  const nyIndex = header.properties.findIndex(p => p.name === 'ny')
  const nzIndex = header.properties.findIndex(p => p.name === 'nz')
  
  for (let i = 0; i < Math.min(lines.length, header.vertexCount); i++) {
    const line = lines[i]
    if (!line) continue
    
    const parts = line.trim().split(/\s+/)
    
    // Extract positions
    if (xIndex >= 0 && yIndex >= 0 && zIndex >= 0) {
      const x = parseFloat(parts[xIndex] ?? '0')
      const y = parseFloat(parts[yIndex] ?? '0')
      const z = parseFloat(parts[zIndex] ?? '0')
      positions.push(x, y, z)
    }
    
    // Extract colors
    if (redIndex >= 0 && greenIndex >= 0 && blueIndex >= 0) {
      const r = parseInt(parts[redIndex] ?? '0')
      const g = parseInt(parts[greenIndex] ?? '0')
      const b = parseInt(parts[blueIndex] ?? '0')
      colors.push(r / 255, g / 255, b / 255)
    }
    
    // Extract normals
    if (nxIndex >= 0 && nyIndex >= 0 && nzIndex >= 0) {
      const nx = parseFloat(parts[nxIndex] ?? '0')
      const ny = parseFloat(parts[nyIndex] ?? '0')
      const nz = parseFloat(parts[nzIndex] ?? '0')
      normals.push(nx, ny, nz)
    }
    
    // Report progress
    if (i % 10000 === 0) {
      postMessage({
        type: 'progress',
        data: {
          stage: 'parsing',
          progress: 0.1 + (i / header.vertexCount) * 0.7,
          message: `Processing vertex ${i + 1} of ${header.vertexCount}...`,
          pointsProcessed: i,
          totalPoints: header.vertexCount,
        },
      })
    }
  }
  
  return { positions, colors, normals }
}

/**
 * Parse binary vertex data
 */
function parseBinaryVertices(buffer: ArrayBuffer, dataStartOffset: number, header: PLYHeader) {
  const positions: number[] = []
  const colors: number[] = []
  const normals: number[] = []
  
  const littleEndian = header.format === 'binary_little_endian'
  const view = new DataView(buffer, dataStartOffset)
  
  // Calculate vertex size in bytes
  let vertexSize = 0
  const propertyOffsets: number[] = []
  
  for (const prop of header.properties) {
    propertyOffsets.push(vertexSize)
    switch (prop.type) {
      case 'float': vertexSize += 4; break
      case 'double': vertexSize += 8; break
      case 'int': case 'uint': vertexSize += 4; break
      case 'short': case 'ushort': vertexSize += 2; break
      case 'char': case 'uchar': vertexSize += 1; break
    }
  }
  
  // Find property indices
  const xIndex = header.properties.findIndex(p => p.name === 'x')
  const yIndex = header.properties.findIndex(p => p.name === 'y')
  const zIndex = header.properties.findIndex(p => p.name === 'z')
  const redIndex = header.properties.findIndex(p => p.name === 'red' || p.name === 'r')
  const greenIndex = header.properties.findIndex(p => p.name === 'green' || p.name === 'g')
  const blueIndex = header.properties.findIndex(p => p.name === 'blue' || p.name === 'b')
  const nxIndex = header.properties.findIndex(p => p.name === 'nx')
  const nyIndex = header.properties.findIndex(p => p.name === 'ny')
  const nzIndex = header.properties.findIndex(p => p.name === 'nz')
  
  for (let i = 0; i < header.vertexCount; i++) {
    const vertexOffset = i * vertexSize
    
    // Extract positions
    if (xIndex >= 0 && yIndex >= 0 && zIndex >= 0) {
      const xProp = header.properties[xIndex]
      const yProp = header.properties[yIndex]
      const zProp = header.properties[zIndex]
      
      if (xProp && yProp && zProp) {
        positions.push(
          readProperty(view, vertexOffset + (propertyOffsets[xIndex] ?? 0), xProp, littleEndian),
          readProperty(view, vertexOffset + (propertyOffsets[yIndex] ?? 0), yProp, littleEndian),
          readProperty(view, vertexOffset + (propertyOffsets[zIndex] ?? 0), zProp, littleEndian),
        )
      }
    }

    // Extract colors
    if (redIndex >= 0 && greenIndex >= 0 && blueIndex >= 0) {
      const redProp = header.properties[redIndex]
      const greenProp = header.properties[greenIndex]
      const blueProp = header.properties[blueIndex]

      if (redProp && greenProp && blueProp) {
        const r = readProperty(view, vertexOffset + (propertyOffsets[redIndex] ?? 0), redProp, littleEndian)
        const g = readProperty(view, vertexOffset + (propertyOffsets[greenIndex] ?? 0), greenProp, littleEndian)
        const b = readProperty(view, vertexOffset + (propertyOffsets[blueIndex] ?? 0), blueProp, littleEndian)
        colors.push(r / 255, g / 255, b / 255)
      }
    }

    // Extract normals
    if (nxIndex >= 0 && nyIndex >= 0 && nzIndex >= 0) {
      const nxProp = header.properties[nxIndex]
      const nyProp = header.properties[nyIndex]
      const nzProp = header.properties[nzIndex]

      if (nxProp && nyProp && nzProp) {
        normals.push(
          readProperty(view, vertexOffset + (propertyOffsets[nxIndex] ?? 0), nxProp, littleEndian),
          readProperty(view, vertexOffset + (propertyOffsets[nyIndex] ?? 0), nyProp, littleEndian),
          readProperty(view, vertexOffset + (propertyOffsets[nzIndex] ?? 0), nzProp, littleEndian),
        )
      }
    }
    
    // Report progress
    if (i % 10000 === 0) {
      postMessage({
        type: 'progress',
        data: {
          stage: 'parsing',
          progress: 0.1 + (i / header.vertexCount) * 0.7,
          message: `Processing vertex ${i + 1} of ${header.vertexCount}...`,
          pointsProcessed: i,
          totalPoints: header.vertexCount,
        },
      })
    }
  }
  
  return { positions, colors, normals }
}

/**
 * Read property value from binary data
 */
function readProperty(view: DataView, offset: number, property: PLYProperty, littleEndian: boolean): number {
  switch (property.type) {
    case 'float': return view.getFloat32(offset, littleEndian)
    case 'double': return view.getFloat64(offset, littleEndian)
    case 'int': return view.getInt32(offset, littleEndian)
    case 'uint': return view.getUint32(offset, littleEndian)
    case 'short': return view.getInt16(offset, littleEndian)
    case 'ushort': return view.getUint16(offset, littleEndian)
    case 'char': return view.getInt8(offset)
    case 'uchar': return view.getUint8(offset)
    default: return 0
  }
}

export {} 