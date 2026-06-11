/**
 * Axis Snapping Component
 * 
 * This component provides quick access to snap the camera to different axis views
 * for better alignment and orientation in 3D space.
 */

import React from 'react'

export interface AxisSnappingProps {
  /** CSS class name */
  className?: string
  /** Callback when axis view is selected */
  onSnapToAxis?: (axis: AxisView) => void
  /** Whether the controls are enabled */
  enabled?: boolean
}

export type AxisView = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'isometric'

interface AxisOption {
  view: AxisView
  label: string
  icon: string
  description: string
}

const axisOptions: AxisOption[] = [
  { view: 'top', label: 'Top', icon: '', description: 'View from above (Y+)' },
  { view: 'bottom', label: 'Bottom', icon: '', description: 'View from below (Y-)' },
  { view: 'front', label: 'Front', icon: '', description: 'Front view (Z+)' },
  { view: 'back', label: 'Back', icon: '', description: 'Back view (Z-)' },
  { view: 'left', label: 'Left', icon: '', description: 'Left side view (X-)' },
  { view: 'right', label: 'Right', icon: '', description: 'Right side view (X+)' },
  { view: 'isometric', label: 'ISO', icon: '', description: 'Isometric view' },
]

export const AxisSnapping: React.FC<AxisSnappingProps> = ({
  className = '',
  onSnapToAxis,
  enabled = true,
}) => {
  const handleSnapToAxis = (axis: AxisView) => {
    if (!enabled) return
    onSnapToAxis?.(axis)
  }

  return (
    <div className={`axis-snapping ${className}`}>
      <div className="axis-snapping__header">
        <h4 className="axis-snapping__title">Quick Views</h4>
        <span className="axis-snapping__subtitle">Snap to axis</span>
      </div>
      
      <div className="axis-snapping__grid">
        {axisOptions.map((option) => (
          <button
            key={option.view}
            className="axis-snapping__button"
            onClick={() => handleSnapToAxis(option.view)}
            disabled={!enabled}
            title={option.description}
          >
            <span className="axis-snapping__label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default AxisSnapping 