/**
 * VRM model for the user's pet and community pets.
 * Only the shiba inu model is bundled.
 */

// Primary VRM — the shiba inu used for all pets
export const USER_PET_VRM = "/models/7391869091225903561.vrm";

// Community pets all share the same model; bots get emoji fallback.
export const COMMUNITY_VRM: Record<string, string | null> = {
  "dragonfrost-4f3a": USER_PET_VRM,
  "shibaking-7c21":   USER_PET_VRM,
  "moonoracle-8b92":  USER_PET_VRM,
  "papernugget-2e07": USER_PET_VRM,
  "alphahowl-1d45":   USER_PET_VRM,
  "bonkmama-9f33":    USER_PET_VRM,
  "scalpkid-6a18":    USER_PET_VRM,
  "zenfox-3c71":      USER_PET_VRM,
  "degenpup-e204":    USER_PET_VRM,
  "infosage-5b88":    USER_PET_VRM,
  "perfectxyz-0000":  null,           // bot — emoji fallback
  "nightowl-8e55":    USER_PET_VRM,
};
