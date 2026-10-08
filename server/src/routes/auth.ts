import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

// Single schema reused by signup and login, so the two can never drift
// on what counts as a valid credential.
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// POST /auth/signup -> 201 { token, user }
// Every route follows this shape: validate with zod first, return 400
// with field errors on failure, only then touch the database.
router.post("/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  // bcrypt with cost factor 10. The plain password is never stored, and
  // `select` below ensures passwordHash never leaves the server.
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    // Public signup always creates an attendee- staff accounts are
    // provisioned separately (seed data), never self-registered.
    data: { email, passwordHash, role: "attendee" },
    select: { id: true, email: true, role: true },
  });

  res.status(201).json({ token: signToken(user.id, user.role), user });
});

// POST /auth/login -> 200 { token, user }
router.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json({
    token: signToken(user.id, user.role),
    user: { id: user.id, email: user.email, role: user.role },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }
  res.json(user);
});

export default router;
