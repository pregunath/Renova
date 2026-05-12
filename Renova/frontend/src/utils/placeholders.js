// Public image placeholders for board previews.
// You can safely use these as /<file> since they're in /public.
export const BOARD_PLACEHOLDERS = {
  bathroom: "/mb-bathroom.jpg",
  bedroom:  "/mb-bedroom.jpg",
  kitchen:  "/mb-kitchen.jpg",
  living:   "/mb-living.jpg",
  child:    "/mb-child.jpg",
  dorm:     "/mb-dorm.jpg",
  guest:    "/mb-guest.jpg",
  master:   "/mb-master.jpg",
  studio:   "/mb-studio.jpg",
  study:    "/mb-study.jpg",
};

// Helper to pick a placeholder by key or fallback.
export function pickBoardPreview(key, fallback = "/feat-room.jpg") {
  return BOARD_PLACEHOLDERS[key] || fallback;
}
