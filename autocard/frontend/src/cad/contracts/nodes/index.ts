export type { BaseNode } from './base'
export type {
  LineNode, PolylineNode, ArcNode, CircleNode, RectangleNode,
  TextNode, HatchNode, HatchPattern, DimensionNode, DimensionType, LeaderNode,
} from './drafting'
export type {
  WallNode, WallJoinType,
  DoorNode, DoorSwing,
  WindowNode, WindowType,
  RoomNode,
  GridAxisNode, GridAxisOrientation,
  OpeningGroupNode,
} from './architectural'
export type {
  BlockDefinitionNode, BlockCategory,
  BlockInstanceNode,
  GroupNode,
} from './composition'
export type { ModelSpaceNode, PaperSpaceNode, ViewportNode } from './layout'
export type {
  SiteNode, BuildingNode, LevelNode, SlabNode,
  ColumnNode, RoofNode, ZoneNode, FurnitureNode,
} from './bim'

import type { LineNode, PolylineNode, ArcNode, CircleNode, RectangleNode, TextNode, HatchNode, DimensionNode, LeaderNode } from './drafting'
import type { WallNode, DoorNode, WindowNode, RoomNode, GridAxisNode, OpeningGroupNode } from './architectural'
import type { BlockDefinitionNode, BlockInstanceNode, GroupNode } from './composition'
import type { ModelSpaceNode, PaperSpaceNode, ViewportNode } from './layout'
import type { SiteNode, BuildingNode, LevelNode, SlabNode, ColumnNode, RoofNode, ZoneNode, FurnitureNode } from './bim'

export type CadNode =
  | LineNode | PolylineNode | ArcNode | CircleNode | RectangleNode
  | TextNode | HatchNode | DimensionNode | LeaderNode
  | WallNode | DoorNode | WindowNode | RoomNode | GridAxisNode | OpeningGroupNode
  | BlockDefinitionNode | BlockInstanceNode | GroupNode
  | ModelSpaceNode | PaperSpaceNode | ViewportNode
  | SiteNode | BuildingNode | LevelNode | SlabNode | ColumnNode | RoofNode | ZoneNode | FurnitureNode

export type CadNodeType = CadNode['type']

export function isWallNode(n: CadNode): n is WallNode { return n.type === 'wall' }
export function isDoorNode(n: CadNode): n is DoorNode { return n.type === 'door' }
export function isWindowNode(n: CadNode): n is WindowNode { return n.type === 'window' }
export function isRoomNode(n: CadNode): n is RoomNode { return n.type === 'room' }
export function isTextNode(n: CadNode): n is TextNode { return n.type === 'text' }
export function isDimensionNode(n: CadNode): n is DimensionNode { return n.type === 'dimension' }
export function isBlockInstance(n: CadNode): n is BlockInstanceNode { return n.type === 'block-instance' }
