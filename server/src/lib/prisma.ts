/**
 * One shared PrismaClient for the whole server.
 *
 * Every route imports THIS instance rather than constructing its own, so
 * they share a single connection pool instead of opening one each.
 *
 * Prisma 7 no longer reads the connection URL from schema.prisma - a
 * driver adapter must be passed explicitly to the constructor.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
