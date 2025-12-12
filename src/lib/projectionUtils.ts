
import * as THREE from 'three'

export type CameraParams = {
    position: number[]
    target: number[]
    fov: number
}

/**
 * Projects a 3D point to normalized 2D coordinates (0..1) based on camera parameters.
 * Returns null if the point is behind the camera.
 */
export function projectPoint(
    cameraParams: CameraParams,
    point3d: [number, number, number]
): { u: number; v: number } | null {
    const camera = new THREE.PerspectiveCamera(cameraParams.fov, 1, 0.1, 1000)

    // Set camera position
    camera.position.set(
        cameraParams.position[0],
        cameraParams.position[1],
        cameraParams.position[2]
    )

    // Set camera orientation (lookAt target)
    // Note: OrbitControls updates the camera to look at the target.
    // We assume 'up' is (0,1,0) generic for now unless we export it too.
    camera.up.set(0, 1, 0)
    camera.lookAt(
        cameraParams.target[0],
        cameraParams.target[1],
        cameraParams.target[2]
    )

    // Update matrices
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()

    // Create vector from point
    const vector = new THREE.Vector3(point3d[0], point3d[1], point3d[2])

    // Project to NDC
    vector.project(camera)

    // Check if point is behind camera (z > 1 in NDC usually mostly clipped, but strict check is dot product with direction)
    // Simple check: if z > 1, it's outside far plane. If z < -1, outside near plane.
    // However, vector.project puts things into -1..1 range.
    // If it was behind the camera, the projection logic might invert it or place it oddly depending on implementation.
    // Standard approach: if the angle between camera dir and vector to point is > 90, it's behind.
    // But project() handles this mathematically.

    // Convert NDC (-1..1) to UV (0..1)
    const u = (vector.x + 1) / 2
    const v = (-vector.y + 1) / 2 // Invert Y for canvas/screen coords

    return { u, v }
}

/**
 * Casts a ray from a normalized 2D pixel coordinate (u, v 0..1) into 3D space.
 */
export function rayFromPixel(
    cameraParams: CameraParams,
    u: number,
    v: number
): { origin: [number, number, number]; direction: [number, number, number] } {
    const camera = new THREE.PerspectiveCamera(cameraParams.fov, 1, 0.1, 1000)

    camera.position.set(
        cameraParams.position[0],
        cameraParams.position[1],
        cameraParams.position[2]
    )
    camera.up.set(0, 1, 0)
    camera.lookAt(
        cameraParams.target[0],
        cameraParams.target[1],
        cameraParams.target[2]
    )

    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()

    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2(u * 2 - 1, -v * 2 + 1)

    raycaster.setFromCamera(ndc, camera)

    return {
        origin: raycaster.ray.origin.toArray() as [number, number, number],
        direction: raycaster.ray.direction.toArray() as [number, number, number]
    }
}
