'use client'

import React, { useRef, useState, useImperativeHandle, forwardRef, Suspense, useEffect } from 'react'
import { Canvas, useThree, useLoader, ThreeEvent, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, useGLTF, Environment, Center, Line, Bounds, Grid, Bvh, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { ToolType } from './ViewerToolbar'

// ============================================================================
// TYPES
// ============================================================================

export type Annotation = {
    id: string
    position: [number, number, number]
    normal: [number, number, number]
    text: string
    type?: 'note' | 'cloud'
    status?: 'open' | 'resolved'
}

export type Measurement = {
    id: string
    start: [number, number, number]
    end: [number, number, number]
    distance: number
}

export type CadViewerProps = {
    modelUrl: string
    modelName?: string
    annotations: Annotation[]
    activeTool: ToolType
    onAnnotate?: (data: { position: [number, number, number]; normal: [number, number, number] }, text: string) => void
    onAnnotationSelect?: (annotation: Annotation) => void
    onAnnotationUpdate?: (id: string, updates: Partial<Annotation>) => void
}

export type CadViewerRef = {
    exportCamera: () => { position: number[]; target: number[]; fov: number }
    takeSnapshot: () => string
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

class ModelErrorBoundary extends React.Component<
    { children: React.ReactNode; onError?: (error: Error) => void },
    { hasError: boolean; errorMessage: string }
> {
    constructor(props: any) {
        super(props)
        this.state = { hasError: false, errorMessage: '' }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, errorMessage: error.message || 'Unknown error' }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('3D Model Error:', error, errorInfo)
        this.props.onError?.(error)
    }

    render() {
        if (this.state.hasError) {
            return (
                <Html center>
                    <div className="bg-red-900/95 text-white p-6 rounded-xl border border-red-700 text-center max-w-sm backdrop-blur-md shadow-2xl">
                        <div className="text-4xl mb-3">⚠️</div>
                        <h3 className="font-bold text-lg mb-2">Model Load Failed</h3>
                        <p className="text-sm text-red-200 mb-4 break-words">
                            {this.state.errorMessage}
                        </p>
                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-red-300">
                                The file may be corrupted or in an unsupported format.
                            </p>
                            <button
                                onClick={() => this.setState({ hasError: false })}
                                className="mt-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </Html>
            )
        }
        return this.props.children
    }
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function LoadingProgress({ progress }: { progress: number }) {
    return (
        <Html center>
            <div className="bg-slate-900/90 text-white p-6 rounded-xl border border-slate-700 text-center min-w-[200px] backdrop-blur-md shadow-xl">
                <div className="text-3xl mb-3 animate-bounce">📦</div>
                <div className="text-sm font-medium mb-2">Loading Model...</div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-indigo-500 h-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="text-xs text-slate-400 mt-2 font-mono">{Math.round(progress)}%</div>
            </div>
        </Html>
    )
}

function SnapIndicator({ position, snapType }: { position: [number, number, number]; snapType?: 'vertex' | 'edge' | null }) {
    const meshRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        if (meshRef.current) {
            const scale = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.3
            meshRef.current.scale.setScalar(scale)
            const material = meshRef.current.material as THREE.Material
            material.opacity = 0.5 + Math.sin(state.clock.elapsedTime * 10) * 0.3
        }
    })

    return (
        <group>
            <mesh ref={meshRef} position={position}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshBasicMaterial color="#00ff00" transparent opacity={0.8} depthTest={false} />
            </mesh>
            {snapType && (
                <Html position={position} center>
                    <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase tracking-wider pointer-events-none whitespace-nowrap -translate-y-8">
                        {snapType === 'vertex' ? '● VERTEX' : '━ EDGE'}
                    </div>
                </Html>
            )}
        </group>
    )
}

// ... (in Annotation mapping) ...
/* 
   We update the Annotation UI to look sharper.
   The 'status' field would go here, but since we don't have DB migration access,
   we'll just style the existing implementation professionally.
*/


