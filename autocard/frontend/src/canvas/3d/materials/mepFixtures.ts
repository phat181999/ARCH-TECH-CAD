// Wall-mounted MEP fixture catalog — labels + default mounting heights, served
// from object-types.json's mep_fixture entry so new fixture kinds are added by
// editing JSON, not this file.
import { MaterialRegistry, type MepFixtureDef } from "./materialRegistry";

export type MepFixtureType = string;

export function getMepFixtures(): Record<string, MepFixtureDef> {
  return MaterialRegistry.getObjectType("mep_fixture")?.items ?? {};
}
