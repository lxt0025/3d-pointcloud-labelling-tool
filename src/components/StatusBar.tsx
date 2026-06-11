/**
 * Status Bar Component
 * 
 * Provides real-time status information at the bottom of the application including:
 * - Current file information
 * - Processing status
 * - Selection status
 * - Performance metrics
 * - Application state indicators
 */

import React, { useState, useEffect } from 'react'
import type { PointCloudData, Label } from '../types/index'

export interface StatusBarProps {
  /** Current point cloud file */
  currentFile?: PointCloudData | null
  /** Currently active label */
  activeLabel?: Label | null
  /** Number of selected points */
  selectedPoints?: number
  /** Processing status */
  isProcessing?: boolean
  /** Processing progress (0-1) */
  processingProgress?: number
  /** Processing message */
  processingMessage?: string
  /** Application ready state */
  isReady?: boolean
  /** Error message if any */
  error?: string | null
  /** Additional status messages */
  statusMessage?: string
  /** CSS class name */
  className?: string
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentFile,
  activeLabel,
  selectedPoints = 0,
  isProcessing = false,
  processingProgress = 0,
  processingMessage = '',
  isReady = true,
  error = null,
  statusMessage = '',
  className = '',
}) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))  } ${  sizes[i]}`
  }

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString()
  }

  // Get status indicator
  const getStatusIndicator = () => {
    if (error) return { text: 'Error', className: 'status-indicator--error' }
    if (isProcessing) return { text: 'Processing', className: 'status-indicator--processing' }
    if (!isReady) return { text: 'Loading', className: 'status-indicator--loading' }
    return { text: 'Ready', className: 'status-indicator--ready' }
  }

  const status = getStatusIndicator()

  return (
    <footer className={`status-bar ${className}`}>
      <div className="status-bar__content">
        {/* Left Section: Status Indicator */}
        <div className="status-bar__section status-bar__section--left">
          <div className={`status-indicator ${status.className}`}>
            <span className="status-indicator__dot" />
            <span className="status-indicator__text">{status.text}</span>
          </div>
          
          {error && (
            <div className="status-error">
              <span className="status-error__text">{error}</span>
            </div>
          )}
          
          {statusMessage && !error && (
            <div className="status-message">
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Center Section: File and Processing Info */}
        <div className="status-bar__section status-bar__section--center">
          {isProcessing && (
            <div className="processing-status">
              <div className="processing-status__bar">
                <div 
                  className="processing-status__fill"
                  style={{ width: `${processingProgress * 100}%` }}
                />
              </div>
              <span className="processing-status__text">
                {processingMessage} ({Math.round(processingProgress * 100)}%)
              </span>
            </div>
          )}
          
          {!isProcessing && currentFile && (
            <div className="file-status">
              <span className="file-status__name">
                {currentFile.metadata.filename}
              </span>
              <span className="file-status__separator">•</span>
              <span className="file-status__points">
                {formatNumber(currentFile.metadata.pointCount)} points
              </span>
              <span className="file-status__separator">•</span>
              <span className="file-status__size">
                {formatFileSize(currentFile.metadata.fileSize)}
              </span>
              {currentFile.metadata.hasColors && (
                <>
                  <span className="file-status__separator">•</span>
                  <span className="file-status__feature">RGB</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Selection and Tools */}
        <div className="status-bar__section status-bar__section--right">
          {selectedPoints > 0 && (
            <div className="selection-status">
              <span className="selection-status__count">
                {formatNumber(selectedPoints)} selected
              </span>
              {activeLabel && (
                <>
                  <span className="selection-status__separator">→</span>
                  <div className="selection-status__label">
                    <div 
                      className="selection-status__color"
                      style={{ backgroundColor: activeLabel.color }}
                    />
                    <span className="selection-status__name">
                      {activeLabel.name}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          
          {!selectedPoints && activeLabel && (
            <div className="active-label-status">
              <span className="active-label-status__text">Active:</span>
              <div className="active-label-status__label">
                <div 
                  className="active-label-status__color"
                  style={{ backgroundColor: activeLabel.color }}
                />
                <span className="active-label-status__name">
                  {activeLabel.name}
                </span>
              </div>
            </div>
          )}

          <div className="status-bar__time">
            {currentTime.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit', 
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default StatusBar 