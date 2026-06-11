/**
 * CubeControls Component
 * 
 * Provides advanced 3D cube selection with visual feedback and interactive controls
 */

import React, { useState, useCallback, useEffect } from 'react'
import type { CubeSelectionState } from '../types/index'
import { selectionManager } from '../utils/selectionManager'
import { Vector3 } from 'three'

interface CubeControlsProps {
  /** Current cube selection state */
  cubeState: CubeSelectionState
  /** Callback when cube state changes */
  onCubeChange: (state: CubeSelectionState) => void
  /** Whether controls are visible */
  visible: boolean
  /** Callback to close controls */
  onClose: () => void
}

const CubeControls: React.FC<CubeControlsProps> = ({
  cubeState,
  onCubeChange,
  visible,
  onClose,
}) => {
  const [localState, setLocalState] = useState<CubeSelectionState>(cubeState)

  // Update local state when props change
  useEffect(() => {
    setLocalState(cubeState)
  }, [cubeState])

  // Update center position
  const updateCenter = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    const newState = { ...localState }
    newState.center = new Vector3(
      axis === 'x' ? value : localState.center.x,
      axis === 'y' ? value : localState.center.y,
      axis === 'z' ? value : localState.center.z,
    )
    setLocalState(newState)
    onCubeChange(newState)
  }, [localState, onCubeChange])

  // Update size
  const updateSize = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    const newState = { ...localState }
    newState.size = new Vector3(
      axis === 'x' ? Math.max(0.1, value) : localState.size.x,
      axis === 'y' ? Math.max(0.1, value) : localState.size.y,
      axis === 'z' ? Math.max(0.1, value) : localState.size.z,
    )
    setLocalState(newState)
    onCubeChange(newState)
  }, [localState, onCubeChange])

  // Update rotation
  const updateRotation = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    const newState = { ...localState }
    newState.rotation = new Vector3(
      axis === 'x' ? value : localState.rotation.x,
      axis === 'y' ? value : localState.rotation.y,
      axis === 'z' ? value : localState.rotation.z,
    )
    setLocalState(newState)
    onCubeChange(newState)
  }, [localState, onCubeChange])

  // Reset cube to default
  const resetCube = useCallback(() => {
    const newState = {
      ...localState,
      center: new Vector3(0, 0, 0),
      size: new Vector3(1, 1, 1),
      rotation: new Vector3(0, 0, 0),
    }
    setLocalState(newState)
    onCubeChange(newState)
  }, [localState, onCubeChange])

  const confirmSelection = useCallback(() => {
    const success = selectionManager.confirmCubeSelection()
    if (success) onClose()
  }, [onClose])

  const cancelSelection = useCallback(() => {
    selectionManager.cancelCubeSelection()
    onClose()
  }, [onClose])

  if (!visible) return null

  return (
    <div className="cube-controls">
      <div className="cube-controls__header">
        <h4 className="cube-controls__title">3D Cube Selection</h4>
        <button 
          className="cube-controls__close"
          onClick={onClose}
          title="Close controls"
        >
          ✕
        </button>
      </div>

      <div className="cube-controls__content">
        {/* Position Controls */}
        <div className="cube-controls__section">
          <h5 className="cube-controls__section-title">Position</h5>
          <div className="cube-controls__row">
            <label className="cube-controls__label">X:</label>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.1"
              value={localState.center.x}
              onChange={(e) => updateCenter('x', parseFloat(e.target.value))}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="0.1"
              value={localState.center.x.toFixed(2)}
              onChange={(e) => updateCenter('x', parseFloat(e.target.value))}
              className="cube-controls__input"
            />
          </div>
          <div className="cube-controls__row">
            <label className="cube-controls__label">Y:</label>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.1"
              value={localState.center.y}
              onChange={(e) => updateCenter('y', parseFloat(e.target.value))}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="0.1"
              value={localState.center.y.toFixed(2)}
              onChange={(e) => updateCenter('y', parseFloat(e.target.value))}
              className="cube-controls__input"
            />
          </div>
          <div className="cube-controls__row">
            <label className="cube-controls__label">Z:</label>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.1"
              value={localState.center.z}
              onChange={(e) => updateCenter('z', parseFloat(e.target.value))}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="0.1"
              value={localState.center.z.toFixed(2)}
              onChange={(e) => updateCenter('z', parseFloat(e.target.value))}
              className="cube-controls__input"
            />
          </div>
        </div>

        {/* Size Controls */}
        <div className="cube-controls__section">
          <h5 className="cube-controls__section-title">Size</h5>
          <div className="cube-controls__row">
            <label className="cube-controls__label">Width:</label>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={localState.size.x}
              onChange={(e) => updateSize('x', parseFloat(e.target.value))}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={localState.size.x.toFixed(2)}
              onChange={(e) => updateSize('x', parseFloat(e.target.value))}
              className="cube-controls__input"
            />
          </div>
          <div className="cube-controls__row">
            <label className="cube-controls__label">Height:</label>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={localState.size.y}
              onChange={(e) => updateSize('y', parseFloat(e.target.value))}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={localState.size.y.toFixed(2)}
              onChange={(e) => updateSize('y', parseFloat(e.target.value))}
              className="cube-controls__input"
            />
          </div>
          <div className="cube-controls__row">
            <label className="cube-controls__label">Depth:</label>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={localState.size.z}
              onChange={(e) => updateSize('z', parseFloat(e.target.value))}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={localState.size.z.toFixed(2)}
              onChange={(e) => updateSize('z', parseFloat(e.target.value))}
              className="cube-controls__input"
            />
          </div>
        </div>

        {/* Rotation Controls */}
        <div className="cube-controls__section">
          <h5 className="cube-controls__section-title">Rotation (degrees)</h5>
          <div className="cube-controls__row">
            <label className="cube-controls__label">X:</label>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={Math.round((localState.rotation.x * 180) / Math.PI)}
              onChange={(e) => updateRotation('x', (parseFloat(e.target.value) * Math.PI) / 180)}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="5"
              value={Math.round((localState.rotation.x * 180) / Math.PI)}
              onChange={(e) => updateRotation('x', (parseFloat(e.target.value) * Math.PI) / 180)}
              className="cube-controls__input"
            />
          </div>
          <div className="cube-controls__row">
            <label className="cube-controls__label">Y:</label>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={Math.round((localState.rotation.y * 180) / Math.PI)}
              onChange={(e) => updateRotation('y', (parseFloat(e.target.value) * Math.PI) / 180)}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="5"
              value={Math.round((localState.rotation.y * 180) / Math.PI)}
              onChange={(e) => updateRotation('y', (parseFloat(e.target.value) * Math.PI) / 180)}
              className="cube-controls__input"
            />
          </div>
          <div className="cube-controls__row">
            <label className="cube-controls__label">Z:</label>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={Math.round((localState.rotation.z * 180) / Math.PI)}
              onChange={(e) => updateRotation('z', (parseFloat(e.target.value) * Math.PI) / 180)}
              className="cube-controls__slider"
            />
            <input
              type="number"
              step="5"
              value={Math.round((localState.rotation.z * 180) / Math.PI)}
              onChange={(e) => updateRotation('z', (parseFloat(e.target.value) * Math.PI) / 180)}
              className="cube-controls__input"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="cube-controls__section">
          <h5 className="cube-controls__section-title">Quick Actions</h5>
          <div className="cube-controls__actions">
            <button
              className="cube-controls__button cube-controls__button--secondary"
              onClick={resetCube}
            >
              Reset
            </button>
            <button
              className="cube-controls__button cube-controls__button--primary"
              onClick={confirmSelection}
            >
              Apply Selection
            </button>
            <button
              className="cube-controls__button cube-controls__button--secondary"
              onClick={cancelSelection}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Volume Info */}
        <div className="cube-controls__info">
          <div className="cube-controls__info-item">
            <span className="cube-controls__info-label">Volume:</span>
            <span className="cube-controls__info-value">
              {(localState.size.x * localState.size.y * localState.size.z).toFixed(2)} units³
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CubeControls 