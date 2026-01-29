'use client'

/**
 * Clipping Planes Component
 * 
 * Simple section cut visualization for CAD models.
 * Allows viewing internal structure without complex loops.
 */

import React, { useEffect, memo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

type ClippingPlanesProps = {
    enabled: boolean
}

export const ClippingPlanes = memo(function ClippingPlanes({
    enabled
}: ClippingPlanesProps) {
    const { gl } = useThree()

    useEffect(() => {
        if (!enabled) {
            // Disable clipping
            gl.clippingPlanes = []
            gl.localClippingEnabled = false
            return
        }

        // Create a simple clipping plane at Y = 0 (horizontal cut)
        const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

        gl.clippingPlanes = [clippingPlane]
        gl.localClippingEnabled = true

        return () => {
            gl.clippingPlanes = []
            gl.localClippingEnabled = false
        }
    }, [enabled, gl])

    if (!enabled) return null

    // Visual helper to show where the clipping plane is
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[10, 10]} />
            <meshBasicMaterial
                color="#3b82f6"
                transparent
                opacity={0.15}
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </mesh>
    )
})

export default ClippingPlanes
