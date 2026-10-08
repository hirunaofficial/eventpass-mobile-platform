import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /events - the full catalogue, venue joined in.
// `include: { venue: true }` matters: the client's clash algorithm needs
// venue coordinates to compute travel time, so sending events without
// their venue would break the constraint check.
router.get("/", requireAuth, async (_req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    include: { venue: true },
  });
  res.json(events);
});

export default router;
