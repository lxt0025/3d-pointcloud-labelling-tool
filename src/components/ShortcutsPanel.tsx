/**
 * Shortcuts Panel Component
 * 
 * Displays keyboard shortcuts and mouse mode controls in the left sidebar
 */

import React, { useState, useEffect, useCallback } from 'react'
import { selectionManager } from '../utils/selectionManager'

// Define keyboard shortcuts
type KeybindConfig = {
  action: string
  label: string
  description: string
  modifier?: string
}

const KEYBINDS: Record<string, KeybindConfig> = {
  'KeyB': { action: 'brush_add', label: 'B', description: 'Draw brush' },
  'KeyV': { action: 'brush_subtract', label: 'V', description: 'Erase brush' },
  'KeyP': { action: 'polygon', label: 'P', description: 'Polygon select' },
  'KeyM': { action: 'mouse_mode', label: 'M', description: 'Toggle navigate mode' },
  'KeyZ': { action: 'undo', label: 'Z', description: 'Undo', modifier: 'Ctrl' },
  'KeyY': { action: 'redo', label: 'Y', description: 'Redo', modifier: 'Ctrl' },
  'KeyS': { action: 'save_selection', label: 'S', description: 'Assign selection', modifier: 'Ctrl' },
}

export type MouseMode = 'select' | 'navigate'

export interface ShortcutsPanelProps {
  className?: string
  enabled?: boolean
}

export const ShortcutsPanel: React.FC<ShortcutsPanelProps> = ({
  className = '',
  enabled = true,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [mouseMode, setMouseMode] = useState<MouseMode>('select')

  const toggleMouseMode = useCallback(() => {
    const newMode: MouseMode = mouseMode === 'select' ? 'navigate' : 'select'
    setMouseMode(newMode)
    window.dispatchEvent(new CustomEvent('mouseModeChange', { detail: newMode }))
  }, [mouseMode])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return
    
    // Don't handle shortcuts if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const key = event.code
    const isCtrlPressed = event.ctrlKey || event.metaKey
    
    switch (key) {
      case 'KeyB':
        if (!isCtrlPressed) {
          event.preventDefault()
          selectionManager.setActiveTool('brush')
          selectionManager.updateToolConfig('brush', { mode: 'add' })
        }
        break
      case 'KeyV':
        if (!isCtrlPressed) {
          event.preventDefault()
          selectionManager.setActiveTool('brush')
          selectionManager.updateToolConfig('brush', { mode: 'subtract' })
        }
        break
      case 'KeyP':
        if (!isCtrlPressed) {
          event.preventDefault()
          selectionManager.setActiveTool('polygon')
        }
        break
      case 'KeyM':
        if (!isCtrlPressed) {
          event.preventDefault()
          toggleMouseMode()
        }
        break
      case 'KeyZ':
        if (isCtrlPressed) {
          event.preventDefault()
          selectionManager.undo()
        }
        break
      case 'KeyY':
        if (isCtrlPressed) {
          event.preventDefault()
          selectionManager.redo()
        }
        break
      case 'KeyS':
        if (isCtrlPressed) {
          event.preventDefault()
          const selectionState = selectionManager.getState()
          // Save selection - either assign immediately or confirm pending
          if (selectionState.selectionMode === 'accumulate' && selectionState.pendingSelections.length > 0) {
            selectionManager.confirmPendingSelections()
          } else if (selectionState.currentSelection && selectionState.currentSelection.length > 0) {
            selectionManager.assignSelectionToLabel()
          }
        }
        break
    }
  }, [enabled, toggleMouseMode])

  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <div className={`shortcuts-panel ${className}`}>
      <div className="shortcuts-panel__header">
        <button
          className={`shortcuts-panel__toggle ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>Shortcuts</span>
          <span className={`shortcuts-panel__arrow ${isOpen ? 'open' : ''}`}>
            ▼
          </span>
        </button>
      </div>

      {/* Mouse Mode Toggle */}
      <div className="shortcuts-panel__mouse-mode">
        <button
          className={`shortcuts-panel__mode-button ${mouseMode === 'navigate' ? 'active' : ''}`}
          onClick={toggleMouseMode}
          disabled={!enabled}
          title="Toggle between select and navigate modes (M)"
        >
          <span className="shortcuts-panel__mode-text">
            {mouseMode === 'select' ? 'Select Mode' : 'Navigate Mode'}
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="shortcuts-panel__list">
          {Object.entries(KEYBINDS).map(([key, bind]) => (
            <div key={key} className="shortcuts-panel__keybind">
              <span className="shortcuts-panel__keybind-key">
                {bind.modifier && <span className="shortcuts-panel__keybind-modifier">{bind.modifier}+</span>}
                {bind.label}
              </span>
              <span className="shortcuts-panel__keybind-desc">{bind.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ShortcutsPanel 