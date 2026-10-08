/**
 * Itinerary routes - where the constraint algorithm is ENFORCED.
 *
 * The app also runs findClash() locally for instant feedback, but this
 * is the authoritative check: another device could have changed the
 * itinerary since the client last synced. Both sides import the same
 * function from @eventpass/shared, so they cannot disagree on the rules.
 */
import { Router } from "express";
import { z } from "zod";
import {
  findClash,
  suggestAlternatives,
  type ClashCheckEvent,
  type SuggestionCandidate,
} from "@eventpass/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /itinerary - this user's plan, ordered by start time so the
// client can render a timeline without re-sorting.
router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.itineraryItem.findMany({
    where: { userId: req.userId },
    include: { event: { include: { venue: true } } },
    orderBy: { event: { startsAt: "asc" } },
  });
  res.json(items);
});

const addItemSchema = z.object({ eventId: z.string() });

// POST /itinerary - add an event, subject to the constraints.
// 201 on success, 409 + { clash, resolutions } when rejected.
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

  // Both sides are mapped to the algorithm's minimal shape (id, times,
  // venue coords). Prisma returns Date objects; the shared function
  // works in ISO strings so the same code runs in the browser/app.
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
    // The server is the authoritative constraint check, so it also owns
    // the authoritative repair options- a client working from a stale
    // cache could otherwise propose an alternative that is itself no
    // longer valid. The catalogue is read fresh here for that reason.
    const catalogue = await prisma.event.findMany({
      where: { startsAt: { gt: new Date() } },
      include: { venue: true },
      orderBy: { startsAt: "asc" },
    });
    const resolutions = suggestAlternatives(
      { ...candidate, category: candidateEvent.imageKey },
      existing,
      catalogue.map(
        (e): SuggestionCandidate => ({
          id: e.id,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          venue: { lat: e.venue.lat, lng: e.venue.lng },
          category: e.imageKey,
        })
      )
    );
    res.status(409).json({
      error: "This event clashes with your itinerary",
      clash,
      resolutions,
    });
    return;
  }

  const created = await prisma.itineraryItem.create({
    data: { userId: req.userId!, eventId },
    include: { event: { include: { venue: true } } },
  });
  res.status(201).json(created);
});

// DELETE /itinerary/:eventId - deleteMany (not delete) so removing
// something already gone is a no-op rather than a 500. Scoped to
// req.userId, so one user can never delete another's item.
router.delete("/:eventId", requireAuth, async (req, res) => {
  await prisma.itineraryItem.deleteMany({
    where: { userId: req.userId, eventId: String(req.params.eventId) },
  });
  res.status(204).send();
});

export default router;
