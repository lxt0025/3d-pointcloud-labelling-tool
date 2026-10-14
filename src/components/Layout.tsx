/**
 * Layout Component
 * 
 * This component provides the overall layout structure for the Point Cloud Labelling Tool.
 * It establishes the main application layout with areas for:
 * - Header/Navigation
 * - 3D Viewport (main content area)
 * - Tool panels (sidebar)
 * - Status bar/Footer
 * 
 * The layout is responsive and optimized for extended labelling sessions.
 */

import { useState, useEffect, useCallback } from 'react'
import BasicViewport from './BasicViewport'
import LabelEditor from './LabelEditor'
import ProjectPanel from './ProjectPanel'
import StatusBar from './StatusBar'
import CubeControls from './CubeControls'
import ShortcutsPanel from './ShortcutsPanel'
import AxisSnapping, { type AxisView } from './AxisSnapping'
import type {
  PointCloudData,
  Label,
  EnhancedProject,
  ProjectFile,
  CubeSelectionState,
} from '../types/index'
import ToolPanel from './ToolPanel'
import { selectionManager } from '../utils/selectionManager'

/**
 * Main Layout Component for Point Cloud Labelling Tool
 * 
 * This component provides the overall application layout including:
 * - Application header with branding and main controls
 * - Left sidebar with tools and file upload
 * - Central viewport for 3D point cloud visualization
 * - Right sidebar with labels and statistics
 * - Footer with status information
 * 
 * The layout is responsive and adapts to different screen sizes.
 */
interface LayoutProps {
  currentProject: EnhancedProject
}

