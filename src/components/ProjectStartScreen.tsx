/**
 * Project Start Screen Component
 * 
 * This component provides the initial interface when users open the application.
 * It allows users to either create a new project or load an existing project.
 * This screen appears before the main application interface.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EnhancedProject, ProjectMetadata } from '../types/index'
import { projectManager } from '../utils/projectManager'

export interface ProjectStartScreenProps {
  /** Callback when a project is selected (created or loaded) */
  onProjectSelected: (project: EnhancedProject) => void
  /** CSS class name */
  className?: string
}

interface StartScreenState {
  /** All available projects */
  allProjects: ProjectMetadata[]
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Current view mode */
  viewMode: 'welcome' | 'create' | 'load'
}

export const ProjectStartScreen: React.FC<ProjectStartScreenProps> = ({
  onProjectSelected,
  className = '',
}) => {
  // Component state
  const [state, setState] = useState<StartScreenState>({
    allProjects: [],
    isLoading: false,
    error: null,
    viewMode: 'welcome',
  })

  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Load projects list on mount
  const loadProjectsList = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      const projects = await projectManager.getAllProjects()
      setState(prev => ({ 
        ...prev, 
        allProjects: projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        isLoading: false, 
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load projects',
        isLoading: false,
      }))
    }
  }, [])

  // initialise on mount
  useEffect(() => {
    loadProjectsList()
  }, [loadProjectsList])

  // Create new project
  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const now = new Date().toISOString()
      const projectId = uuidv4()
      
      const enhancedProject: EnhancedProject = {
        id: projectId,
        metadata: {
          id: projectId,
          name: newProjectName.trim(),
          description: newProjectDescription.trim(),
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
        files: [],
        activeFileIndex: -1,
        labels: [],
        selections: {},
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

      // Save the project
      await projectManager.saveEnhancedProject(enhancedProject)
      
      setState(prev => ({ ...prev, isLoading: false }))
      onProjectSelected(enhancedProject)
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create project',
        isLoading: false,
      }))
    }
  }, [newProjectName, newProjectDescription, onProjectSelected])

  // Load existing project
  const handleLoadProject = useCallback(async (projectId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      const project = await projectManager.loadEnhancedProject(projectId)
      setState(prev => ({ ...prev, isLoading: false }))
      onProjectSelected(project)
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load project',
        isLoading: false,
      }))
    }
  }, [onProjectSelected])

  const handleDeleteProject = useCallback(async (projectId: string) => {
    setConfirmDeleteId(null)
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      await projectManager.deleteProject(projectId)
      setState(prev => ({ ...prev, isLoading: false }))
      loadProjectsList()
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete project',
        isLoading: false,
      }))
    }
  }, [loadProjectsList])

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

  // Render welcome view
  const renderWelcomeView = () => (
    <div className="start-screen__welcome">
      <div className="start-screen__header">
        <h1 className="start-screen__title">Point Cloud Labelling Tool</h1>
        <p className="start-screen__subtitle">
          Create and manage point cloud labelling projects with ease
        </p>
      </div>

      <div className="start-screen__actions">
        <button
          className="start-screen__action-button primary"
          onClick={() => setState(prev => ({ ...prev, viewMode: 'create' }))}
          disabled={state.isLoading}
        >
          <span className="start-screen__action-icon">+</span>
          Create New Project
        </button>

        <button
          className="start-screen__action-button secondary"
          onClick={() => setState(prev => ({ ...prev, viewMode: 'load' }))}
          disabled={state.isLoading}
        >
          Load Existing Project
        </button>
      </div>

      {state.allProjects.length > 0 && (
        <div className="start-screen__recent">
          <h3>Recent Projects</h3>
          <div className="start-screen__recent-list">
            {state.allProjects.slice(0, 3).map(project => (
              <div
                key={project.id}
                className="start-screen__recent-item"
                onClick={() => handleLoadProject(project.id)}
              >
                <div className="start-screen__recent-info">
                  <span className="start-screen__recent-name">{project.name}</span>
                  <span className="start-screen__recent-date">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
                <div className="start-screen__recent-stats">
                  {project.statistics.totalFiles} files, {project.statistics.totalLabels} labels
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Render create project view
  const renderCreateView = () => (
    <div className="start-screen__create">
      <div className="start-screen__header">
        <button
          className="start-screen__back-button"
          onClick={() => setState(prev => ({ ...prev, viewMode: 'welcome' }))}
        >
          ← Back
        </button>
        <h2>Create New Project</h2>
      </div>

      <div className="start-screen__form">
        <div className="form-group">
          <label htmlFor="project-name">Project Name *</label>
          <input
            id="project-name"
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Enter project name..."
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
            placeholder="Enter project description..."
            rows={4}
            maxLength={500}
          />
        </div>

        <div className="start-screen__form-actions">
          <button
            className="start-screen__button secondary"
            onClick={() => setState(prev => ({ ...prev, viewMode: 'welcome' }))}
            disabled={state.isLoading}
          >
            Cancel
          </button>
          <button
            className="start-screen__button primary"
            onClick={handleCreateProject}
            disabled={state.isLoading || !newProjectName.trim()}
          >
            {state.isLoading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )

  // Render load project view
  const renderLoadView = () => (
    <div className="start-screen__load">
      <div className="start-screen__header">
        <button
          className="start-screen__back-button"
          onClick={() => setState(prev => ({ ...prev, viewMode: 'welcome' }))}
        >
          ← Back
        </button>
        <h2>Load Existing Project</h2>
      </div>

      {state.allProjects.length === 0 ? (
        <div className="start-screen__empty">
          <p>No projects found. Create your first project to get started!</p>
          <button
            className="start-screen__button primary"
            onClick={() => setState(prev => ({ ...prev, viewMode: 'create' }))}
          >
            Create New Project
          </button>
        </div>
      ) : (
        <div className="start-screen__projects-list">
          {state.allProjects.map(project => (
            <div key={project.id} className="start-screen__project-item">
              <div className="start-screen__project-main" onClick={() => handleLoadProject(project.id)}>
                <div className="start-screen__project-info">
                  <h3 className="start-screen__project-name">{project.name}</h3>
                  {project.description && (
                    <p className="start-screen__project-description">{project.description}</p>
                  )}
                  <div className="start-screen__project-meta">
                    <span>Created: {formatDate(project.createdAt)}</span>
                    <span>Modified: {formatDate(project.updatedAt)}</span>
                  </div>
                </div>
                <div className="start-screen__project-stats">
                  <div className="stat">
                    <span className="stat-value">{project.statistics.totalFiles}</span>
                    <span className="stat-label">Files</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{project.statistics.totalLabels}</span>
                    <span className="stat-label">Labels</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{project.statistics.completionPercentage}%</span>
                    <span className="stat-label">Complete</span>
                  </div>
                </div>
              </div>
              {confirmDeleteId === project.id ? (
                <span className="start-screen__delete-confirm">
                  <button
                    className="start-screen__delete-button start-screen__delete-button--danger"
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id) }}
                  >
                    Confirm Delete
                  </button>
                  <button
                    className="start-screen__delete-button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="start-screen__delete-button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id) }}
                  title="Delete project"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className={`start-screen ${className}`}>
      <div className="start-screen__container">
        {state.error && (
          <div className="start-screen__error">
            <span>{state.error}</span>
            <button onClick={() => setState(prev => ({ ...prev, error: null }))}>✕</button>
          </div>
        )}

        {state.isLoading && (
          <div className="start-screen__loading">
            <div className="loading-spinner"></div>
            <span>Loading...</span>
          </div>
        )}

        {state.viewMode === 'welcome' && renderWelcomeView()}
        {state.viewMode === 'create' && renderCreateView()}
        {state.viewMode === 'load' && renderLoadView()}
      </div>
    </div>
  )
}

export default ProjectStartScreen