// ============================================================================
// MODEL LOADERS (Separate components to follow Rules of Hooks)
// ============================================================================

const DRACO_URL = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'

type ModelProps = {
    url: string
    onPointerDown?: (e: ThreeEvent<MouseEvent>) => void
    onLoad: () => void
}

function GltfModel({ url, onPointerDown, onLoad }: ModelProps) {
    const gltf = useGLTF(url, DRACO_URL)

    useEffect(() => {
        onLoad()
    }, [gltf, onLoad])

    return <primitive object={gltf.scene} onPointerDown={onPointerDown} />
}

function StlModel({ url, onPointerDown, onLoad }: ModelProps) {
    const geometry = useLoader(STLLoader, url)

    useEffect(() => {
        onLoad()
    }, [geometry, onLoad])

    return (
        <mesh geometry={geometry} onPointerDown={onPointerDown}>
            <meshStandardMaterial color="#a0a0a0" metalness={0.5} roughness={0.5} />
        </mesh>
    )
}

function ObjModel({ url, onPointerDown, onLoad }: ModelProps) {
    const obj = useLoader(OBJLoader, url)

    useEffect(() => {
        onLoad()
    }, [obj, onLoad])

    return <primitive object={obj} onPointerDown={onPointerDown} />
}

// ============================================================================
// INNER MODEL DISPATCHER
// ============================================================================

function InnerModel({
    url,
    fileExt,
    onPointerDown,
    onLoadProgress,
    onLoadComplete
}: {
    url: string
    fileExt?: string
    onPointerDown?: (e: ThreeEvent<MouseEvent>) => void
    onLoadProgress?: (progress: number) => void
    onLoadComplete?: () => void
}) {
    // Initial load progress
    useEffect(() => {
        onLoadProgress?.(10)
    }, [url, onLoadProgress])

    // Handler for successful load
    const handleLoad = () => {
        onLoadProgress?.(100)
        onLoadComplete?.()
    }

    if (fileExt === 'gltf' || fileExt === 'glb') {
        return <GltfModel url={url} onPointerDown={onPointerDown} onLoad={handleLoad} />
    }

    if (fileExt === 'stl') {
        return <StlModel url={url} onPointerDown={onPointerDown} onLoad={handleLoad} />
    }

    if (fileExt === 'obj') {
        return <ObjModel url={url} onPointerDown={onPointerDown} onLoad={handleLoad} />
    }

    // Unsupported format
    const isParametric = ['step', 'stp', 'sldprt', 'sldasm', 'asm', 'prt', 'ipt', 'iam', 'catpart'].includes(fileExt || '')

    if (isParametric) {
        throw new Error(`Browser cannot render .${fileExt?.toUpperCase()} files directly. Please convert to GLB or STL first.`)
    }

    // Unknown format
    return (
        <mesh onPointerDown={onPointerDown}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="red" wireframe />
        </mesh>
    )
}

// ============================================================================
// MAIN MODEL WRAPPER
// ============================================================================

function Model({
    url,
    name,
    onPointerDown,
    onLoadProgress,
    onLoadComplete
}: {
    url: string
    name?: string
    onPointerDown?: (e: ThreeEvent<MouseEvent>) => void
    onLoadProgress?: (progress: number) => void
    onLoadComplete?: () => void
}) {
    const extFromName = name?.split('.').pop()?.toLowerCase()
    const extFromUrl = url.split('.').pop()?.toLowerCase()
    // Prefer name extension if valid (short), otherwise URL
    const fileExt = (extFromName && extFromName.length < 6) ? extFromName : extFromUrl

    // Cleanup cache on unmount
    useEffect(() => {
        return () => {
            if (fileExt === 'gltf' || fileExt === 'glb') {
                useGLTF.clear(url)
            }
        }
    }, [url, fileExt])

    return (
        <ModelErrorBoundary>
            <InnerModel
                url={url}
                fileExt={fileExt}
                onPointerDown={onPointerDown}
                onLoadProgress={onLoadProgress}
                onLoadComplete={onLoadComplete}
            />
        </ModelErrorBoundary>
    )
}

