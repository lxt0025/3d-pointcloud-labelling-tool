/**
 * Tool Panel Component
 * 
 * This component provides an interface for selecting and configuring selection tools
 * in the Point Cloud Labelling Tool. It allows users to switch between different
 * selection modes and adjust tool-specific parameters.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type { SelectionTool, BrushToolConfig, PolygonSelectConfig } from '../types/index'
import { selectionManager, type SelectionState } from '../utils/selectionManager'

export interface ToolPanelProps {
  /** CSS class name */
  className?: string
  /** Callback when tool changes */
  onToolChange?: (tool: SelectionTool) => void
  /** Whether selection tools are enabled */
  enabled?: boolean
}



export const ToolPanel: React.FC<ToolPanelProps> = ({
  className = '',
  onToolChange,
  enabled = true,
}) => {
  // State
  const [selectionState, setSelectionState] = useState<SelectionState>(selectionManager.getState())
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState({ points: 0, areas: 0 })
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })

  // Update state when selection manager changes
  useEffect(() => {
    const handleToolChange = () => {
      setSelectionState(selectionManager.getState())
      onToolChange?.(selectionManager.getState().activeTool)
    }

    const handlePendingUpdate = (data: { count: number; areas: number }) => {
      setPendingCount({ points: data.count, areas: data.areas })
    }

    const handleHistoryChange = (data: { canUndo: boolean; canRedo: boolean }) => {
      setHistoryState(data)
    }

    selectionManager.on('tool:changed', handleToolChange)
    selectionManager.on('selection:pending', handlePendingUpdate)
    selectionManager.on('history:changed', handleHistoryChange)

    // initialise states
    setPendingCount(selectionManager.getPendingSelectionCount())
    setSelectionState(selectionManager.getState())

    return () => {
      selectionManager.off('tool:changed', handleToolChange)
      selectionManager.off('selection:pending', handlePendingUpdate)
      selectionManager.off('history:changed', handleHistoryChange)
    }
  }, [onToolChange])

  // Handle selection mode toggle
  const handleSelectionModeToggle = useCallback(() => {
    const currentMode = selectionManager.getSelectionMode()
    const newMode = currentMode === 'immediate' ? 'accumulate' : 'immediate'
    selectionManager.setSelectionMode(newMode)
    setSelectionState(selectionManager.getState())
  }, [])

  // Handle tool configuration updates
  const handleBrushConfigUpdate = useCallback((config: Partial<BrushToolConfig>) => {
    selectionManager.updateToolConfig('brush', config)
    setSelectionState(selectionManager.getState())
  }, [])

  const handlePolygonConfigUpdate = useCallback((config: Partial<PolygonSelectConfig>) => {
    selectionManager.updateToolConfig('polygon', config)
    setSelectionState(selectionManager.getState())
  }, [])

  // Handle pending selections
  const handleConfirmSelections = useCallback(() => {
    selectionManager.confirmPendingSelections()
  }, [])

  const handleClearPendingSelections = useCallback(() => {
    selectionManager.clearPendingSelections()
  }, [])

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    selectionManager.undo()
  }, [])

  const handleRedo = useCallback(() => {
    selectionManager.redo()
  }, [])

  // Derived state: which draw mode is active
  const brushMode = selectionState.toolConfigs.brush.mode
  const isDrawActive = selectionState.activeTool === 'brush' && brushMode === 'add'
  const isEraseActive = selectionState.activeTool === 'brush' && brushMode === 'subtract'
  const isPolygonActive = selectionState.activeTool === 'polygon'

  const activateDraw = () => {
    if (!enabled) return
    selectionManager.setActiveTool('brush')
    handleBrushConfigUpdate({ mode: 'add' })
  }

  const activateErase = () => {
    if (!enabled) return
    selectionManager.setActiveTool('brush')
    handleBrushConfigUpdate({ mode: 'subtract' })
  }

  const activatePolygon = () => {
    if (!enabled) return
    selectionManager.setActiveTool('polygon')
  }

  return (
    <div className={`tool-panel ${className}`}>

      {/* ── Tool row: Draw / Erase / Polygon ── */}
      <div className="tool-panel__tools">
        <button
          className={`tool-panel__tool${isDrawActive ? ' active' : ''}`}
          onClick={activateDraw}
          disabled={!enabled}
          title="Draw — add points to selection (B)"
        >
          <span className="tool-panel__tool-icon">✏</span>
          <span className="tool-panel__tool-name">Draw</span>
        </button>
        <button
          className={`tool-panel__tool${isEraseActive ? ' active' : ''}`}
          onClick={activateErase}
          disabled={!enabled}
          title="Erase — remove points from selection (V)"
        >
          <span className="tool-panel__tool-icon">◫</span>
          <span className="tool-panel__tool-name">Erase</span>
        </button>
        <button
          className={`tool-panel__tool${isPolygonActive ? ' active' : ''}`}
          onClick={activatePolygon}
          disabled={!enabled}
          title="Polygon — draw a selection area (P)"
        >
          <span className="tool-panel__tool-icon">⬡</span>
          <span className="tool-panel__tool-name">Polygon</span>
        </button>
      </div>

      {/* ── Brush size (only for draw/erase) ── */}
      {enabled && (isDrawActive || isEraseActive) && (
        <div className="tool-panel__brush-radius">
          <label className="tool-panel__brush-radius-label">
            Brush Size
          </label>
          <div className="tool-panel__brush-radius-control">
            <input
              type="range"
              min="0.001"
              max="0.05"
              step="0.001"
              value={selectionState.toolConfigs.brush.radius}
              onChange={(e) => handleBrushConfigUpdate({ radius: parseFloat(e.target.value) })}
              className="tool-panel__brush-radius-slider"
            />
            <span className="tool-panel__brush-radius-value">
              {selectionState.toolConfigs.brush.radius.toFixed(3)}
            </span>
          </div>
        </div>
      )}

      {/* ── Accumulate mode toggle ── */}
      <div className="tool-panel__mode-section">
        <h4 className="tool-panel__mode-title">Selection Mode</h4>
        <button
          className={`tool-panel__mode-button${selectionState.selectionMode === 'accumulate' ? ' active' : ''}`}
          onClick={handleSelectionModeToggle}
          disabled={!enabled}
          title="Accumulate keeps multiple brush strokes before assigning"
        >
          {selectionState.selectionMode === 'immediate' ? 'Single stroke' : 'Accumulate strokes'}
        </button>
      </div>

      {/* ── Advanced polygon settings ── */}
      {enabled && isPolygonActive && (
        <div className="tool-panel__config-section">
          <button
            className={`tool-panel__config-toggle${isConfigOpen ? ' active' : ''}`}
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            <span>Polygon Settings</span>
            <span className={`tool-panel__config-arrow${isConfigOpen ? ' open' : ''}`}>▼</span>
          </button>
          {isConfigOpen && (
            <div className="tool-panel__config-panel">
              <PolygonSelectConfigPanel
                config={selectionState.toolConfigs.polygon}
                onUpdate={handlePolygonConfigUpdate}
              />
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      <div className="tool-panel__history-section">
        <div className="tool-panel__history-controls">
          <button
            className="tool-panel__history-button"
            onClick={handleUndo}
            disabled={!enabled || !historyState.canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="tool-panel__history-button"
            onClick={handleRedo}
            disabled={!enabled || !historyState.canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
        </div>
      </div>

      {/* ── Pending selections (accumulate mode) ── */}
      {selectionState.selectionMode === 'accumulate' && pendingCount.areas > 0 && (
        <div className="tool-panel__pending-section">
          <div className="tool-panel__pending-stats">
            <span className="tool-panel__pending-label">Pending:</span>
            <span className="tool-panel__pending-value">
              {pendingCount.points} pts ({pendingCount.areas} areas)
            </span>
          </div>
          <div className="tool-panel__pending-controls">
            <button
              className="tool-panel__confirm-button"
              onClick={handleConfirmSelections}
              disabled={!selectionState.activeLabel}
              title="Assign pending (Ctrl+S)"
            >
              ✓ Assign
            </button>
            <button
              className="tool-panel__clear-button"
              onClick={handleClearPendingSelections}
            >
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Current selection status ── */}
      {selectionState.currentSelection && (
        <div className="tool-panel__status">
          <div className="tool-panel__status-item">
            <span className="tool-panel__status-label">Selected</span>
            <span className="tool-panel__status-value">
              {selectionState.currentSelection.length.toLocaleString()} pts
            </span>
          </div>
          {selectionState.selectionMode === 'immediate' && (
            <button
              className="tool-panel__assign-button"
              onClick={() => selectionManager.assignSelectionToLabel()}
              disabled={!selectionState.activeLabel}
              title="Assign to active label (Ctrl+S)"
            >
              Assign to {selectionState.activeLabel?.name ?? 'a label'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Polygon Select Configuration Panel
interface PolygonSelectConfigPanelProps {
  config: PolygonSelectConfig
  onUpdate: (config: Partial<PolygonSelectConfig>) => void
}

const PolygonSelectConfigPanel: React.FC<PolygonSelectConfigPanelProps> = ({ config, onUpdate }) => {
  return (
    <div className="tool-config-panel">
      <h4 className="tool-config-panel__title">Polygon Settings</h4>
      
      <div className="tool-config-panel__field">
        <label className="tool-config-panel__label">Projection Plane</label>
        <select
          value={config.projectionPlane}
          onChange={(e) => onUpdate({ projectionPlane: e.target.value as PolygonSelectConfig['projectionPlane'] })}
          className="tool-config-panel__select"
        >
          <option value="camera">Camera View</option>
          <option value="xy">XY Plane</option>
          <option value="xz">XZ Plane</option>
          <option value="yz">YZ Plane</option>
        </select>
      </div>

      <div className="tool-config-panel__field">
        <label className="tool-config-panel__checkbox">
          <input
            type="checkbox"
            checked={config.includeOccluded}
            onChange={(e) => onUpdate({ includeOccluded: e.target.checked })}
          />
          <span>Include Occluded Points</span>
        </label>
      </div>

      {config.depth !== undefined && (
        <div className="tool-config-panel__field">
          <label className="tool-config-panel__label">Selection Depth</label>
          <div className="tool-config-panel__range">
            <input
              type="range"
              min="0.1"
              max="10.0"
              step="0.1"
              value={config.depth}
              onChange={(e) => onUpdate({ depth: parseFloat(e.target.value) })}
              className="tool-config-panel__slider"
            />
            <span className="tool-config-panel__value">{config.depth.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ToolPanel
