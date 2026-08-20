import { Router } from "express";
import { z } from "zod";
import { findClash, type ClashCheckEvent } from "@eventpass/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.itineraryItem.findMany({
    where: { userId: req.userId },
    include: { event: { include: { venue: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });
  res.json(items);
});

const addItemSchema = z.object({ eventId: z.string() });

router.post("/", requireAuth, async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { eventId } = parsed.data;

  const candidateEvent = await prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: true },
  });
  if (!candidateEvent) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const existingItems = await prisma.itineraryItem.findMany({
    where: { userId: req.userId },
    include: { event: { include: { venue: true } } },
  });

  const candidate: ClashCheckEvent = {
    id: candidateEvent.id,
    startsAt: candidateEvent.startsAt.toISOString(),
    endsAt: candidateEvent.endsAt.toISOString(),
    venue: { lat: candidateEvent.venue.lat, lng: candidateEvent.venue.lng },
  };
  const existing: ClashCheckEvent[] = existingItems.map((item) => ({
    id: item.event.id,
    startsAt: item.event.startsAt.toISOString(),
    endsAt: item.event.endsAt.toISOString(),
    venue: { lat: item.event.venue.lat, lng: item.event.venue.lng },
  }));

  const clash = findClash(candidate, existing);
  if (clash) {
    res.status(409).json({ error: "This event clashes with your itinerary", clash });
    return;
  }

  const created = await prisma.itineraryItem.create({
    data: { userId: req.userId!, eventId },
    include: { event: { include: { venue: true } } },
  });
  res.status(201).json(created);
});

router.delete("/:eventId", requireAuth, async (req, res) => {
  await prisma.itineraryItem.deleteMany({
    where: { userId: req.userId, eventId: String(req.params.eventId) },
  });
  res.status(204).send();
});

export default router;
