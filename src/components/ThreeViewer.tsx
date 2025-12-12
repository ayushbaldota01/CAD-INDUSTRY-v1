'use client'

import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'

function Model({ url }: { url: string }) {
    // logic to load glb. For now, using a placeholder box if url isn't real
    // const { scene } = useGLTF(url) 
    // return <primitive object={scene} />

    return (
        <mesh>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#6366f1" />
        </mesh>
    )
}

export default function ThreeViewer({ url }: { url: string }) {
    return (
        <div className="w-full h-full bg-slate-950">
            <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                <pointLight position={[-10, -10, -10]} />
                <Suspense fallback={null}>
                    <Model url={url} />
                    <Environment preset="city" />
                </Suspense>
                <OrbitControls makeDefault />
                <gridHelper args={[20, 20, 0x444444, 0x222222]} />
            </Canvas>
            <div className="absolute bottom-4 left-4 text-white/50 text-xs pointer-events-none">
                Use Left Click to Rotate, Right Click to Pan, Scroll to Zoom
            </div>
        </div>
    )
}
