'use client'

/**
 * Scene Setup Components
 * 
 * Lighting, environment, and grid components.
 * Separated for easy customization and performance optimization.
 */

import React, { memo } from 'react'
import { Grid, Environment } from '@react-three/drei'

/**
 * Professional lighting setup for CAD models
 * Optimized for mechanical/industrial parts visualization
 */
export const Lighting = memo(function Lighting() {
    return (
        <>
            {/* Ambient fill light */}
            <ambientLight intensity={0.8} />

            {/* Key light - main directional light */}
            <directionalLight
                position={[10, 10, 5]}
                intensity={1.2}
                color="#ffffff"
            />

            {/* Fill light - softer opposite side */}
            <directionalLight
                position={[-5, 5, -5]}
                intensity={0.4}
                color="#b4c7e7"
            />

            {/* Rim light - edge definition */}
            <directionalLight
                position={[0, -5, 10]}
                intensity={0.3}
                color="#ffffff"
            />

            {/* Hemisphere light for natural ambient */}
            <hemisphereLight
                intensity={0.4}
                color="#ffffff"
                groundColor="#1e293b"
            />
        </>
    )
})

/**
 * Ground grid for spatial reference
 */
export const GroundGrid = memo(function GroundGrid() {
    return (
        <Grid
            infiniteGrid
            fadeDistance={40}
            fadeStrength={5}
            cellThickness={0.5}
            sectionThickness={1}
            cellSize={1}
            sectionSize={5}
            cellColor="#334155"
            sectionColor="#64748b"
            position={[0, -0.01, 0]}
        />
    )
})

/**
 * HDR Environment for realistic lighting
 * Only load if needed for reflective materials
 */
export const SceneEnvironment = memo(function SceneEnvironment({
    enabled = false
}: {
    enabled?: boolean
}) {
    if (!enabled) return null

    return <Environment preset="city" background={false} />
})

/**
 * Combined scene setup
 */
export const SceneSetup = memo(function SceneSetup({
    showGrid = true,
    useEnvironment = false
}: {
    showGrid?: boolean
    useEnvironment?: boolean
}) {
    return (
        <>
            <Lighting />
            {showGrid && <GroundGrid />}
            <SceneEnvironment enabled={useEnvironment} />
        </>
    )
})

export default SceneSetup
