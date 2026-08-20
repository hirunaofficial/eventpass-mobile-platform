import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    include: { venue: true },
  });
  res.json(events);
});

export default router;
