/**
 * Map each community pet id → local .vrm file in /public/models.
 * User dropped 4 VRM files; we distribute them so every pet gets one.
 */

const VRM_FILES = [
  "/models/2060442153061187680.vrm",
  "/models/5564250522320567852.vrm",
  "/models/7028549194645141873.vrm",
  "/models/7391869091225903561.vrm",
] as const;

// Primary pick for the user's own pet (the prettiest full-detail one)
export const USER_PET_VRM = "/models/7391869091225903561.vrm";

// Community pets: deterministic assignment so each pet has a stable avatar.
// Bot intentionally has no VRM — keeps the "filtered" feel.
export const COMMUNITY_VRM: Record<string, string | null> = {
  "dragonfrost-4f3a": VRM_FILES[0],
  "shibaking-7c21": VRM_FILES[1],
  "moonoracle-8b92": VRM_FILES[2],
  "papernugget-2e07": VRM_FILES[3],
  "alphahowl-1d45": VRM_FILES[0],
  "bonkmama-9f33": VRM_FILES[1],
  "scalpkid-6a18": VRM_FILES[2],
  "zenfox-3c71": VRM_FILES[3],
  "degenpup-e204": VRM_FILES[0],
  "infosage-5b88": VRM_FILES[1],
  "perfectxyz-0000": null,        // bot — keep emoji
  "nightowl-8e55": VRM_FILES[2],
};