const Layout: React.FC<LayoutProps> = ({ currentProject }) => {
  // Application state
  const [currentPointCloud, setCurrentPointCloud] = useState<PointCloudData | null>(null)
  const [pointSize, setPointSize] = useState(0.001)
  
  // Label management state
  const [labels, setLabels] = useState<Label[]>([])
  const [activeLabel, setActiveLabel] = useState<Label | null>(null)

  // Selection state for integration with tools
  const [selectedPointCount, setSelectedPointCount] = useState(0)

  // Cube controls state
  const [showCubeControls, setShowCubeControls] = useState(false)
  const [cubeState, setCubeState] = useState<CubeSelectionState>(selectionManager.getCubeSelectionData())

  // Label management handlers
  const handleLabelSelect = useCallback((label: Label | null) => {
    setActiveLabel(label)
    selectionManager.setActiveLabel(label)
  }, [])

  const handleLabelsChange = useCallback((updatedLabels: Label[]) => {
    setLabels(updatedLabels)
  }, [])

  const handleFillUnlabeled = useCallback(() => {
    return selectionManager.assignAllUnlabeledToActiveLabel()
  }, [])

  const handleDatasetAdded = useCallback((_file: ProjectFile) => {
    // ProjectPanel handles the actual file processing
  }, [])

  const handlePointCloudChange = useCallback((pointCloud: PointCloudData | null) => {
    setCurrentPointCloud(pointCloud)
  }, [])

  // Cube controls handlers
  const handleCubeChange = useCallback((newCubeState: CubeSelectionState) => {
    setCubeState(newCubeState)
    selectionManager.updateCubeSelection(newCubeState)
  }, [])

  const handleCloseCubeControls = useCallback(() => {
    setShowCubeControls(false)
  }, [])

  // Axis snapping handler
  const handleAxisSnap = useCallback((axis: AxisView) => {
    window.dispatchEvent(new CustomEvent('axisSnap', { detail: axis }))
  }, [])

  // Initialise empty label list on mount
  useEffect(() => {
    setLabels([])
  }, [])

  // Selection update handler
  useEffect(() => {
    const handleSelectionUpdate = () => {
      const stats = selectionManager.getStatistics()
      setSelectedPointCount(stats.currentSelectionSize)
    }

    const handlePointsAssigned = (_data: { labelId: string; pointIndices: number[] }) => {
      // Trigger re-render via selection stats update
      handleSelectionUpdate()
    }

    // Cube event handlers
    const handleCubeStarted = (cubeData: CubeSelectionState) => {
      setCubeState(cubeData)
      setShowCubeControls(true)
    }

    const handleCubeUpdated = (cubeData: CubeSelectionState) => {
      setCubeState(cubeData)
    }

    const handleCubeEnded = () => {
      setShowCubeControls(false)
    }

    selectionManager.on('selection:created', handleSelectionUpdate)
    selectionManager.on('selection:updated', handleSelectionUpdate)
    selectionManager.on('selection:cleared', handleSelectionUpdate)
    selectionManager.on('points:assigned', handlePointsAssigned)
    selectionManager.on('cube:started', handleCubeStarted)
    selectionManager.on('cube:updated', handleCubeUpdated)
    selectionManager.on('cube:ended', handleCubeEnded)

    return () => {
      selectionManager.off('selection:created', handleSelectionUpdate)
      selectionManager.off('selection:updated', handleSelectionUpdate)
      selectionManager.off('selection:cleared', handleSelectionUpdate)
      selectionManager.off('points:assigned', handlePointsAssigned)
      selectionManager.off('cube:started', handleCubeStarted)
      selectionManager.off('cube:updated', handleCubeUpdated)
      selectionManager.off('cube:ended', handleCubeEnded)
    }
  }, [])

  // Sync active label with selection manager
  useEffect(() => {
    selectionManager.setActiveLabel(activeLabel)
  }, [activeLabel])

  const exportLabeledDataset = useCallback(() => {
    if (!currentPointCloud) return

    const statistics = selectionManager.getStatistics()
    if (statistics.totalAssignedPoints === 0) return

    type ExportPoint = {
      x: number; y: number; z: number
      r?: number; g?: number; b?: number
      label: string; labelId: string
    }

    const exportData = {
      metadata: {
        filename: currentPointCloud.metadata.filename,
        format: currentPointCloud.metadata.format,
        totalPoints: currentPointCloud.metadata.pointCount,
        labeledPoints: statistics.totalAssignedPoints,
        exportedAt: new Date().toISOString(),
        labels: labels.map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          pointCount: label.pointCount,
        })),
      },
      data: [] as ExportPoint[],
    }

    const positions = currentPointCloud.positions
    const colors = currentPointCloud.colors

    for (let i = 0; i < positions.length - 2; i += 3) {
      const pointIndex = i / 3
      const labelId = selectionManager.getPointLabel(pointIndex)
      if (!labelId) continue
      const label = labels.find(l => l.id === labelId)
      if (!label) continue

      const point: ExportPoint = {
        x: positions[i] ?? 0,
        y: positions[i + 1] ?? 0,
        z: positions[i + 2] ?? 0,
        label: label.name,
        labelId: label.id,
      }

      if (colors && i + 2 < colors.length) {
        point.r = colors[i] ?? 0
        point.g = colors[i + 1] ?? 0
        point.b = colors[i + 2] ?? 0
      }

      exportData.data.push(point)
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentPointCloud.metadata.filename}_labeled.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [currentPointCloud, labels])

  const labeledPoints = labels.reduce((sum, l) => sum + l.pointCount, 0)
  const totalPointCount = currentPointCloud
    ? Math.floor(currentPointCloud.positions.length / 3)
    : 0
  const unlabeledPointCount = Math.max(
    0,
    totalPointCount - selectionManager.getStatistics().totalAssignedPoints,
  )
  const progressPct = currentPointCloud
    ? Math.round(labeledPoints / currentPointCloud.metadata.pointCount * 100) || 0
    : 0

  return (
    <div className="layout">
      <header className="layout__header">
        <h1 className="layout__title">PointCloud Labeller</h1>
        <span className="layout__project-name">{currentProject.metadata.name}</span>
      </header>

      <div className="layout__main">
        {/* ── Left sidebar ── */}
        <aside className="sidebar sidebar--left">

          <div className="sidebar-section">
            <div className="sidebar-section__label">Current File</div>
            {currentPointCloud ? (
              <div className="sidebar-section__body">
                <div className="file-info__name" title={currentPointCloud.metadata.filename}>
                  {currentPointCloud.metadata.filename}
                </div>
                <div className="file-info__meta">
                  {currentPointCloud.metadata.pointCount.toLocaleString()} pts
                  &ensp;·&ensp;
                  {(currentPointCloud.metadata.fileSize / (1024 * 1024)).toFixed(1)} MB
                  &ensp;·&ensp;
                  {currentPointCloud.metadata.format}
                </div>
              </div>
            ) : (
              <p className="sidebar-section__empty">
                No file loaded — add a dataset from the Project panel
              </p>
            )}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section__label">
              Point Size
              <span className="sidebar-section__badge">{pointSize.toFixed(4)}</span>
            </div>
            <div className="sidebar-section__body">
              <input
                type="range"
                min="0.001"
                max="0.5"
                step="0.001"
                value={pointSize}
                onChange={(e) => setPointSize(parseFloat(e.target.value))}
                className="range-slider"
                disabled={!currentPointCloud}
              />
              <div className="preset-row">
                {([['XS', 0.001], ['S', 0.002], ['M', 0.005], ['L', 0.01]] as [string, number][]).map(([label, val]) => (
                  <button
                    key={label}
                    className={`preset-btn${pointSize === val ? ' preset-btn--active' : ''}`}
                    onClick={() => setPointSize(val)}
                    disabled={!currentPointCloud}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section__label">Statistics</div>
            <div className="stats-list">
              <div className="stats-list__row">
                <span>Total points</span>
                <span>{currentPointCloud?.metadata.pointCount.toLocaleString() ?? '—'}</span>
              </div>
              <div className="stats-list__row">
                <span>Labeled</span>
                <span>{labeledPoints.toLocaleString()}</span>
              </div>
              <div className="stats-list__row">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="stats-list__row">
                <span>Labels</span>
                <span>{labels.filter(l => l.visible).length} visible / {labels.length}</span>
              </div>
            </div>
          </div>

          <div className="sidebar-section sidebar-section--flush">
            <ShortcutsPanel enabled={!!currentPointCloud} />
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section__label">Camera Views</div>
            <AxisSnapping
              enabled={!!currentPointCloud}
              onSnapToAxis={handleAxisSnap}
            />
          </div>

        </aside>

        {/* ── Viewport ── */}
        <main className="layout__viewport">
          <BasicViewport
            pointCloud={currentPointCloud}
            pointSize={pointSize}
          />
        </main>

        {/* ── Right sidebar ── */}
        <aside className="sidebar sidebar--right">

          <ProjectPanel
            currentProject={currentProject}
            pointCloud={currentPointCloud}
            onDatasetAdded={handleDatasetAdded}
            onPointCloudChange={handlePointCloudChange}
          />

          <div className="sidebar-section sidebar-section--flush">
            <ToolPanel
              enabled={!!currentPointCloud}
              onToolChange={(_tool) => { /* managed by selectionManager */ }}
            />
            {selectedPointCount > 0 && (
              <div className="selection-info">
                <span className="selection-info__count">{selectedPointCount.toLocaleString()} selected</span>
                {activeLabel && (
                  <button
                    className="btn btn--primary btn--sm selection-info__assign"
                    onClick={() => {
                      if (selectionManager.assignSelectionToLabel()) setSelectedPointCount(0)
                    }}
                  >
                    Assign to &ldquo;{activeLabel.name}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="sidebar-section sidebar-section--grow sidebar-section--flush">
            <LabelEditor
              activeLabel={activeLabel}
              onLabelSelect={handleLabelSelect}
              onLabelsChange={handleLabelsChange}
              unlabeledPointCount={unlabeledPointCount}
              onFillUnlabeled={handleFillUnlabeled}
            />
          </div>

          <div className="sidebar-section sidebar-section--export">
            <div className="sidebar-section__label">Export Dataset</div>
            {!currentPointCloud || labeledPoints === 0 ? (
              <p className="sidebar-section__empty">
                {!currentPointCloud
                  ? 'Load a file to enable export'
                  : 'Label some points to enable export'}
              </p>
            ) : (
              <div className="sidebar-section__body">
                <div className="stats-list" style={{ marginBottom: '10px' }}>
                  <div className="stats-list__row">
                    <span>Labeled points</span>
                    <span>{labeledPoints.toLocaleString()}</span>
                  </div>
                  <div className="stats-list__row">
                    <span>Active labels</span>
                    <span>{labels.filter(l => l.pointCount > 0).length}</span>
                  </div>
                </div>
                <button
                  className="btn btn--primary btn--full"
                  onClick={exportLabeledDataset}
                >
                  Export as JSON
                </button>
              </div>
            )}
          </div>

        </aside>
      </div>

      <CubeControls
        cubeState={cubeState}
        onCubeChange={handleCubeChange}
        visible={showCubeControls}
        onClose={handleCloseCubeControls}
      />

      <StatusBar
        currentFile={currentPointCloud}
        activeLabel={activeLabel}
        selectedPoints={selectedPointCount}
        isProcessing={false}
        processingProgress={0}
        processingMessage=""
        isReady={true}
        error={null}
        className="layout__status-bar"
      />
    </div>
  )
}

export default Layout
