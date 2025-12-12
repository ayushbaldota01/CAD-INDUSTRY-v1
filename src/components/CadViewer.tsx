
'use client'

import React, { useRef, useState, useImperativeHandle, forwardRef, Suspense, useEffect } from 'react'
import { Canvas, useThree, useLoader, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, useGLTF, Environment, Center, Line } from '@react-three/drei'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import type { ToolType } from './ViewerToolbar'

export type Annotation = {
    id: string
    position: [number, number, number]
    normal: [number, number, number]
    text: string
    type?: 'note' | 'cloud'
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
    onAnnotate?: (data: { position: [number, number, number]; normal: [number, number, number] }, tool: ToolType) => void
    onAnnotationSelect?: (annotation: Annotation) => void
}

export type CadViewerRef = {
    exportCamera: () => { position: number[]; target: number[]; fov: number }
    takeSnapshot: () => string
}

// Simple Error Boundary
class ModelErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props)
        this.state = { hasError: false }
    }
    static getDerivedStateFromError() {
        return { hasError: true }
    }
    componentDidCatch(error: any) {
        console.error('Model loading error:', error)
    }
    render() {
        if (this.state.hasError) {
            return <mesh><boxGeometry /><meshStandardMaterial color="purple" /></mesh> // Fallback placeholder
        }
        return this.props.children
    }
}

