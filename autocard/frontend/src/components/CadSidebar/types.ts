export type BlockSource = "default" | "mine" | "org";

export interface CollapsedSections {
  architecture: boolean;
  draw: boolean;
  modify: boolean;
  annotate: boolean;
  blocks: boolean;
  layers: boolean;
  properties: boolean;
  ai: boolean;
}
