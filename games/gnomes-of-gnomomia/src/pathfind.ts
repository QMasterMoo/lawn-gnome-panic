// STUB: grid A* pathfinding. Replaced in epic 2.
export interface Point {
  x: number;
  z: number;
}

/**
 * Waypoints from `from` to `to` (excluding `from`, including the end point), avoiding cells where blocked(x, z) is true.
 * If `to` is blocked or unreachable, the path ends at the reachable cell closest to `to`. Empty array = cannot move.
 */
export function findPath(_from: Point, to: Point, _blocked: (x: number, z: number) => boolean): Point[] {
  return [{ x: to.x, z: to.z }];
}
