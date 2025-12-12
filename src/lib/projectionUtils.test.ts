
import { projectPoint, rayFromPixel, CameraParams } from './projectionUtils';
import * as THREE from 'three';

describe('projectionUtils', () => {
    // Setup a standard camera looking at origin from z=5
    const cameraParams: CameraParams = {
        position: [0, 0, 5],
        target: [0, 0, 0],
        fov: 50
    };

    test('projectPoint projects origin to center of screen', () => {
        const point: [number, number, number] = [0, 0, 0];
        const projected = projectPoint(cameraParams, point);

        // Expect center of screen (0.5, 0.5)
        // Small floating point tolerance might be needed
        expect(projected).not.toBeNull();
        expect(projected!.u).toBeCloseTo(0.5);
        expect(projected!.v).toBeCloseTo(0.5);
    });

    test('projectPoint projects point to right of center', () => {
        // Point at x=1 should be to the right (u > 0.5)
        const point: [number, number, number] = [1, 0, 0];
        const projected = projectPoint(cameraParams, point);

        expect(projected).not.toBeNull();
        expect(projected!.u).toBeGreaterThan(0.5);
        expect(projected!.v).toBeCloseTo(0.5);
    });

    test('rayFromPixel gets origin and direction', () => {
        // Ray from center should go straight down -Z
        const ray = rayFromPixel(cameraParams, 0.5, 0.5);

        expect(ray.origin).toEqual(expect.arrayContaining([0, 0, 5]));
        // Direction should be roughly [0, 0, -1]
        expect(ray.direction[0]).toBeCloseTo(0);
        expect(ray.direction[1]).toBeCloseTo(0);
        expect(ray.direction[2]).toBeCloseTo(-1);
    });

    /* 
     Mock Database Test Example 
     (Assuming we mock supabase in a real integration test, 
      here we just test logic structure)
    */
    test('Mock: annotation logic', () => {
        const mockAnnotation = {
            id: '123',
            position: { x: 0, y: 0, z: 0 }
        };
        // Logic from ViewPage:
        const point = [mockAnnotation.position.x, mockAnnotation.position.y, mockAnnotation.position.z] as [number, number, number];
        const projected = projectPoint(cameraParams, point);

        expect(projected).toEqual({ u: 0.5, v: 0.5 });
    });
});
