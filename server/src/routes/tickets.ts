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

const purchaseSchema = z.object({
  eventId: z.string(),
  // Optional: a reference from the simulated payment step. The server
  // deliberately accepts no card fields at all, so there is nothing
  // sensitive to mishandle even by accident.
  paymentRef: z.string().max(64).optional(),
});

// POST /tickets - buy a ticket (mock payment; capacity is the real
// constraint). Attendee-accessible: requireAuth only.
router.post("/", requireAuth, async (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { eventId, paymentRef } = parsed.data;

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
    data: { userId: req.userId!, eventId, status: "confirmed", paymentRef: paymentRef ?? null },
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

// POST /tickets/check-in - door scan. requireStaff is chained after
// requireAuth, so an attendee gets 403 even with a valid session.
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


// DELETE /tickets/:id - cancel a ticket and return its seat to the pool.
//
// Two guards matter here:
//   - scoped to req.userId, so one user can never cancel another's
//     ticket even with a valid session and a guessed id;
//   - guarded on `checkedInAt: null` and status 'confirmed', because a
//     ticket already used at the door must not be cancellable - that
//     would hand back capacity for a seat someone has occupied.
//
// The two writes are wrapped in a transaction: releasing capacity
// without cancelling the ticket (or the reverse) would corrupt the
// count permanently, and `updateMany`'s conditional guard only makes
// each statement individually safe, not the pair.
router.delete("/:id", requireAuth, async (req, res) => {
  const ticketId = String(req.params.id);

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId: req.userId },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (ticket.checkedInAt) {
    res.status(409).json({ error: "This ticket has already been used" });
    return;
  }
  if (ticket.status === "cancelled") {
    res.status(409).json({ error: "This ticket is already cancelled" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    // Conditional update: if a concurrent request cancelled this ticket
    // first, count is 0 and we must not release capacity twice.
    const cancelled = await tx.ticket.updateMany({
      where: { id: ticketId, userId: req.userId, status: "confirmed", checkedInAt: null },
      data: { status: "cancelled" },
    });
    if (cancelled.count === 0) return null;

    await tx.event.update({
      where: { id: ticket.eventId },
      data: { remaining: { increment: 1 } },
    });
    return cancelled.count;
  });

  if (result === null) {
    res.status(409).json({ error: "This ticket could not be cancelled" });
    return;
  }

  res.status(200).json({ cancelled: true, ticketId });
});

export default router;