// Inner model loader component
function InnerModel({ url, fileExt, onPointerDown }: { url: string; fileExt?: string; onPointerDown?: (e: ThreeEvent<MouseEvent>) => void }) {
    // 1. Handle GLTF/GLB (Scene Graph)
    if (fileExt === 'gltf' || fileExt === 'glb') {
        // DRACO COMPRESSION SUPPORT: Point to a reliable CDN for the decoder
        useGLTF.preload(url, 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
        const gltf = useGLTF(url, 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
        return <primitive object={gltf.scene} onPointerDown={onPointerDown} />
    }

    // 2. Handle STL (Geometry)
    if (fileExt === 'stl') {
        const geometry = useLoader(STLLoader, url)
        return (
            <mesh geometry={geometry} onPointerDown={onPointerDown}>
                <meshStandardMaterial color="#a0a0a0" />
            </mesh>
        )
    }

    // 3. Handle OBJ (Object/Group)
    if (fileExt === 'obj') {
        const obj = useLoader(OBJLoader, url)
        return <primitive object={obj} onPointerDown={onPointerDown} />
    }

    // 4. Handle Unsupported/Parametric Formats
    if (['step', 'stp', 'sldprt', 'sldasm', 'asm', 'prt'].includes(fileExt || '')) {
        return (
            <Html center>
                <div className="bg-slate-900/90 text-white p-6 rounded-xl border border-slate-700 text-center max-w-sm backdrop-blur-md select-none">
                    <div className="text-4xl mb-3">🛠️</div>
                    <h3 className="font-bold text-lg text-amber-500 mb-2">Format Requires Conversion</h3>
                    <p className="text-sm text-slate-300 mb-4">
                        <span className="font-mono bg-slate-800 px-1 rounded">{fileExt?.toUpperCase()}</span> files are parametric B-Rep models.
                        Browsers only natively render Mesh formats (GLB, OBJ).
                    </p>
                    <p className="text-xs text-slate-500 italic">
                        In a production environment, this file would be auto-converted. For this demo, please use <strong>.GLB</strong> or.<strong>.STL</strong>.
                    </p>
                </div>
            </Html>
        )
    }

    // 5. Default Fallback
    return (
        <mesh onPointerDown={onPointerDown}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="red" wireframe />
        </mesh>
    )
}

function Model({ url, name, onPointerDown }: { url: string; name?: string; onPointerDown?: (e: ThreeEvent<MouseEvent>) => void }) {
    // Priority: Extension from Name (for Blobs) -> Extension from URL -> Default
    const extFromName = name?.split('.').pop()?.toLowerCase()
    const extFromUrl = url.split('.').pop()?.toLowerCase()

    // If extFromUrl is very long (likely a blob string or parameters), ignore it if we have a name
    const fileExt = (extFromName && extFromName.length < 5) ? extFromName : extFromUrl
    // Default Fallback
    return (
        <ModelErrorBoundary>
            <InnerModel url={url} fileExt={fileExt} onPointerDown={onPointerDown} />
        </ModelErrorBoundary>
    )
}

const ViewerScene = forwardRef<CadViewerRef, CadViewerProps>(({ modelUrl, modelName, annotations, activeTool, onAnnotate, onAnnotationSelect }, ref) => {
    const { camera, gl, scene } = useThree()
    const controlsRef = useRef<any>(null)
    const [measurements, setMeasurements] = useState<Measurement[]>([])
    const [tempPoint, setTempPoint] = useState<[number, number, number] | null>(null)

    // Cursor management based on tool
    useEffect(() => {
        const canvas = gl.domElement
        if (activeTool === 'measure') canvas.style.cursor = 'crosshair'
        else if (activeTool === 'comment' || activeTool === 'cloud') canvas.style.cursor = 'copy'
        else canvas.style.cursor = 'default'
    }, [activeTool, gl.domElement])

    const handlePointerDown = (e: ThreeEvent<MouseEvent>) => {
        // Prevent interaction if selecting tool
        if (activeTool === 'select') return

        e.stopPropagation()
        const { point, face } = e
        const normal = face?.normal || new THREE.Vector3(0, 1, 0)
        const pArray = point.toArray() as [number, number, number]

        if (activeTool === 'measure') {
            if (!tempPoint) {
                // Start measurement
                setTempPoint(pArray)
            } else {
                // End measurement
                const start = new THREE.Vector3(...tempPoint)
                const end = new THREE.Vector3(...pArray)
                const dist = start.distanceTo(end)

                const newMeasure: Measurement = {
                    id: 'm-' + Date.now(),
                    start: tempPoint,
                    end: pArray,
                    distance: dist
                }
                setMeasurements(prev => [...prev, newMeasure])
                setTempPoint(null)
            }
        } else {
            // Annotations
            onAnnotate?.({
                position: pArray,
                normal: normal.toArray() as [number, number, number]
            }, activeTool)
        }
    }

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
            <ambientLight intensity={1.5} />
            <directionalLight position={[10, 10, 5]} intensity={2} castShadow />
            <hemisphereLight intensity={1} groundColor="black" />

            <Center top>
                <Suspense fallback={<Html center><div className="text-white">Loading Model...</div></Html>}>
                    <Model url={modelUrl} name={modelName} onPointerDown={handlePointerDown} />
                </Suspense>
            </Center>

            {/* Annotations */}
            {annotations.map((ann) => (
                <Html key={ann.id} position={ann.position}>
                    <div
                        className={`
                            px-2 py-1 rounded select-none cursor-pointer hover:scale-110 transition mt-[-5px] transform -translate-x-1/2 -translate-y-full border backdrop-blur-sm
                            ${ann.type === 'cloud'
                                ? 'bg-red-500/20 border-red-500 text-red-100 rounded-[50%]'
                                : 'bg-slate-900/80 border-slate-700 text-white rounded'}
                        `}
                        onClick={(e) => {
                            e.preventDefault()
                            onAnnotationSelect?.(ann)
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {ann.type === 'cloud' ? '☁️' : ''} {ann.text}
                    </div>
                    {ann.type !== 'cloud' && (
                        <div className="w-2 h-2 bg-indigo-500 rounded-full border border-white transform -translate-x-1/2 -translate-y-1/2" />
                    )}
                </Html>
            ))}

            {/* Temporary Measurement Point */}
            {tempPoint && (
                <mesh position={tempPoint}>
                    <sphereGeometry args={[0.05]} />
                    <meshBasicMaterial color="yellow" />
                </mesh>
            )}

            {/* Finished Measurements */}
            {measurements.map(m => (
                <group key={m.id}>
                    <Line points={[m.start, m.end]} color="yellow" lineWidth={2} />
                    <Html position={[
                        (m.start[0] + m.end[0]) / 2,
                        (m.start[1] + m.end[1]) / 2,
                        (m.start[2] + m.end[2]) / 2
                    ]}>
                        <div className="bg-yellow-400 text-black text-[10px] font-bold px-1 rounded shadow-sm">
                            {m.distance.toFixed(2)}m
                        </div>
                    </Html>
                    <mesh position={m.start}><sphereGeometry args={[0.03]} /><meshBasicMaterial color="yellow" /></mesh>
                    <mesh position={m.end}><sphereGeometry args={[0.03]} /><meshBasicMaterial color="yellow" /></mesh>
                </group>
            ))}

            <OrbitControls ref={controlsRef} makeDefault enabled={activeTool !== 'measure'} />
            <Environment preset="city" />
        </>
    )
})
ViewerScene.displayName = 'ViewerScene'

const CadViewerComponent = forwardRef<CadViewerRef, CadViewerProps>((props, ref) => {
    return (
        <div className="w-full h-full relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group">
            <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [4, 4, 4], fov: 50 }}>
                <ViewerScene {...props} ref={ref} />
            </Canvas>
        </div>
    )
})
CadViewerComponent.displayName = 'CadViewerComponent'

export default CadViewerComponent
