/**
 * Label Editor Component
 * 
 * This component provides a comprehensive interface for managing labels in the Point Cloud Labelling Tool.
 * It allows users to create, edit, delete, and organize labels with real-time validation and feedback.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type { Label } from '../types/index'
import { labelManager } from '../utils/labelManager'

export interface LabelEditorProps {
  /** Currently active/selected label */
  activeLabel?: Label | null
  /** Callback when a label is selected */
  onLabelSelect?: (label: Label | null) => void
  /** Callback when labels change */
  onLabelsChange?: (labels: Label[]) => void
  /** Number of points that do not currently have a label */
  unlabeledPointCount?: number
  /** Assign all unlabeled points to the active label */
  onFillUnlabeled?: () => boolean
  /** CSS class name */
  className?: string
}

interface EditingLabel {
  id?: string
  name: string
  color: string
  description: string
}

export const LabelEditor: React.FC<LabelEditorProps> = ({
  activeLabel,
  onLabelSelect,
  onLabelsChange,
  unlabeledPointCount = 0,
  onFillUnlabeled,
  className = '',
}) => {
  // State
  const [labels, setLabels] = useState<Label[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingLabel, setEditingLabel] = useState<EditingLabel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')


  useEffect(() => {
    setLabels(labelManager.getAllLabels())

    const handleLabelCreated = (label: Label) => {
      setLabels(prev => [...prev, label])
      setIsCreateModalOpen(false)
      setEditingLabel(null)
      setError(null)
    }

    const handleLabelUpdated = (label: Label) => {
      setLabels(prev => prev.map(l => l.id === label.id ? label : l))
      setEditingLabel(null)
      setError(null)
    }

    const handleLabelDeleted = (labelId: string) => {
      setLabels(prev => prev.filter(l => l.id !== labelId))
      if (activeLabel?.id === labelId) {
        onLabelSelect?.(null)
      }
    }

    const handleLabelsCleared = () => {
      setLabels([])
      onLabelSelect?.(null)
    }

    labelManager.on('label:created', handleLabelCreated)
    labelManager.on('label:updated', handleLabelUpdated)
    labelManager.on('label:deleted', handleLabelDeleted)
    labelManager.on('labels:cleared', handleLabelsCleared)

    return () => {
      labelManager.off('label:created', handleLabelCreated)
      labelManager.off('label:updated', handleLabelUpdated)
      labelManager.off('label:deleted', handleLabelDeleted)
      labelManager.off('labels:cleared', handleLabelsCleared)
    }
  }, []) // Empty dependency array - only run once on mount

  // Notify parent whenever labels change
  useEffect(() => {
    onLabelsChange?.(labels)
  }, [labels]) // intentionally omit onLabelsChange to avoid stale callback loops

  // Create or update label
  const handleSaveLabel = useCallback((labelData: EditingLabel) => {
    try {
      setError(null)

      if (labelData.id) {
        // Update existing label
        const updateData: Partial<Omit<Label, 'id' | 'createdAt'>> = {
          name: labelData.name,
          color: labelData.color,
        }
        if (labelData.description.trim()) {
          updateData.description = labelData.description.trim()
        }
        
        const updated = labelManager.updateLabel(labelData.id, updateData)
        if (!updated) {
          setError('Failed to update label')
        }
      } else {
        // Create new label
        const createOptions: {
          color?: string
          description?: string
          parentId?: string
        } = { color: labelData.color }
        
        if (labelData.description.trim()) {
          createOptions.description = labelData.description.trim()
        }
        
        const created = labelManager.createLabel(labelData.name, createOptions)
        if (!created) {
          setError('Failed to create label')
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    }
  }, [])

  // Delete label
  const handleDeleteLabel = useCallback((labelId: string) => {
    try {
      setError(null)
      labelManager.deleteLabel(labelId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete label')
    }
  }, [])

  // Toggle label visibility
  const handleToggleVisibility = useCallback((labelId: string) => {
    labelManager.toggleLabelVisibility(labelId)
  }, [])

  const handleFillUnlabeled = useCallback(() => {
    if (!activeLabel || unlabeledPointCount === 0 || !onFillUnlabeled) {
      return
    }

    const confirmed = window.confirm(
      `Assign ${unlabeledPointCount.toLocaleString()} currently unlabeled points to "${activeLabel.name}"?\n\nExisting labelled points will be preserved.`,
    )
    if (!confirmed) {
      return
    }

    setError(null)
    if (!onFillUnlabeled()) {
      setError('Unable to fill unlabeled points')
    }
  }, [activeLabel, unlabeledPointCount, onFillUnlabeled])

  // Start editing label
  const startEditing = useCallback((label: Label) => {
    setEditingLabel({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || '',
    })
    setIsCreateModalOpen(true)
  }, [])

  // Filter labels based on search
  const filteredLabels = labels.filter(label =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (label.description && label.description.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  // Get label statistics
  const stats = labelManager.getStatistics()

  return (
    <div className={`label-editor ${className}`}>
      {/* Header with search and actions */}
      <div className="label-editor__header">
        <div className="label-editor__search">
          <input
            type="text"
            placeholder="Search labels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="label-editor__search-input"
          />
        </div>
        <button
          className="label-editor__add-button"
          onClick={() => {
            setEditingLabel({ name: '', color: '', description: '' })
            setIsCreateModalOpen(true)
          }}
        >
          + Add Label
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="label-editor__error">
          <span className="label-editor__error-message">{error}</span>
          <button
            className="label-editor__error-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Statistics */}
      <div className="label-editor__stats">
        <div className="label-editor__stat">
          <span className="label-editor__stat-value">{stats.totalLabels}</span>
          <span className="label-editor__stat-label">Labels</span>
        </div>
        <div className="label-editor__stat">
          <span className="label-editor__stat-value">{stats.totalPoints.toLocaleString()}</span>
          <span className="label-editor__stat-label">Points</span>
        </div>
        <div className="label-editor__stat">
          <span className="label-editor__stat-value">{stats.visibleLabels}</span>
          <span className="label-editor__stat-label">Visible</span>
        </div>
      </div>

      <div className="label-editor__fill-unlabeled">
        <button
          type="button"
          className="label-editor__fill-button"
          onClick={handleFillUnlabeled}
          disabled={!activeLabel || unlabeledPointCount === 0 || !onFillUnlabeled}
          title={
            !activeLabel
              ? 'Select an active label first'
              : unlabeledPointCount === 0
                ? 'All points are already labelled'
                : `Assign ${unlabeledPointCount.toLocaleString()} unlabeled points to ${activeLabel.name}`
          }
        >
          Fill Unlabeled
        </button>
        <span className="label-editor__fill-description">
          {activeLabel
            ? `${unlabeledPointCount.toLocaleString()} unlabeled → ${activeLabel.name}`
            : 'Select a label to fill the remaining points'}
        </span>
      </div>

      {/* Labels list */}
      <div className="label-editor__list">
        {filteredLabels.length === 0 ? (
          <div className="label-editor__empty">
            <div className="label-editor__empty-text">
              {searchQuery ? 'No labels match your search' : 'No labels yet'}
            </div>
            {!searchQuery && (
              <button
                className="label-editor__empty-action"
                onClick={() => {
                  setEditingLabel({ name: '', color: '', description: '' })
                  setIsCreateModalOpen(true)
                }}
              >
                Create your first label
              </button>
            )}
          </div>
        ) : (
          filteredLabels.map(label => (
            <div
              key={label.id}
              className={`label-editor__item ${activeLabel?.id === label.id ? 'active' : ''} ${!label.visible ? 'hidden' : ''}`}
              onClick={() => onLabelSelect?.(label)}
            >
              <div className="label-editor__item-left">
                <div
                  className="label-editor__color"
                  style={{ backgroundColor: label.color }}
                />
                <div className="label-editor__info">
                  <div className="label-editor__name">{label.name}</div>
                  {label.description && (
                    <div className="label-editor__description">{label.description}</div>
                  )}
                </div>
              </div>
              <div className="label-editor__item-right">
                <div className="label-editor__count">
                  {label.pointCount.toLocaleString()}
                </div>
                <div className="label-editor__actions">
                  <button
                    className={`label-editor__action ${!label.visible ? 'inactive' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleVisibility(label.id)
                    }}
                    title={label.visible ? 'Hide label' : 'Show label'}
                  >
                    {label.visible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="label-editor__action"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditing(label)
                    }}
                    title="Edit label"
                  >
                    Edit
                  </button>
                  <button
                    className="label-editor__action label-editor__action--danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteLabel(label.id)
                    }}
                    title="Delete label"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {isCreateModalOpen && editingLabel && (
        <LabelEditModal
          label={editingLabel}
          onSave={handleSaveLabel}
          onCancel={() => {
            setIsCreateModalOpen(false)
            setEditingLabel(null)
            setError(null)
          }}
        />
      )}
    </div>
  )
}

// Label Edit Modal Component
interface LabelEditModalProps {
  label: EditingLabel
  onSave: (label: EditingLabel) => void
  onCancel: () => void
}

const LabelEditModal: React.FC<LabelEditModalProps> = ({ label, onSave, onCancel }) => {
  const [formData, setFormData] = useState<EditingLabel>(label)
  const [validationError, setValidationError] = useState<string | null>(null)

  const predefinedColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
    '#3b82f6', '#8b5cf6', '#ec4899', '#84cc16', '#f59e0b',
    '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
    '#2563eb', '#7c3aed', '#db2777', '#65a30d', '#d97706',
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    // Validation
    if (!formData.name.trim()) {
      setValidationError('Label name is required')
      return
    }

    if (formData.name.trim().length > 50) {
      setValidationError('Label name must be 50 characters or less')
      return
    }

    if (!formData.color) {
      setValidationError('Please select a color')
      return
    }

    onSave(formData)
  }

  return (
    <div className="label-modal-overlay">
      <div className="label-modal">
        <div className="label-modal__header">
          <h3 className="label-modal__title">
            {label.id ? 'Edit Label' : 'Create New Label'}
          </h3>
          <button className="label-modal__close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="label-modal__form">
          {validationError && (
            <div className="label-modal__error">
              {validationError}
            </div>
          )}

          <div className="label-modal__field">
            <label className="label-modal__label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter label name..."
              className="label-modal__input"
              maxLength={50}
              required
            />
          </div>

          <div className="label-modal__field">
            <label className="label-modal__label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              className="label-modal__textarea"
              rows={3}
              maxLength={200}
            />
          </div>

          <div className="label-modal__field">
            <label className="label-modal__label">Color *</label>
            <div className="label-modal__color-grid">
              {predefinedColors.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`label-modal__color-option ${formData.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="label-modal__color-picker"
            />
          </div>

          <div className="label-modal__actions">
            <button type="button" onClick={onCancel} className="label-modal__button label-modal__button--secondary">
              Cancel
            </button>
            <button type="submit" className="label-modal__button label-modal__button--primary">
              {label.id ? 'Update' : 'Create'} Label
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LabelEditor