// ============================================================================
// SNAPPING LOGIC (Pure Function)
// ============================================================================
const SNAP_TOLERANCE = 0.1

function findSnapPoint(event: ThreeEvent<MouseEvent>) {
    const intersects = event.intersections
    if (intersects.length === 0) return null

    const firstHit = intersects[0]
    const hitPoint = firstHit.point
    const object = firstHit.object

    // Try to find nearest vertex
    if (object instanceof THREE.Mesh && object.geometry) {
        const geometry = object.geometry
        const positionAttribute = geometry.getAttribute('position')

        if (positionAttribute) {
            let nearestVertex: THREE.Vector3 | null = null
            let minDistance = SNAP_TOLERANCE

            const vertex = new THREE.Vector3()
            const worldVertex = new THREE.Vector3()

            // Check all vertices (Optimization: could use spatial index, but brute force ok for low-poly)
            // Limit check to reasonable number of vertices for performance if needed
            const count = Math.min(positionAttribute.count, 10000)

            for (let i = 0; i < count; i++) {
                vertex.fromBufferAttribute(positionAttribute, i)
                worldVertex.copy(vertex).applyMatrix4(object.matrixWorld)

                const distance = hitPoint.distanceTo(worldVertex)
                if (distance < minDistance) {
                    minDistance = distance
                    nearestVertex = worldVertex.clone()
                }
            }

            if (nearestVertex) {
                return {
                    point: nearestVertex,
                    face: firstHit.face || null,
                    snapped: true,
                    snapType: 'vertex'
                }
            }
        }
    }

    // No snap found, return original hit point
    return {
        point: hitPoint,
        face: firstHit.face || null,
        snapped: false,
        snapType: null
    }
}

// ============================================================================
// VIEWER SCENE
// ============================================================================

