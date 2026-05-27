// Re-exports node types from contracts — replaces src/core/entities.ts
export type {
  BaseNode,
  WallNode, DoorNode, WindowNode, RoomNode, GridAxisNode, OpeningGroupNode,
  LineNode, PolylineNode, ArcNode, CircleNode, RectangleNode,
  CadNode, CadNodeType,
} from '../../contracts/nodes'
export { isWallNode, isDoorNode, isWindowNode, isRoomNode } from '../../contracts/nodes'
