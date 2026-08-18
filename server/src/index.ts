import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import type { Event } from "@eventpass/shared";
import authRouter from "./routes/auth.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.get("/health", (_req: Request, res: Response) => {
  const sample: Pick<Event, "title"> = { title: "EventPass API is running" };
  res.json({ status: "ok", ...sample });
});

app.listen(PORT, () => {
  console.log(`EventPass server listening on port ${PORT}`);
});
