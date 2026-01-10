/**
 * 3D Interaction Utilities - Production Optimized
 * 
 * Pure functions for snapping, raycasting, and point finding.
 * OPTIMIZED: Reuses vector instances, early exits, and efficient algorithms.
 */

import * as THREE from 'three'
import type { SnapResult } from './types'
import { ENGINE_CONFIG } from '@/lib/config'
import { detectCircularFeature, generateQuadrantPoints } from './geometryUtils'

// ============================================================================
// REUSABLE VECTOR POOL (Prevents GC pressure)
// ============================================================================

// Pre-allocated vectors to avoid creating new instances in hot paths
const _tempVertex = new THREE.Vector3()
const _tempWorldVertex = new THREE.Vector3()
const _tempNormal = new THREE.Vector3()

// Additional vectors for edge snapping
const _edgeStart = new THREE.Vector3()
const _edgeEnd = new THREE.Vector3()
const _edgeDir = new THREE.Vector3()
const _pointToStart = new THREE.Vector3()
const _closestOnEdge = new THREE.Vector3()

/**
 * Find the nearest vertex to a hit point
 * 
 * OPTIMIZATION NOTES:
 * - Uses pre-allocated vectors instead of creating new ones per iteration
 * - Uses distanceToSquared to avoid sqrt (√) calculations
 * - Early exit when exact match found
 * - Limits vertex count for dense meshes
 */
export function findNearestVertex(
    hitPoint: THREE.Vector3,
    object: THREE.Object3D,
    tolerance: number = ENGINE_CONFIG.snapTolerance
): THREE.Vector3 | null {
    // Early exit: Only process mesh objects
    if (!(object instanceof THREE.Mesh) || !object.geometry) {
        return null
    }

    const geometry = object.geometry
    const positionAttr = geometry.getAttribute('position')

    if (!positionAttr) return null

    const toleranceSq = tolerance * tolerance
    let nearestVertex: THREE.Vector3 | null = null
    let minDistanceSq = toleranceSq

    // Limit vertex count for performance on high-poly models
    const count = Math.min(positionAttr.count, ENGINE_CONFIG.maxVerticesForSnap)

    // Pre-compute matrix for world transform
    const matrixWorld = object.matrixWorld

    for (let i = 0; i < count; i++) {
        // Reuse pre-allocated vectors
        _tempVertex.fromBufferAttribute(positionAttr, i)
        _tempWorldVertex.copy(_tempVertex).applyMatrix4(matrixWorld)

        const distSq = hitPoint.distanceToSquared(_tempWorldVertex)

        // Early exit on exact match (within floating point tolerance)
        if (distSq < 0.0001) {
            return _tempWorldVertex.clone()
        }

        if (distSq < minDistanceSq) {
            minDistanceSq = distSq
            // Only clone when we find a better match
            nearestVertex = _tempWorldVertex.clone()
        }
    }

    return nearestVertex
}

/**
 * Find the nearest point on an edge to a hit point
 * 
 * Iterates through all edges of the mesh and finds the closest point
 * on any edge within tolerance.
 */
export function findNearestEdgePoint(
    hitPoint: THREE.Vector3,
    object: THREE.Object3D,
    tolerance: number = ENGINE_CONFIG.snapTolerance * 2 // Slightly larger tolerance for edges
): THREE.Vector3 | null {
    // Early exit: Only process mesh objects
    if (!(object instanceof THREE.Mesh) || !object.geometry) {
        return null
    }

    const geometry = object.geometry
    const positionAttr = geometry.getAttribute('position')
    const index = geometry.getIndex()

    if (!positionAttr) return null

    const toleranceSq = tolerance * tolerance
    let nearestPoint: THREE.Vector3 | null = null
    let minDistanceSq = toleranceSq

    const matrixWorld = object.matrixWorld

    // Helper to get world position of vertex
    const getWorldVertex = (vertexIndex: number): THREE.Vector3 => {
        _tempVertex.fromBufferAttribute(positionAttr, vertexIndex)
        return _tempVertex.clone().applyMatrix4(matrixWorld)
    }

    // Helper to find closest point on a line segment
    const closestPointOnSegment = (
        p: THREE.Vector3,
        a: THREE.Vector3,
        b: THREE.Vector3
    ): THREE.Vector3 => {
        _edgeDir.subVectors(b, a)
        const len = _edgeDir.length()
        if (len < 0.0001) return a.clone()

        _edgeDir.normalize()
        _pointToStart.subVectors(p, a)

        let t = _pointToStart.dot(_edgeDir)
        t = Math.max(0, Math.min(len, t)) // Clamp to segment

        _closestOnEdge.copy(a).addScaledVector(_edgeDir, t)
        return _closestOnEdge.clone()
    }

    // Process edges from indexed geometry
    if (index) {
        const indices = index.array
        const faceCount = Math.min(indices.length / 3, 2000) // Limit for performance

        for (let i = 0; i < faceCount; i++) {
            const i0 = indices[i * 3]
            const i1 = indices[i * 3 + 1]
            const i2 = indices[i * 3 + 2]

            // Check all 3 edges of the triangle
            const edges = [[i0, i1], [i1, i2], [i2, i0]]

            for (const [a, b] of edges) {
                const va = getWorldVertex(a)
                const vb = getWorldVertex(b)

                const closest = closestPointOnSegment(hitPoint, va, vb)
                const distSq = hitPoint.distanceToSquared(closest)

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq
                    nearestPoint = closest
                }
            }
        }
    } else {
        // Non-indexed geometry - process as triangles
        const vertexCount = Math.min(positionAttr.count, 6000) // Limit for performance

        for (let i = 0; i < vertexCount; i += 3) {
            const edges = [[i, i + 1], [i + 1, i + 2], [i + 2, i]]

            for (const [a, b] of edges) {
                if (b >= vertexCount) continue

                const va = getWorldVertex(a)
                const vb = getWorldVertex(b)

                const closest = closestPointOnSegment(hitPoint, va, vb)
                const distSq = hitPoint.distanceToSquared(closest)

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq
                    nearestPoint = closest
                }
            }
        }
    }

    return nearestPoint
}

