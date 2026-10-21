/**
 * Project Panel Component
 * 
 * This component manages datasets within an already-selected enhanced project.
 * It allows users to add datasets, switch between files, save progress, and export results.
 * Project creation/loading is handled by ProjectStartScreen.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type { 
  EnhancedProject,
  ProjectFile,
  ExportFormat, 
  ExportOptions,
  PointCloudData,
} from '../types/index'
import { projectManager } from '../utils/projectManager'
import { processFile, validateFile } from '../utils/fileProcessing'
import { selectionManager } from '../utils/selectionManager'
import { labelManager } from '../utils/labelManager'

export interface ProjectPanelProps {
  /** Current enhanced project */
  currentProject: EnhancedProject
  /** Current point cloud data */
  pointCloud?: PointCloudData | null
  /** Callback when a dataset is added to the project */
  onDatasetAdded?: (file: ProjectFile) => void
  /** Callback when point cloud changes due to file switching */
  onPointCloudChange?: (pointCloud: PointCloudData | null, fileId: string | null) => void
  /** CSS class name */
  className?: string
}

interface ProjectState {
  isLoading: boolean
  error: string | null
  isDirty: boolean
  activeFileId: string | null
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  currentProject,
  onDatasetAdded,
  onPointCloudChange,
  className = '',
}) => {
  const initialFileIndex = currentProject.activeFileIndex >= 0
    ? currentProject.activeFileIndex
    : (currentProject.files.length > 0 ? 0 : -1)

  // State
  const [state, setState] = useState<ProjectState>({
    isLoading: false,
    error: null,
    isDirty: false,
    activeFileId: initialFileIndex >= 0 ? currentProject.files[initialFileIndex]?.id || null : null,
  })

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('projectPanelCollapsed')
    return saved ? JSON.parse(saved) : false
  })

  const [showAddDatasetModal, setShowAddDatasetModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [confirmRemoveFileId, setConfirmRemoveFileId] = useState<string | null>(null)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [processingProgress, setProcessingProgress] = useState<Record<string, number>>({})

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('projectPanelCollapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed])

  // Toggle collapsed state
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev: boolean) => !prev)
  }, [])

  // Label and point-assignment changes make the project eligible for manual save.
  useEffect(() => {
    const markDirty = () => {
      setState(prev => ({ ...prev, isDirty: true }))
    }

    labelManager.on('label:created', markDirty)
    labelManager.on('label:updated', markDirty)
    labelManager.on('label:deleted', markDirty)
    labelManager.on('labels:cleared', markDirty)

    return () => {
      labelManager.off('label:created', markDirty)
      labelManager.off('label:updated', markDirty)
      labelManager.off('label:deleted', markDirty)
      labelManager.off('labels:cleared', markDirty)
    }
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback((fileId: string) => {
    if (fileId === state.activeFileId) return

    if (state.activeFileId) {
      currentProject.selections[state.activeFileId] = selectionManager.getSelectionsSnapshot()
    }

    const fileIndex = currentProject.files.findIndex(file => file.id === fileId)
    currentProject.activeFileIndex = fileIndex
    setState(prev => ({ ...prev, activeFileId: fileId, isDirty: true }))
    
    // Find the file and load its point cloud data
    const file = currentProject.files[fileIndex]
    if (file?.data) {
      onPointCloudChange?.(file.data, file.id)
    }
  }, [currentProject, onPointCloudChange, state.activeFileId])

  // Handle dataset file upload
  const handleDatasetUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      for (const file of files) {
        // Validate file
        const validationResult = await validateFile(file)
        if (!validationResult.isValid) {
          throw new Error(`Invalid file ${file.name}: ${validationResult.errors[0] || 'Unknown validation error'}`)
        }

        // Process file
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Track processing progress
        setProcessingProgress(prev => ({ ...prev, [fileId]: 0 }))
        
        const pointCloudData = await processFile(file, (progress) => {
          setProcessingProgress(prev => ({ ...prev, [fileId]: progress.progress }))
        })

        // Create project file
        const projectFile: ProjectFile = {
          id: fileId,
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          status: 'ready',
          data: pointCloudData,
        }

        // Add file to enhanced project
        currentProject.files.push(projectFile)
        currentProject.selections[fileId] = []
        
        // Update project metadata
        currentProject.metadata.updatedAt = new Date().toISOString()

        // Set as active file if it's the first one
        if (currentProject.files.length === 1) {
          setState(prev => ({ ...prev, activeFileId: fileId }))
          currentProject.activeFileIndex = 0
          onPointCloudChange?.(pointCloudData, fileId)
        }

        // Clean up progress tracking
        setProcessingProgress(prev => {
          const updated = { ...prev }
          delete updated[fileId]
          return updated
        })

        // Notify callback
        onDatasetAdded?.(projectFile)
      }

      // Save enhanced project
      await projectManager.saveEnhancedProject(currentProject)
      
      setState(prev => ({ ...prev, isLoading: false, isDirty: false }))
      setShowAddDatasetModal(false)
      setUploadFiles([])

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to add dataset',
        isLoading: false,
      }))
    }
  }, [currentProject, onDatasetAdded, onPointCloudChange])

  const handleRemoveFile = useCallback(async (fileId: string) => {
    setConfirmRemoveFileId(null)

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // Remove file from project
      const fileIndex = currentProject.files.findIndex(f => f.id === fileId)
      if (fileIndex >= 0) {
        currentProject.files.splice(fileIndex, 1)
        delete currentProject.selections[fileId]
        currentProject.metadata.updatedAt = new Date().toISOString()

        // Update active file if needed
        if (state.activeFileId === fileId) {
          const newActiveFileId = currentProject.files.length > 0 ? currentProject.files[0]?.id || null : null
          setState(prev => ({ ...prev, activeFileId: newActiveFileId }))
          
          if (newActiveFileId) {
            const newActiveFile = currentProject.files.find(f => f.id === newActiveFileId)
            currentProject.activeFileIndex = currentProject.files.findIndex(f => f.id === newActiveFileId)
            onPointCloudChange?.(newActiveFile?.data || null, newActiveFileId)
          } else {
            currentProject.activeFileIndex = -1
            onPointCloudChange?.(null, null)
          }
        }

        // Save enhanced project
        await projectManager.saveEnhancedProject(currentProject)
        setState(prev => ({ ...prev, isLoading: false, isDirty: false }))
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to remove dataset',
        isLoading: false,
      }))
    }
  }, [currentProject, state.activeFileId, onPointCloudChange])

  // Save current project
  const handleSaveProject = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      if (state.activeFileId) {
        currentProject.selections[state.activeFileId] = selectionManager.getSelectionsSnapshot()
        currentProject.activeFileIndex = currentProject.files.findIndex(
          file => file.id === state.activeFileId,
        )
      }

      await projectManager.saveEnhancedProject(currentProject)
      setState(prev => ({ ...prev, isDirty: false, isLoading: false }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save project',
        isLoading: false,
      }))
    }
  }, [currentProject, state.activeFileId])

  // Export project
  const handleExportProject = useCallback(async (format: ExportFormat, options: ExportOptions = {}) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      if (!state.activeFileId || (format !== 'ply' && format !== 'csv')) {
        throw new Error('Choose an active dataset and export it as PLY or CSV')
      }

      // Export the latest in-memory annotations, including changes made since
      // the last manual save.
      currentProject.labels = labelManager.getAllLabels()
      currentProject.selections[state.activeFileId] = selectionManager.getSelectionsSnapshot()
      await projectManager.exportEnhancedDataset(
        currentProject,
        state.activeFileId,
        format,
        { ...options, download: true },
      )
      setState(prev => ({ ...prev, isLoading: false }))
      setShowExportModal(false)
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to export project',
        isLoading: false,
      }))
    }
  }, [currentProject, state.activeFileId])

  // Handle file drop for dataset upload
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    setUploadFiles(files)
    setShowAddDatasetModal(true)
  }, [])

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }



  return (
    <div className={`project-panel ${isCollapsed ? 'project-panel--collapsed' : ''} ${className}`}>
      {/* Header */}
      <div className="project-panel__header">
        <div className="project-panel__header-left">
          <h3>{currentProject.metadata.name}</h3>
          <button
            className="project-panel__toggle"
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Expand Project Panel' : 'Collapse Project Panel'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        </div>
      </div>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="project-panel__content">
          {/* Error display */}
          {state.error && (
            <div className="project-panel__error">
              <span className="error-message">{state.error}</span>
              <button
                className="error-dismiss"
                onClick={() => setState(prev => ({ ...prev, error: null }))}
              >
                ×
              </button>
            </div>
          )}

          {/* Project info */}
          <div className="project-panel__current">
            <div className="current-project-header">
              <h4>Project Overview</h4>
              {state.isDirty && (
                <span className="unsaved-indicator" title="Unsaved changes">
                  ● Unsaved
                </span>
              )}
            </div>
            
            <div className="current-project-info">
              {currentProject.metadata.description && (
                <div className="project-description">{currentProject.metadata.description}</div>
              )}
              <div className="project-meta">
                <span>Created: {formatDate(currentProject.metadata.createdAt)}</span>
                <span>Updated: {formatDate(currentProject.metadata.updatedAt)}</span>
              </div>
              <div className="project-stats">
                <div className="stat">
                  <span className="label">Datasets:</span>
                  <span className="value">{currentProject.files.length}</span>
                </div>
                <div className="stat">
                  <span className="label">Labels:</span>
                  <span className="value">{currentProject.labels.length}</span>
                </div>
                <div className="stat">
                  <span className="label">Progress:</span>
                  <span className="value">
                    {currentProject.files.length > 0 ? 
                      Math.round((currentProject.labels.length / currentProject.files.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="current-project-actions">
              <button
                className="project-panel__button primary"
                onClick={handleSaveProject}
                disabled={state.isLoading}
              >
                Save
              </button>
              <button
                className="project-panel__button secondary"
                onClick={() => setShowExportModal(true)}
                disabled={state.isLoading || !state.activeFileId}
              >
                Export
              </button>
            </div>
          </div>

          {/* Dataset Management */}
          <div className="project-panel__files">
            <div className="files-header">
              <h4>Datasets ({currentProject.files.length})</h4>
              <button
                className="project-panel__button secondary small"
                onClick={() => setShowAddDatasetModal(true)}
                disabled={state.isLoading}
              >
                + Add Dataset
              </button>
            </div>
            
            {currentProject.files.length > 0 ? (
              <div className="files-tabs">
                {currentProject.files.map((file) => (
                  <div
                    key={file.id}
                    className={`file-tab ${file.id === state.activeFileId ? 'active' : ''}`}
                    onClick={() => handleFileSelect(file.id)}
                  >
                    <span className="file-name">{file.name}</span>
                    {confirmRemoveFileId === file.id ? (
                      <span className="remove-file-confirm">
                        <button
                          className="remove-file remove-file--danger"
                          onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.id) }}
                        >
                          Remove
                        </button>
                        <button
                          className="remove-file"
                          onClick={(e) => { e.stopPropagation(); setConfirmRemoveFileId(null) }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        className="remove-file"
                        onClick={(e) => { e.stopPropagation(); setConfirmRemoveFileId(file.id) }}
                        title="Remove dataset"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div 
                className="empty-files"
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <p>No datasets in this project.</p>
                <p>Add point cloud files to get started with labelling.</p>
              </div>
            )}
          </div>



          {/* Loading indicator */}
          {state.isLoading && (
            <div className="project-panel__loading">
              <div className="loading-spinner"></div>
              <span>Loading...</span>
            </div>
          )}
        </div>
      )}

      {/* Add Dataset Modal */}
      {showAddDatasetModal && (
        <div className="modal-overlay" onClick={() => setShowAddDatasetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Dataset to Project</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddDatasetModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="file-upload-area">
                <div 
                  className="file-upload-zone"
                  onDrop={(e) => {
                    e.preventDefault()
                    const files = Array.from(e.dataTransfer.files)
                    setUploadFiles(files)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <p>Drop point cloud files here or</p>
                  <label className="file-upload-button">
                    Choose Files
                    <input
                      type="file"
                      multiple
                      accept=".xyz,.ply,.las,.laz,.pcd,.pts,.csv"
                      onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <div className="file-upload-info">
                    Supported formats: XYZ, PLY, LAS, LAZ, PCD, PTS, CSV
                  </div>
                </div>
                
                {uploadFiles.length > 0 && (
                  <div className="selected-files">
                    <h4>Selected Files:</h4>
                    {uploadFiles.map((file, index) => (
                      <div key={index} className="selected-file">
                        <span>{file.name}</span>
                        <span>({(file.size / (1024 * 1024)).toFixed(1)} MB)</span>
                      </div>
                    ))}
                  </div>
                )}

                {Object.keys(processingProgress).length > 0 && (
                  <div className="processing-files">
                    <h4>Processing Files:</h4>
                    {Object.entries(processingProgress).map(([fileId, progress]) => (
                      <div key={fileId} className="processing-file">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                        <span>{Math.round(progress * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="project-panel__button secondary"
                onClick={() => {
                  setShowAddDatasetModal(false)
                  setUploadFiles([])
                }}
              >
                Cancel
              </button>
              <button
                className="project-panel__button primary"
                onClick={() => handleDatasetUpload(uploadFiles)}
                disabled={uploadFiles.length === 0 || state.isLoading}
              >
                Add {uploadFiles.length} Dataset{uploadFiles.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Active Dataset</h3>
              <button 
                className="modal-close"
                onClick={() => setShowExportModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="export-options">
                <div className="export-format">
                  <h4>Choose Export Format:</h4>
                  <p>
                    Original XYZ/RGB values are preserved. Semantic labels are
                    exported separately as integers: healthy = 0, lesion = 1,
                    unlabeled = -1.
                  </p>
                  <div className="format-grid">
                    <button
                      className="format-option"
                      onClick={() => handleExportProject('ply')}
                    >
                      <span className="format-name">PLY Dataset</span>
                      <span className="format-desc">XYZ, original RGB, and integer label</span>
                    </button>
                    <button
                      className="format-option"
                      onClick={() => handleExportProject('csv')}
                    >
                      <span className="format-name">CSV Dataset</span>
                      <span className="format-desc">Readable per-point data for verification</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="project-panel__button secondary"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectPanel
