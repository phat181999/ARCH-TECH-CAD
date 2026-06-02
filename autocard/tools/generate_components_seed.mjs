#!/usr/bin/env node
/**
 * Reads blockLibrary.ts source and generates cad_components_seed.json.
 * Run from project root: node autocard/tools/generate_components_seed.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const libPath = resolve(__dir, "../frontend/src/data/blockLibrary.ts");
const outPath = resolve(__dir, "cad_components_seed.json");

const src = readFileSync(libPath, "utf-8");

// Extract each block entry: id, label, category, plus a tag set derived from category + label
const blockRegex = /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*icon:\s*"[^"]*",\s*category:\s*"([^"]+)"/g;

const categoryTags = {
  living:     ["furniture", "sofa", "chair", "table", "living room", "lounge"],
  bedroom:    ["furniture", "bed", "bedroom", "sleep", "wardrobe"],
  dining:     ["furniture", "dining", "table", "chair", "eat"],
  kitchen:    ["furniture", "kitchen", "appliance", "sink", "counter", "cabinet"],
  bathroom:   ["fixture", "bathroom", "toilet", "sink", "shower", "bath"],
  office:     ["furniture", "office", "desk", "chair", "workstation"],
  structural: ["structural", "wall", "door", "window", "stair", "column", "beam"],
  electrical: ["electrical", "outlet", "switch", "light", "panel"],
  landscape:  ["landscape", "tree", "plant", "garden", "outdoor"],
  elevation:  ["elevation", "facade", "section", "detail"],
  annotation: ["annotation", "symbol", "north arrow", "scale bar", "tag"],
};

const components = [];
let match;
while ((match = blockRegex.exec(src)) !== null) {
  const [, id, label, category] = match;
  const baseTags = categoryTags[category] || [category];
  const labelWords = label.toLowerCase().split(/[\s\-\/]+/);
  const tags = [...new Set([...baseTags, ...labelWords, category])].filter(t => t.length > 1);

  components.push({
    component_name: label,
    category,
    svg_representation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120"><text x="0" y="8" font-size="10" text-anchor="middle" fill="#374151">${label}</text></svg>`,
    geometry_data: JSON.stringify({ block_id: id, category, label }),
    tags,
  });
}

writeFileSync(outPath, JSON.stringify(components, null, 2), "utf-8");
console.log(`Generated ${components.length} CAD components → ${outPath}`);
