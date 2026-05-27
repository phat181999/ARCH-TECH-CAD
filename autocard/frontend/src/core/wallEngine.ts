import { Point } from "../types";
import { WallEntity } from "./entities";
import { offsetLine, getLineIntersection, distance } from "./geometry";

export interface ComputedWallPolygon {
  wallId: string;
  points: Point[]; // Usually 4 points representing the filled wall
}

export class WallEngine {
  // Generate filled polygons for all walls, automatically handling corners
  static computePolygons(walls: WallEntity[]): ComputedWallPolygon[] {
    const results: ComputedWallPolygon[] = [];
    
    // For each wall, we need to find if its ends touch any other wall's ends.
    // If they do, we compute the miter joint (intersection of offset lines).
    
    for (const wall of walls) {
      const hw = wall.thickness / 2;
      
      // Default left and right offset lines
      const leftLine = offsetLine(wall.start, wall.end, hw);
      const rightLine = offsetLine(wall.start, wall.end, -hw);
      
      let p1 = leftLine.start; // top-left
      let p2 = leftLine.end;   // top-right
      let p3 = rightLine.end;  // bottom-right
      let p4 = rightLine.start; // bottom-left
      
      // Check intersections at START point
      for (const other of walls) {
        if (other.id === wall.id) continue;
        const otherHw = other.thickness / 2;
        
        // If other wall connects to our start
        if (distance(wall.start, other.end) < 1 || distance(wall.start, other.start) < 1) {
          const otherLeft = offsetLine(other.start, other.end, otherHw);
          const otherRight = offsetLine(other.start, other.end, -otherHw);
          
          // Miter intersections
          const intL = getLineIntersection(leftLine.start, leftLine.end, otherLeft.start, otherLeft.end, true, true);
          const intR = getLineIntersection(rightLine.start, rightLine.end, otherRight.start, otherRight.end, true, true);
          
          // Cross intersections (depending on angle)
          const intL2 = getLineIntersection(leftLine.start, leftLine.end, otherRight.start, otherRight.end, true, true);
          const intR2 = getLineIntersection(rightLine.start, rightLine.end, otherLeft.start, otherLeft.end, true, true);
          
          // Pick the intersection that is closest to our original start point
          const candidatesL = [intL, intL2].filter(Boolean) as Point[];
          if (candidatesL.length > 0) {
            candidatesL.sort((a, b) => distance(a, wall.start) - distance(b, wall.start));
            if (distance(candidatesL[0], wall.start) < wall.thickness * 3) p1 = candidatesL[0];
          }
          
          const candidatesR = [intR, intR2].filter(Boolean) as Point[];
          if (candidatesR.length > 0) {
            candidatesR.sort((a, b) => distance(a, wall.start) - distance(b, wall.start));
            if (distance(candidatesR[0], wall.start) < wall.thickness * 3) p4 = candidatesR[0];
          }
        }
        
        // If other wall connects to our END
        if (distance(wall.end, other.start) < 1 || distance(wall.end, other.end) < 1) {
          const otherLeft = offsetLine(other.start, other.end, otherHw);
          const otherRight = offsetLine(other.start, other.end, -otherHw);
          
          const intL = getLineIntersection(leftLine.start, leftLine.end, otherLeft.start, otherLeft.end, true, true);
          const intR = getLineIntersection(rightLine.start, rightLine.end, otherRight.start, otherRight.end, true, true);
          
          const intL2 = getLineIntersection(leftLine.start, leftLine.end, otherRight.start, otherRight.end, true, true);
          const intR2 = getLineIntersection(rightLine.start, rightLine.end, otherLeft.start, otherLeft.end, true, true);
          
          const candidatesL = [intL, intL2].filter(Boolean) as Point[];
          if (candidatesL.length > 0) {
            candidatesL.sort((a, b) => distance(a, wall.end) - distance(b, wall.end));
            if (distance(candidatesL[0], wall.end) < wall.thickness * 3) p2 = candidatesL[0];
          }
          
          const candidatesR = [intR, intR2].filter(Boolean) as Point[];
          if (candidatesR.length > 0) {
            candidatesR.sort((a, b) => distance(a, wall.end) - distance(b, wall.end));
            if (distance(candidatesR[0], wall.end) < wall.thickness * 3) p3 = candidatesR[0];
          }
        }
      }
      
      results.push({
        wallId: wall.id,
        points: [p1, p2, p3, p4]
      });
    }
    
    return results;
  }
}