/**
 * Process a Three.js intersection event into a snap result
 * 
 * Snap priority: vertex > edge > face
 * OPTIMIZATION: Reuses normal vector, avoids unnecessary cloning
 */
export function processIntersection(
    intersection: THREE.Intersection
): SnapResult {
    const point = intersection.point
    const face = intersection.face
    const object = intersection.object

    // Calculate world-space normal
    _tempNormal.set(0, 1, 0) // Default up vector

    if (face && object instanceof THREE.Mesh) {
        _tempNormal.copy(face.normal)
        _tempNormal.transformDirection(object.matrixWorld)
    }

    // Priority 0: Virtual Snap Points (Center & Quadrants)
    // We check this first or competitive with vertex.
    // Detect circle feature on the fly (Note: this involves some geometry scanning)
    // Optimization: In a full app, this should be cached based on the hit face ID.
    const circleFeature = detectCircularFeature(intersection, ENGINE_CONFIG.snapTolerance * 5)

    let bestVirtualSnap: SnapResult | null = null
    let minVirtualDistSq = Infinity

    if (circleFeature) {
        const virtualPoints = generateQuadrantPoints(circleFeature)

        for (const vp of virtualPoints) {
            const distSq = point.distanceToSquared(vp.point)
            if (distSq < minVirtualDistSq) {
                minVirtualDistSq = distSq
                bestVirtualSnap = {
                    point: vp.point.toArray(),
                    normal: vp.normal.toArray(),
                    type: vp.type as any,
                    snapped: true
                }
            }
        }
    }

    // Priority 1: Try to snap to nearest vertex
    const nearestVertex = findNearestVertex(point, object)

    // Compare Virtual vs Vertex
    // If virtual snap is valid and close, prioritize it to enable Diameter dimensioning
    if (bestVirtualSnap && minVirtualDistSq < (ENGINE_CONFIG.snapTolerance * ENGINE_CONFIG.snapTolerance)) {
        // If we also have a vertex match, check which is closer
        if (nearestVertex) {
            const vertexDistSq = point.distanceToSquared(nearestVertex)
            // Bias towards virtual quadrant slightly to enable the feature
            if (minVirtualDistSq <= vertexDistSq * 1.5) {
                return bestVirtualSnap
            }
        } else {
            return bestVirtualSnap
        }
    }

    if (nearestVertex) {
        return {
            point: nearestVertex.toArray() as [number, number, number],
            normal: _tempNormal.toArray() as [number, number, number],
            type: 'vertex',
            snapped: true,
        }
    }

    // Priority 2: Try to snap to nearest edge
    const nearestEdgePoint = findNearestEdgePoint(point, object)

    if (nearestEdgePoint) {
        return {
            point: nearestEdgePoint.toArray() as [number, number, number],
            normal: _tempNormal.toArray() as [number, number, number],
            type: 'edge',
            snapped: true,
        }
    }

    // Fallback: If we detected a circle but weren't close enough to snap to a specific point,
    // we might still want to provide center usage? 
    // For now, if no hard snap, just return face.

    // Priority 3: Return face hit point without snap
    return {
        point: point.toArray() as [number, number, number],
        normal: _tempNormal.toArray() as [number, number, number],
        type: 'face',
        snapped: false,
    }
}

/**
 * Calculate distance between two 3D points
 * 
 * OPTIMIZATION: Inline calculation, no object creation
 */
export function calculateDistance(
    p1: [number, number, number],
    p2: [number, number, number]
): number {
    const dx = p2[0] - p1[0]
    const dy = p2[1] - p1[1]
    const dz = p2[2] - p1[2]
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Get the center point between two 3D points
 * 
 * Returns a tuple directly, no intermediate object creation
 */
export function getMidpoint(
    p1: [number, number, number],
    p2: [number, number, number]
): [number, number, number] {
    return [
        (p1[0] + p2[0]) * 0.5,  // Multiply by 0.5 is faster than divide by 2
        (p1[1] + p2[1]) * 0.5,
        (p1[2] + p2[2]) * 0.5,
    ]
}

/**
 * Create a unique ID for measurements/annotations
 * 
 * Uses crypto.randomUUID when available for better uniqueness
 */
export function createId(prefix: string = 'id'): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `${prefix}-${crypto.randomUUID()}`
    }
    // Fallback for older browsers
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Dispose of geometry and materials to prevent GPU memory leaks
 * 
 * CRITICAL: Call this when unloading models
 */
export function disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            // Dispose geometry
            if (child.geometry) {
                child.geometry.dispose()
            }

            // Dispose materials
            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material]

            materials.forEach((material) => {
                if (material) {
                    // Dispose textures
                    Object.keys(material).forEach((key) => {
                        const value = (material as any)[key]
                        if (value instanceof THREE.Texture) {
                            value.dispose()
                        }
                    })
                    material.dispose()
                }
            })
        }
    })
}

/**
 * Debounce function for expensive operations
 * 
 * Useful for resize handlers, search inputs, etc.
 */
export function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(() => {
            func(...args)
            timeoutId = null
        }, wait)
    }
}

/**
 * Throttle function for rate-limiting frequent calls
 * 
 * Useful for scroll handlers, mousemove, etc.
 */
export function throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args)
            inThrottle = true
            setTimeout(() => {
                inThrottle = false
            }, limit)
        }
    }
}
