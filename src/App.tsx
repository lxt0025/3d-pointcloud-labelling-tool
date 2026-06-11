/**
 * Main Application Component
 * 
 * This is the root component of the Point Cloud Labelling Tool. It provides
 * the main application structure, error handling, and state management setup.
 * 
 * Key responsibilities:
 * - Application initialisation and WebGL compatibility checking
 * - Top-level error boundary and error handling
 * - Theme and settings management
 * - Core application layout and routing
 * - Performance monitoring integration
 */

import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import ProjectStartScreen from './components/ProjectStartScreen'
import { APP_INFO, ERROR_MESSAGES } from './utils/constants'
import { projectManager } from './utils/projectManager'
import type { EnhancedProject } from './types/index'

const checkWebGLSupport = (): { supported: boolean; error?: string } => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return { supported: false, error: ERROR_MESSAGES.webglNotSupported }
    return { supported: true }
  } catch (error) {
    return {
      supported: false,
      error: `WebGL check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({ fps: 0, memoryUsage: 0 })

  useEffect(() => {
    if (!import.meta.env.DEV) return

    let frameCount = 0
    let lastTime = performance.now()
    let animationId: number

    const updateMetrics = () => {
      const now = performance.now()
      frameCount++
      if (now - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime))
        const perf = performance as unknown as { memory?: { usedJSHeapSize: number } }
        const memoryUsage = perf.memory
          ? Math.round(perf.memory.usedJSHeapSize / 1024 / 1024)
          : 0
        setMetrics({ fps, memoryUsage })
        frameCount = 0
        lastTime = now
      }
      animationId = requestAnimationFrame(updateMetrics)
    }

    animationId = requestAnimationFrame(updateMetrics)
    return () => cancelAnimationFrame(animationId)
  }, [])

  return metrics
}

/**
 * Main Application Component
 */
const App: React.FC = () => {
  // Application state
  const [isInitialised, setIsinitialised] = useState(false)
  const [initialisationError, setinitialisationError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<EnhancedProject | null>(null)

  // Performance monitoring
  const performanceMetrics = usePerformanceMonitor()

  const initialiseApp = useCallback(async () => {
    try {
      const webglCheck = checkWebGLSupport()
      if (!webglCheck.supported) {
        throw new Error(webglCheck.error || ERROR_MESSAGES.webglNotSupported)
      }
      await projectManager.initialise()
      setIsinitialised(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.unknownError
      console.error('Failed to initialise application:', errorMessage)
      setinitialisationError(errorMessage)
    }
  }, [])

  const handleProjectSelected = useCallback((project: EnhancedProject) => {
    setSelectedProject(project)
  }, [])

  // initialise the application on mount
  useEffect(() => {
    initialiseApp()
  }, [initialiseApp])

  if (initialisationError) {
    return (
      <div className="app-initialisation-error">
        <div className="app-initialisation-error__content">
          <h1>Initialisation Failed</h1>
          <p>{initialisationError}</p>
          <button
            onClick={() => window.location.reload()}
            className="app-initialisation-error__retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show loading screen during initialisation
  if (!isInitialised) {
    return (
      <div className="app-loading">
        <div className="app-loading__content">
          <div className="app-loading__spinner"></div>
          <h2>Loading {APP_INFO.name}</h2>
          <p>Initialising WebGL and application components...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app" data-theme="dark">
      {selectedProject ? (
        <Layout currentProject={selectedProject} />
      ) : (
        <ProjectStartScreen onProjectSelected={handleProjectSelected} />
      )}

      {import.meta.env.DEV && (
        <div className="performance-monitor">
          <div className="performance-monitor__item">FPS: {performanceMetrics.fps}</div>
          <div className="performance-monitor__item">Memory: {performanceMetrics.memoryUsage}MB</div>
        </div>
      )}
    </div>
  )
}

export default App 