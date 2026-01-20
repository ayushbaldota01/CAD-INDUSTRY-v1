
import * as THREE from 'three'
import { ENGINE_CONFIG } from '@/lib/config'

// ============================================================================
// LRU CACHE FOR CIRCLE DETECTION (Performance Optimization)
// ============================================================================

// Cache structure: Map<cacheKey, { result, timestamp }>
const circleCache = new Map<string, { result: CircleFeature | null; timestamp: number }>()
const CACHE_TTL_MS = 5000 // 5 second TTL for cache entries

/**
 * Get from cache with TTL check
 */
function getCachedCircle(key: string): CircleFeature | null | undefined {
    const entry = circleCache.get(key)
    if (!entry) return undefined

    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        circleCache.delete(key)
        return undefined
    }

    return entry.result
}

/**
 * Set cache with LRU eviction
 */
function setCachedCircle(key: string, result: CircleFeature | null): void {
    // LRU eviction if cache is full
    if (circleCache.size >= ENGINE_CONFIG.circleCacheSize) {
        const firstKey = circleCache.keys().next().value
        if (firstKey) circleCache.delete(firstKey)
    }

    circleCache.set(key, { result, timestamp: Date.now() })
}

/**
 * Clear cache (call when model changes)
 */
export function clearCircleCache(): void {
    circleCache.clear()
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CIRCLE_FIT_TOLERANCE = 0.05 // RMS error tolerance
const MIN_CIRCLE_POINTS = 6       // Minimum points to confirm a circle (hexagon+)
const COPLANAR_TOLERANCE = 0.01   // Tolerance for checking if points are on plane

/**
 * Circle parameters result
 */
export type CircleFeature = {
    center: THREE.Vector3
    radius: number
    normal: THREE.Vector3
    axisX: THREE.Vector3 // For 0-degree reference
    axisY: THREE.Vector3 // For 90-degree reference
}

// Reusable vectors
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _center = new THREE.Vector3()
const _normal = new THREE.Vector3()

/**
 * Fits a circle to a set of 3D points
 * 
 * Algorithm:
 * 1. Compute centroid
 * 2. Compute best-fit plane (normal)
 * 3. Project points to 2D plane
 * 4. Least-squares circle fit in 2D
 * 5. Compute error
 */
export function fitCircleToPoints(
    points: THREE.Vector3[],
    knownNormal?: THREE.Vector3
): CircleFeature | null {
    if (points.length < MIN_CIRCLE_POINTS) return null

    // 1. Compute Centroid
    _center.set(0, 0, 0)
    for (const p of points) _center.add(p)
    _center.divideScalar(points.length)

    // 2. Determine Normal
    if (knownNormal) {
        _normal.copy(knownNormal)
    } else {
        // Simple normal estimate using simple covariance or geometric mean
        // For CAD meshes, usually we scan a flat face, so we can pass the face normal
        // If estimating from points, we'd need PCA/SVD. 
        // For now, assume points are roughly planar and we might have a hint
        return null // Require normal for optimization in this context
    }

    // 3. Create Local Basis
    // Arbitrary axisX perpendicular to normal
    const axisX = new THREE.Vector3()
    if (Math.abs(_normal.y) < 0.99) {
        axisX.set(0, 1, 0).cross(_normal).normalize()
    } else {
        axisX.set(1, 0, 0).cross(_normal).normalize()
    }
    const axisY = new THREE.Vector3().crossVectors(_normal, axisX).normalize()

    // 4. Project and Fit (Kása's Method for efficiency, or simple averaging if clean)
    // Since CAD export meshes usually have vertices EXACTLY on the circle, 
    // simple averaging of distances from center might verify it.

    // First pass: Refine center? 
    // For regular polygons (mesh circles), the centroid IS the center.
    // Let's assume centroid is center and check variance of radii.

    let sumR = 0
    let sumSqR = 0
    const radii: number[] = []

    for (const p of points) {
        const d = p.distanceTo(_center)
        sumR += d
        sumSqR += d * d
        radii.push(d)
    }

    const meanRadius = sumR / points.length
    const variance = (sumSqR / points.length) - (meanRadius * meanRadius)
    const stdDev = Math.sqrt(Math.max(0, variance))

    // Check if "circular" enough
    // Standard deviation of radius should be very small for a perfect circle/polygon
    if (stdDev > CIRCLE_FIT_TOLERANCE * meanRadius) {
        return null
    }

    return {
        center: _center.clone(),
        radius: meanRadius,
        normal: _normal.clone(),
        axisX,
        axisY
    }
}

/**
 * Generate 4 quadrant snap points + center
 */
export function generateQuadrantPoints(circle: CircleFeature) {
    const points = []

    // Center
    points.push({
        type: 'center',
        point: circle.center.clone(),
        normal: circle.normal.clone()
    })

    // Quadrants (0, 90, 180, 270)
    const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]

    for (const theta of angles) {
        const p = new THREE.Vector3().copy(circle.center)
        const xComp = _v1.copy(circle.axisX).multiplyScalar(Math.cos(theta) * circle.radius)
        const yComp = _v2.copy(circle.axisY).multiplyScalar(Math.sin(theta) * circle.radius)
        p.add(xComp).add(yComp)

        points.push({
            type: 'quadrant',
            point: p,
            normal: circle.normal.clone() // Normal at rim is same as face normal for planar circle
        })
    }

    return points
}

