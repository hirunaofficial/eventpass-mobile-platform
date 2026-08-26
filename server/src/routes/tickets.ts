import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { userId: req.userId },
    include: { event: { include: { venue: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(tickets);
});

const purchaseSchema = z.object({ eventId: z.string() });

router.post("/", requireAuth, async (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { eventId } = parsed.data;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  // Atomic capacity check-and-decrement: only succeeds if remaining > 0 at
  // the moment of the update, so concurrent purchases can't oversell.
  const decremented = await prisma.event.updateMany({
    where: { id: eventId, remaining: { gt: 0 } },
    data: { remaining: { decrement: 1 } },
  });

  if (decremented.count === 0) {
    res.status(409).json({ error: "This event is sold out" });
    return;
  }

  const ticket = await prisma.ticket.create({
    data: { userId: req.userId!, eventId, status: "confirmed" },
    include: { event: { include: { venue: true } } },
  });

  res.status(201).json(ticket);
});

router.get("/:id/qr", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: String(req.params.id) } });
  if (!ticket || ticket.userId !== req.userId) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ qrToken: ticket.qrToken });
});

const checkInSchema = z.object({ qrToken: z.string() });

router.post("/check-in", requireAuth, requireStaff, async (req, res) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { qrToken: parsed.data.qrToken },
    include: { event: { include: { venue: true } } },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (ticket.status === "cancelled") {
    res.status(409).json({ error: "This ticket was cancelled" });
    return;
  }
  if (ticket.checkedInAt) {
    res.status(409).json({
      error: `Already checked in at ${ticket.checkedInAt.toLocaleString()}`,
      ticket,
    });
    return;
  }

  // Atomic guard: only marks checked-in if still unset at the moment of the
  // update, so two staff scanning the same ticket at once can't both "win".
  const updated = await prisma.ticket.updateMany({
    where: { qrToken: parsed.data.qrToken, checkedInAt: null },
    data: { checkedInAt: new Date() },
  });

  if (updated.count === 0) {
    res.status(409).json({ error: "This ticket was already checked in" });
    return;
  }

  const checkedInTicket = await prisma.ticket.findUnique({
    where: { qrToken: parsed.data.qrToken },
    include: { event: { include: { venue: true } } },
  });

  res.json({ valid: true, ticket: checkedInTicket });
});

export default router;
