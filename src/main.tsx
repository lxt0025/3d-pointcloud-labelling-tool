/**
 * Main Application Entry Point
 * 
 * This file serves as the primary entry point for the Point Cloud Labelling Tool.
 * It initialises the React application, sets up error boundaries, and provides
 * the foundation for 3D rendering and point cloud processing.
 * 
 * Key responsibilities:
 * - React DOM rendering and app initialisation
 * - Global error handling for WebGL and 3D operations
 * - Development mode configuration
 * - Performance monitoring setup
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

/**
 * Global Error Handler for WebGL and Three.js Operations
 * Provides user-friendly error messages for common 3D rendering issues
 */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h1>Something went wrong</h1>
            <p>
              The Point Cloud Labelling Tool encountered an unexpected error.
              This might be due to:
            </p>
            <ul>
              <li>WebGL compatibility issues</li>
              <li>Insufficient GPU memory</li>
              <li>Corrupted point cloud file</li>
              <li>Browser compatibility problems</li>
            </ul>
            <details>
              <summary>Error Details</summary>
              <pre>{this.state.error?.message}</pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="retry-button"
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * initialise React Application
 * Sets up the root container and renders the main App component
 */
function initialiseApp() {
  const rootElement = document.getElementById('root')
  
  if (!rootElement) {
    throw new Error('Root element not found. Please ensure index.html contains a div with id="root"')
  }

  const root = ReactDOM.createRoot(rootElement)
  
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}

// Initialise the application
try {
  initialiseApp()
} catch (error) {
  console.error('Failed to initialise application:', error)
  
  // Show fallback error message
  const rootElement = document.getElementById('root')
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #1a1a1a;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', sans-serif;
        text-align: center;
        padding: 20px;
      ">
        <div>
          <h1 style="color: #ef4444; margin-bottom: 16px;">Failed to Load Application</h1>
          <p style="color: #9ca3af; line-height: 1.6; margin-bottom: 20px;">
            The Point Cloud Labelling Tool could not be initialised.
          </p>
          <p style="color: #9ca3af; font-size: 14px;">
            Please check your browser's developer console for more details.
          </p>
          <button 
            onclick="window.location.reload()"
            style="
              background: #3b82f6;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
              margin-top: 20px;
            "
          >
            Reload Page
          </button>
        </div>
      </div>
    `
  }
} 