/**
 * Detects circular geometry from a mesh intersection
 * 
 * Strategy:
 * 1. Get the plane of the hit face
 * 2. Find all vertices in the mesh that are:
 *    a) Close to the hit point (within a reasonable feature radius)
 *    b) Roughly coplanar with the hit face
 * 3. Try to fit a circle to these points
 */
export function detectCircularFeature(
    intersection: THREE.Intersection,
    maxSearchRadius: number = 5.0 // Max radius of circle to detect
): CircleFeature | null {
    const object = intersection.object
    if (!(object instanceof THREE.Mesh) || !object.geometry) return null

    const face = intersection.face
    if (!face) return null

    // ========== CACHE LOOKUP (Performance Optimization) ==========
    const cacheKey = `${intersection.faceIndex ?? 'noface'}-${object.uuid}`
    const cached = getCachedCircle(cacheKey)
    if (cached !== undefined) {
        return cached // Return cached result (may be null)
    }
    // =============================================================

    const geometry = object.geometry
    const positionAttr = geometry.getAttribute('position')

    // 1. Get Plane Definition
    _normal.copy(face.normal).transformDirection(object.matrixWorld).normalize()
    // Point on plane (hit point)
    const planePoint = intersection.point

    // 2. Gather Candidate Vertices
    // We scan vertices. For optimization, we could use bounds, but linear scan 
    // is often fast enough for <100k vertices in JS if simple math.
    const candidates: THREE.Vector3[] = []
    const worldV = new THREE.Vector3()

    // Limit processing for huge models
    const vertexCount = Math.min(positionAttr.count, 10000)
    const tolerance = 0.02 // Plane tolerance

    const matrixWorld = object.matrixWorld

    for (let i = 0; i < vertexCount; i++) {
        worldV.fromBufferAttribute(positionAttr, i).applyMatrix4(matrixWorld)

        // Check distance to point (coarse filter)
        if (worldV.distanceToSquared(planePoint) > maxSearchRadius * maxSearchRadius) continue

        // Check coplanarity: (P - PlanePoint) dot Normal ~= 0
        const distToPlane = Math.abs(worldV.sub(planePoint).dot(_normal))

        if (distToPlane < tolerance) {
            // It's on the plane. Add to candidates.
            // Note: We duplicate vectors here which is costly, but needed for the fit function.
            // Optimization: Only store unique close points? 
            // Mesh vertices often duplicated. We should filter duplicates ideally.
            candidates.push(worldV.clone().add(planePoint)) // Restore worldV (sub operation modified it)
        }
    }

    // Filter duplicates (simple dist check)
    const uniqueCandidates: THREE.Vector3[] = []
    for (const c of candidates) {
        let isDuplicate = false
        for (const u of uniqueCandidates) {
            if (c.distanceToSquared(u) < 0.0001) {
                isDuplicate = true
                break
            }
        }
        if (!isDuplicate) uniqueCandidates.push(c)
    }

    if (uniqueCandidates.length < MIN_CIRCLE_POINTS) {
        // Cache negative result too
        setCachedCircle(cacheKey, null)
        return null
    }

    // 3. Attempt Circle Fit
    // This finds ANY circle in the coplanar set. 
    // Identify subsets? 
    // If the logical feature is a single hole, the points connected to the hit face are what matters.
    // But without adjacency, we simply fit ALL close coplanar points.
    // If there are multiple holes nearby, this might fail (RMS error will be high).

    const result = fitCircleToPoints(uniqueCandidates, _normal)

    // Cache the result for future lookups
    setCachedCircle(cacheKey, result)

    return result
}
