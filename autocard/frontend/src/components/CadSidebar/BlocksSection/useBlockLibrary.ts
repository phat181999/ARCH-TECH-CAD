import { useState, useEffect } from "react";
import { listMyBlocks, listOrgBlocks, type OrgBlockRecord } from "../../../services/blockStoreService";
import type { BlockSource } from "../types";

export function useBlockLibrary(source: BlockSource, token?: string, orgId?: string | null) {
  const [myBlocks, setMyBlocks] = useState<OrgBlockRecord[]>([]);
  const [orgBlocks, setOrgBlocks] = useState<OrgBlockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source === "mine" && token) {
      setLoading(true); setError(null);
      listMyBlocks(token).then(setMyBlocks).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }
    if (source === "org" && token && orgId) {
      setLoading(true); setError(null);
      listOrgBlocks(token, orgId).then(setOrgBlocks).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }
  }, [source, token, orgId]);

  return { myBlocks, orgBlocks, loading, error };
}
