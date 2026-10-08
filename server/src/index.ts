import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import type { Event } from "@eventpass/shared";
import authRouter from "./routes/auth.js";
import eventsRouter from "./routes/events.js";
import itineraryRouter from "./routes/itinerary.js";
import ticketsRouter from "./routes/tickets.js";

// API entry point. Middleware order matters: CORS and the JSON body
// parser must run before any router, and the 404/error handlers must be
// registered last so they only catch what no route matched.
const app = express();
app.use(cors());
app.use(express.json());
// One router per resource. Adding a feature = new file in routes/ +
// one mount line here.
app.use("/auth", authRouter);
app.use("/events", eventsRouter);
app.use("/itinerary", itineraryRouter);
app.use("/tickets", ticketsRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Liveness probe. The typed `sample` is deliberate: it imports a shared
// type, so a drift between client and server contracts fails the build.
app.get("/health", (_req: Request, res: Response) => {
  const sample: Pick<Event, "title"> = { title: "EventPass API is running" };
  res.json({ status: "ok", ...sample });
});

// Catch-all 404: every unmatched path still returns the { error } shape
// the client's apiFetch expects, rather than Express's HTML default.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Four-argument signature is what marks this as Express's error handler.
// Logs the real cause server-side, returns a generic message to the
// client so internals are never leaked.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`EventPass server listening on port ${PORT}`);
});
