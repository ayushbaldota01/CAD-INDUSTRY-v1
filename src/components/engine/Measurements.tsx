'use client'

/**
 * Measurement Components
 * 
 * Tools for measuring distances in 3D space.
 * Clean, simple implementation with no complex loops.
 */

import React, { memo } from 'react'
import { Html, Line } from '@react-three/drei'
import type { Measurement } from './types'

type MeasurementLineProps = {
    measurement: Measurement
}

/**
 * Single measurement line with distance label
 */
export const MeasurementLine = memo(function MeasurementLine({
    measurement
}: MeasurementLineProps) {
    const { start, end, distance } = measurement

    // Calculate midpoint for label
    const midpoint: [number, number, number] = [
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
        (start[2] + end[2]) / 2,
    ]

    // Format distance with appropriate units
    const formattedDistance = measurement.label || (distance < 0.01
        ? `${(distance * 1000).toFixed(1)} mm`
        : distance < 1
            ? `${(distance * 100).toFixed(2)} cm`
            : `${distance.toFixed(3)} m`)

    return (
        <group name={`measurement-${measurement.id}`}>
            {/* Main line */}
            <Line
                points={[start, end]}
                color="#facc15"
                lineWidth={2}
            />

            {/* Start point marker */}
            <mesh position={start}>
                <sphereGeometry args={[0.035, 12, 12]} />
                <meshBasicMaterial color="#facc15" />
            </mesh>

            {/* End point marker */}
            <mesh position={end}>
                <sphereGeometry args={[0.035, 12, 12]} />
                <meshBasicMaterial color="#facc15" />
            </mesh>

            {/* Distance label */}
            <Html position={midpoint} center>
                <div className="bg-yellow-400 text-black text-xs font-bold px-2.5 py-1 rounded shadow-lg whitespace-nowrap select-none">
                    {formattedDistance}
                </div>
            </Html>
        </group>
    )
})

type MeasurementsLayerProps = {
    measurements: Measurement[]
}

/**
 * Layer containing all measurement lines
 */
export const MeasurementsLayer = memo(function MeasurementsLayer({
    measurements
}: MeasurementsLayerProps) {
    return (
        <group name="measurements-layer">
            {measurements.map(m => (
                <MeasurementLine key={m.id} measurement={m} />
            ))}
        </group>
    )
})

type TempPointProps = {
    position: [number, number, number]
}

/**
 * Temporary point indicator during measurement
 */
export const TempMeasurementPoint = memo(function TempMeasurementPoint({
    position
}: TempPointProps) {
    return (
        <group name="temp-measurement-point">
            {/* Pulsing indicator */}
            <mesh position={position}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshBasicMaterial color="#facc15" />
            </mesh>

            {/* Label */}
            <Html position={position} center>
                <div className="bg-yellow-400 text-black text-xs px-2 py-1 rounded shadow-lg font-medium -translate-y-8 whitespace-nowrap animate-pulse">
                    Click second point
                </div>
            </Html>
        </group>
    )
})

type SnapIndicatorProps = {
    position: [number, number, number]
    type: 'vertex' | 'edge' | 'face' | 'center' | 'quadrant' | null
}

/**
 * Visual indicator for snap points
 */
export const SnapIndicator = memo(function SnapIndicator({
    position,
    type
}: SnapIndicatorProps) {
    const labelMap: Record<string, string> = {
        vertex: '● VERTEX',
        edge: '━ EDGE',
        face: '▢ FACE',
        center: '✚ CENTER',
        quadrant: '◆ QUADRANT'
    }

    const colorMap: Record<string, string> = {
        vertex: '#22c55e',   // Green
        edge: '#22c55e',     // Green
        face: '#22c55e',     // Green
        center: '#3b82f6',   // Blue
        quadrant: '#f97316'  // Orange
    }

    const color = type ? colorMap[type] || '#22c55e' : '#22c55e'

    return (
        <group name="snap-indicator">
            {/* Glowing sphere */}
            <mesh position={position}>
                <sphereGeometry args={[type === 'center' || type === 'quadrant' ? 0.05 : 0.04, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.9}
                    depthTest={false} // Always show on top for virtual points
                    depthWrite={false}
                />
            </mesh>

            {/* Ring helper for quadrant/center to make them stand out */}
            {(type === 'center' || type === 'quadrant') && (
                <mesh position={position}>
                    <ringGeometry args={[0.07, 0.09, 32]} />
                    <meshBasicMaterial color={color} transparent opacity={0.6} side={2} />
                </mesh>
            )}

            {/* Type label */}
            {type && (
                <Html position={position} center>
                    <div
                        className="text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase tracking-wider -translate-y-8 whitespace-nowrap"
                        style={{ backgroundColor: color, color: '#fff' }}
                    >
                        {labelMap[type]}
                    </div>
                </Html>
            )}
        </group>
    )
})

export default MeasurementsLayer
