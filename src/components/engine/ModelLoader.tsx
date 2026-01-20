'use client'

/**
 * Model Loader - Production Optimized
 * 
 * Handles loading of different 3D file formats.
 * OPTIMIZED: Proper disposal, geometry optimization, material caching.
 */

import React, { useEffect, memo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useLoader, useThree } from '@react-three/fiber'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import * as THREE from 'three'
import { ENGINE_CONFIG } from '@/lib/config'
import { getFileType } from './types'
import { disposeObject } from './utils'

type ModelLoaderProps = {
    url: string
    name?: string
    onLoad: () => void
    onClick?: (event: any) => void
}

// ============================================================================
// SECURITY: URL VALIDATION
// ============================================================================

/**
 * Validate model URL to prevent potential security issues
 * Allows: http, https, blob protocols
 * Blocks: javascript:, data: (except for small models), file:
 */
function isValidModelUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false

    // Trim and lowercase for comparison
    const trimmed = url.trim()
    const lower = trimmed.toLowerCase()

    // Block dangerous protocols
    if (lower.startsWith('javascript:')) return false
    if (lower.startsWith('vbscript:')) return false

    // Allow blob URLs (used for local file uploads)
    if (lower.startsWith('blob:')) return true

    // Allow data URLs only for small payloads (< 1MB base64)
    if (lower.startsWith('data:')) {
        // Rough check: base64 is ~1.37x larger than original
        // 1MB = ~1.4M chars in base64
        return trimmed.length < 1_400_000
    }

    // Validate http/https URLs
    try {
        const parsed = new URL(trimmed)
        return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
        // Relative URLs are allowed
        return !lower.includes(':') || lower.startsWith('/')
    }
}

// ============================================================================
// SHARED MATERIAL (Reduces draw calls and memory)
// ============================================================================

// Create once, reuse everywhere - improves performance significantly
const sharedSTLMaterial = new THREE.MeshStandardMaterial({
    color: '#b0b0b0',
    metalness: 0.3,
    roughness: 0.6,
    flatShading: false,
})

const sharedOBJMaterial = new THREE.MeshStandardMaterial({
    color: '#b0b0b0',
    metalness: 0.3,
    roughness: 0.6,
})

// ============================================================================
// GLTF/GLB Model Loader
// ============================================================================

const GltfModel = memo(function GltfModel({ url, onLoad, onClick }: ModelLoaderProps) {
    const gltf = useGLTF(url, ENGINE_CONFIG.dracoUrl)
    const { gl } = useThree()

    useEffect(() => {
        if (gltf?.scene) {
            // Optimize geometry for rendering
            gltf.scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // Enable frustum culling
                    child.frustumCulled = true

                    // Compute bounding sphere for better culling
                    if (child.geometry && !child.geometry.boundingSphere) {
                        child.geometry.computeBoundingSphere()
                    }
                }
            })

            onLoad()
        }
    }, [gltf, onLoad])

    // Handle WebGL context loss
    useEffect(() => {
        const handleContextLost = (event: Event) => {
            event.preventDefault()
            console.warn('WebGL context lost, attempting recovery...')
        }

        const handleContextRestored = () => {
            console.log('WebGL context restored')
        }

        const canvas = gl.domElement
        canvas.addEventListener('webglcontextlost', handleContextLost)
        canvas.addEventListener('webglcontextrestored', handleContextRestored)

        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost)
            canvas.removeEventListener('webglcontextrestored', handleContextRestored)
        }
    }, [gl])

    if (!gltf?.scene) return null

    return (
        <primitive
            object={gltf.scene}
            onClick={onClick}
            dispose={null} // We handle disposal manually
        />
    )
})

// ============================================================================
// STL Model Loader
// ============================================================================

const StlModel = memo(function StlModel({ url, onLoad, onClick }: ModelLoaderProps) {
    const geometry = useLoader(STLLoader, url)
    const meshRef = useRef<THREE.Mesh>(null)

    useEffect(() => {
        if (geometry) {
            // Optimize geometry
            geometry.center()
            geometry.computeVertexNormals()
            geometry.computeBoundingSphere()

            // Ensure indices exist for better performance
            if (!geometry.index) {
                // Convert to indexed geometry if possible (reduces vertex count)
                const positions = geometry.getAttribute('position')
                if (positions && positions.count < 100000) {
                    // Only optimize for smaller models to avoid long blocking
                    geometry.deleteAttribute('normal')
                    geometry.computeVertexNormals()
                }
            }

            onLoad()
        }
    }, [geometry, onLoad])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (geometry) {
                geometry.dispose()
            }
        }
    }, [geometry])

    if (!geometry) return null

    return (
        <mesh
            ref={meshRef}
            geometry={geometry}
            onClick={onClick}
            frustumCulled={true}
        >
            <primitive object={sharedSTLMaterial} attach="material" />
        </mesh>
    )
})

// ============================================================================
// OBJ Model Loader
// ============================================================================

const ObjModel = memo(function ObjModel({ url, onLoad, onClick }: ModelLoaderProps) {
    const obj = useLoader(OBJLoader, url)
    const groupRef = useRef<THREE.Group>(null)

    useEffect(() => {
        if (obj) {
            // Apply shared material and optimize
            obj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // Use shared material if no custom material
                    if (!child.material ||
                        (child.material as THREE.Material).type === 'MeshBasicMaterial') {
                        child.material = sharedOBJMaterial
                    }

                    // Enable frustum culling
                    child.frustumCulled = true

                    // Compute bounds
                    if (child.geometry) {
                        child.geometry.computeBoundingSphere()
                    }
                }
            })

            onLoad()
        }
    }, [obj, onLoad])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (obj) {
                disposeObject(obj)
            }
        }
    }, [obj])

    if (!obj) return null

    return <primitive ref={groupRef} object={obj} onClick={onClick} />
})

// ============================================================================
// Unsupported Format Placeholder
// ============================================================================

const UnsupportedModel = memo(function UnsupportedModel({ name }: { name?: string }) {
    const ext = name?.split('.').pop()?.toUpperCase() || 'UNKNOWN'

    return (
        <group>
            <mesh frustumCulled={true}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial
                    color="#ef4444"
                    wireframe
                    transparent
                    opacity={0.5}
                />
            </mesh>
        </group>
    )
})

// ============================================================================
// Main Model Dispatcher
// ============================================================================

export const ModelLoader = memo(function ModelLoader({
    url,
    name,
    onLoad,
    onClick
}: ModelLoaderProps) {
    // ========== SECURITY: Validate URL before loading ==========
    if (!isValidModelUrl(url)) {
        console.error('ModelLoader: Invalid or potentially unsafe URL blocked:', url)
        return <UnsupportedModel name={`Invalid URL: ${name || 'unknown'}`} />
    }
    // ============================================================

    const fileType = getFileType(name || url)

    // Clear GLTF cache on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (fileType === 'gltf') {
                useGLTF.clear(url)
            }
        }
    }, [url, fileType])

    switch (fileType) {
        case 'gltf':
            return <GltfModel url={url} name={name} onLoad={onLoad} onClick={onClick} />
        case 'stl':
            return <StlModel url={url} name={name} onLoad={onLoad} onClick={onClick} />
        case 'obj':
            return <ObjModel url={url} name={name} onLoad={onLoad} onClick={onClick} />
        case 'parametric':
            throw new Error(
                `Cannot render parametric files (.${name?.split('.').pop()}) in browser. ` +
                `Please convert to GLB or STL first.`
            )
        default:
            return <UnsupportedModel name={name} />
    }
})

export default ModelLoader