const ViewerScene = forwardRef<CadViewerRef, CadViewerProps>(({
    modelUrl,
    modelName,
    annotations,
    activeTool,
    onAnnotate,
    onAnnotationSelect,
    onAnnotationUpdate
}, ref) => {
    const { camera, gl, scene } = useThree()
    const controlsRef = useRef<any>(null)
    const [measurements, setMeasurements] = useState<Measurement[]>([])
    const [tempPoint, setTempPoint] = useState<[number, number, number] | null>(null)
    const [snapPoint, setSnapPoint] = useState<[number, number, number] | null>(null)
    const [snapType, setSnapType] = useState<'vertex' | 'edge' | null>(null)
    const [loadProgress, setLoadProgress] = useState(0)
    const [isModelLoaded, setIsModelLoaded] = useState(false)
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

    // History for undo/redo
    const [measurementHistory, setMeasurementHistory] = useState<Measurement[][]>([])
    const [annotationHistory, setAnnotationHistory] = useState<Annotation[][]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)

    // Annotation Creation State
    const [isAnnotating, setIsAnnotating] = useState(false)
    const [newAnnotationPos, setNewAnnotationPos] = useState<{
        pos: [number, number, number]
        normal: [number, number, number]
    } | null>(null)
    const [tempText, setTempText] = useState('')

    // Update cursor based on active tool
    useEffect(() => {
        const canvas = gl.domElement
        if (!canvas) return

        if (activeTool === 'measure') canvas.style.cursor = 'crosshair'
        else if (activeTool === 'comment' || activeTool === 'cloud') canvas.style.cursor = 'copy'
        else canvas.style.cursor = 'default'
    }, [activeTool, gl.domElement])

    // ------------------------------------------------------------------------
    // INTERACTION HANDLERS (Regular functions, no useCallback to avoid loops)
    // ------------------------------------------------------------------------

    const handlePointerDown = (e: ThreeEvent<MouseEvent>) => {
        console.log('[CadViewer] Pointer down detected', { activeTool, isAnnotating })

        if (activeTool === 'select' || isAnnotating) {
            console.log('[CadViewer] Ignoring click - tool is select or annotating')
            return
        }

        e.stopPropagation()

        const snapResult = findSnapPoint(e)
        if (!snapResult) {
            console.log('[CadViewer] No snap result found')
            return
        }

        const { point, face, snapped } = snapResult
        const normal = face?.normal || new THREE.Vector3(0, 1, 0)
        const pArray = point.toArray() as [number, number, number]

        console.log('[CadViewer] Snap result:', { snapped, point: pArray, activeTool, snapType: snapResult.snapType })

        // Snap feedback with type indicator
        if (snapped) {
            setSnapPoint(pArray)
            setSnapType(snapResult.snapType as 'vertex' | 'edge')
            setTimeout(() => {
                setSnapPoint(null)
                setSnapType(null)
            }, 300)
        }

        if (activeTool === 'measure') {
            if (!tempPoint) {
                // First point
                console.log('[CadViewer] Setting first measurement point')
                setTempPoint(pArray)
            } else {
                // Second point - complete measurement
                const start = new THREE.Vector3(...tempPoint)
                const end = new THREE.Vector3(...pArray)
                const dist = start.distanceTo(end)

                const newMeasure: Measurement = {
                    id: 'm-' + Date.now(),
                    start: tempPoint,
                    end: pArray,
                    distance: dist
                }
                console.log('[CadViewer] Creating measurement:', newMeasure)

                // Add to measurements and history
                setMeasurements(prev => {
                    const updated = [...prev, newMeasure]
                    setMeasurementHistory(h => [...h.slice(0, historyIndex + 1), updated])
                    setHistoryIndex(i => i + 1)
                    return updated
                })
                setTempPoint(null)
            }
        } else if (activeTool === 'comment' || activeTool === 'cloud') {
            // Start annotation
            console.log('[CadViewer] Starting annotation')
            setNewAnnotationPos({
                pos: pArray,
                normal: normal.toArray() as [number, number, number]
            })
            setIsAnnotating(true)
            setTempText('')
        }
    }

    const saveAnnotation = () => {
        if (!newAnnotationPos || !tempText.trim()) return

        console.log('[CadViewer] Saving annotation:', { pos: newAnnotationPos, text: tempText })
        onAnnotate?.({
            position: newAnnotationPos.pos,
            normal: newAnnotationPos.normal
        }, tempText)

        // Reset
        setIsAnnotating(false)
        setNewAnnotationPos(null)
        setTempText('')
    }

    // Undo/Redo handlers
    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1
            setHistoryIndex(newIndex)
            setMeasurements(measurementHistory[newIndex] || [])
            console.log('[CadViewer] Undo to index:', newIndex)
        }
    }

    const handleRedo = () => {
        if (historyIndex < measurementHistory.length - 1) {
            const newIndex = historyIndex + 1
            setHistoryIndex(newIndex)
            setMeasurements(measurementHistory[newIndex] || [])
            console.log('[CadViewer] Redo to index:', newIndex)
        }
    }

    // Cancel annotation on Escape key, add undo/redo shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isAnnotating) {
                    setIsAnnotating(false)
                    setNewAnnotationPos(null)
                    setTempText('')
                }
                if (tempPoint) {
                    setTempPoint(null)
                }
            }

            // Undo/Redo shortcuts
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault()
                handleUndo()
            }
            if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault()
                handleRedo()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isAnnotating, tempPoint, historyIndex, measurementHistory])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        exportCamera: () => {
            const target = controlsRef.current?.target || new THREE.Vector3()
            return {
                position: camera.position.toArray(),
                target: target.toArray(),
                fov: (camera as THREE.PerspectiveCamera).fov
            }
        },
        takeSnapshot: () => {
            gl.render(scene, camera)
            return gl.domElement.toDataURL('image/png')
        }
    }))

    return (
        <>
            {/* Professional Lighting & Environment */}
            <ambientLight intensity={1} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
            <hemisphereLight intensity={0.5} groundColor="#000000" />

            <Suspense fallback={<LoadingProgress progress={loadProgress} />}>
                <Bounds fit clip observe margin={1.2}>
                    <Center top>
                        <Bvh firstHitOnly>
                            <group onPointerDown={handlePointerDown}>
                                <Model
                                    url={modelUrl}
                                    name={modelName}
                                    onPointerDown={handlePointerDown}
                                    onLoadProgress={setLoadProgress}
                                    onLoadComplete={() => setIsModelLoaded(true)}
                                />
                            </group>
                        </Bvh>
                    </Center>
                </Bounds>
                <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
            </Suspense>

            <Grid
                infiniteGrid
                fadeDistance={50}
                fadeStrength={4}
                cellThickness={0.5}
                sectionThickness={1}
                cellColor="#475569"
                sectionColor="#94a3b8"
                position={[0, -0.01, 0]}
            />

            {snapPoint && <SnapIndicator position={snapPoint} snapType={snapType} />}

            {/* Undo/Redo Floating Buttons */}
            <Html position={[0, 0, 0]} style={{ position: 'fixed', top: '100px', left: '20px', pointerEvents: 'auto' }}>
                <div className="flex gap-2">
                    <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white p-2 rounded-lg shadow-xl border border-slate-600 transition-all"
                        title="Undo (Ctrl+Z)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex >= measurementHistory.length - 1}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white p-2 rounded-lg shadow-xl border border-slate-600 transition-all"
                        title="Redo (Ctrl+Y)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                        </svg>
                    </button>
                </div>
            </Html>

            {/* Compact Annotations - Click to expand */}
            {annotations.map((ann, idx) => {
                const isResolved = ann.status === 'resolved'
                const isCloud = ann.type === 'cloud'
                const isSelected = selectedAnnotationId === ann.id

                // Color Logic: Resolved = Green, Cloud = Red, Note = Indigo
                const bgColor = isResolved
                    ? 'bg-emerald-500 border-emerald-300'
                    : isCloud
                        ? 'bg-rose-500 border-rose-300'
                        : 'bg-indigo-500 border-indigo-300'

                return (
                    <Html key={ann.id} position={ann.position} style={{ pointerEvents: 'auto' }}>
                        <div className="relative">
                            {/* Compact Pin - Always Visible */}
                            <div
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-xl cursor-pointer transition-all duration-200 border-2 text-white
                                    ${bgColor}
                                    ${isSelected ? 'scale-110 ring-4 ring-white/50' : 'hover:scale-110'}
                                `}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedAnnotationId(isSelected ? null : ann.id)
                                    onAnnotationSelect?.(ann)
                                }}
                            >
                                {isResolved ? '✓' : idx + 1}
                            </div>

                            {/* Expanded Card - Show on Click */}
                            {isSelected && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 z-50">
                                    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-4 shadow-2xl">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className={`text-[10px] uppercase font-bold tracking-wider ${isResolved ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {isResolved ? '✓ Resolved' : isCloud ? '☁ Cloud' : '💬 Comment'}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedAnnotationId(null)
                                                }}
                                                className="text-slate-500 hover:text-white transition"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <p className="text-sm text-slate-200 mb-3 break-words leading-relaxed">{ann.text}</p>

                                        {!isResolved && onAnnotationUpdate && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onAnnotationUpdate(ann.id, { status: 'resolved' })
                                                    setSelectedAnnotationId(null)
                                                }}
                                                className="w-full text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md transition-colors font-medium flex items-center justify-center gap-2"
                                            >
                                                <span>✓</span> Mark as Resolved
                                            </button>
                                        )}
                                    </div>
                                    {/* Arrow */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-slate-900/95" />
                                </div>
                            )}

                            {/* Pin stick */}
                            <div className="w-0.5 h-6 bg-white/30 absolute bottom-full left-1/2 -translate-x-1/2 -z-10" />
                        </div>
                    </Html>
                )
            })}

            {/* Annotation Input */}
            {
                isAnnotating && newAnnotationPos && (
                    <Html position={newAnnotationPos.pos} style={{ pointerEvents: 'auto' }}>
                        <div className="bg-slate-900 p-4 rounded-lg shadow-2xl border border-slate-700 w-64 transform -translate-x-1/2 -translate-y-[120%] z-50">
                            <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Add Comment</div>
                            <textarea
                                autoFocus
                                value={tempText}
                                onChange={(e) => setTempText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                        saveAnnotation()
                                    }
                                }}
                                className="w-full bg-slate-800 text-white p-2 rounded border border-slate-600 focus:border-indigo-500 outline-none text-sm min-h-[80px] mb-3"
                                placeholder="Type observation... (Ctrl+Enter to save)"
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        setIsAnnotating(false)
                                        setNewAnnotationPos(null)
                                    }}
                                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveAnnotation}
                                    disabled={!tempText.trim()}
                                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition"
                                >
                                    Save
                                </button>
                            </div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-4 h-4 bg-slate-900 border-r border-b border-slate-700"></div>
                        </div>
                        <div className="w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2"></div>
                    </Html>
                )
            }

            {/* Measurements */}
            {
                tempPoint && (
                    <group>
                        <mesh position={tempPoint}>
                            <sphereGeometry args={[0.05, 16, 16]} />
                            <meshBasicMaterial color="yellow" />
                        </mesh>
                        <Html position={tempPoint}>
                            <div className="bg-yellow-400 text-black text-xs px-2 py-1 rounded shadow-lg font-medium -translate-x-1/2 -translate-y-full mb-2 whitespace-nowrap">
                                Select second point
                            </div>
                        </Html>
                    </group>
                )
            }

            {
                measurements.map(m => (
                    <group key={m.id}>
                        <Line points={[m.start, m.end]} color="yellow" lineWidth={3} />
                        <Html
                            position={[
                                (m.start[0] + m.end[0]) / 2,
                                (m.start[1] + m.end[1]) / 2,
                                (m.start[2] + m.end[2]) / 2
                            ]}
                        >
                            <div className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                {m.distance.toFixed(3)} m
                            </div>
                        </Html>
                        <mesh position={m.start}><sphereGeometry args={[0.04]} /><meshBasicMaterial color="yellow" /></mesh>
                        <mesh position={m.end}><sphereGeometry args={[0.04]} /><meshBasicMaterial color="yellow" /></mesh>
                    </group>
                ))
            }

            <OrbitControls
                ref={controlsRef}
                makeDefault
                enabled={!isAnnotating}
                enableDamping
                dampingFactor={0.05}
                rotateSpeed={0.8}
                zoomSpeed={1.2}
                panSpeed={0.8}
                minDistance={0.5}
                maxDistance={100}
                maxPolarAngle={Math.PI}
            />

            <Environment preset="city" />
        </>
    )
})
ViewerScene.displayName = 'ViewerScene'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CadViewerComponent = forwardRef<CadViewerRef, CadViewerProps>((props, ref) => {
    return (
        <div className="w-full h-full relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group select-none">
            <Canvas
                shadows
                gl={{
                    preserveDrawingBuffer: true,
                    antialias: true,
                    alpha: false,
                    powerPreference: 'high-performance'
                }}
                camera={{
                    position: [4, 4, 4],
                    fov: 50,
                    near: 0.1,
                    far: 1000
                }}
                dpr={[1, 2]}
                performance={{ min: 0.5 }}
            >
                <ViewerScene {...props} ref={ref} />
            </Canvas>
        </div>
    )
})
CadViewerComponent.displayName = 'CadViewerComponent'

export default CadViewerComponent
