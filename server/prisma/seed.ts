import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const independenceArcade = await prisma.venue.create({
    data: {
      name: "Independence Arcade",
      address: "Independence Ave, Colombo 07",
      lat: 6.9034,
      lng: 79.8688,
    },
  });

  const barefootGarden = await prisma.venue.create({
    data: {
      name: "Barefoot Garden Cafe",
      address: "704 Galle Rd, Colombo 03",
      lat: 6.8988,
      lng: 79.8542,
    },
  });

  const lionelWendt = await prisma.venue.create({
    data: {
      name: "Lionel Wendt Gallery",
      address: "18 Guildford Cres, Colombo 07",
      lat: 6.9101,
      lng: 79.8571,
    },
  });

  const now = Date.now();
  const hour = 60 * 60 * 1000;

  await prisma.event.createMany({
    data: [
      {
        title: "Colombo Tech Meetup",
        description: "Developers share ideas, demo projects, and network.",
        venueId: independenceArcade.id,
        startsAt: new Date(now + 2 * hour),
        endsAt: new Date(now + 4 * hour),
        capacity: 100,
        remaining: 42,
      },
      {
        title: "Acoustic Night Live",
        description: "An intimate evening of live acoustic performances.",
        venueId: barefootGarden.id,
        startsAt: new Date(now + 24 * hour),
        endsAt: new Date(now + 27 * hour),
        capacity: 60,
        remaining: 8,
      },
      {
        title: "Contemporary Art Expo",
        description:
          "Local artists showcase paintings, sculpture, and installations.",
        venueId: lionelWendt.id,
        startsAt: new Date(now + 72 * hour),
        endsAt: new Date(now + 78 * hour),
        capacity: 200,
        remaining: 156,
      },
      {
        title: "Startup Pitch Night",
        description: "Early-stage founders pitch to a room of mentors.",
        venueId: independenceArcade.id,
        startsAt: new Date(now + 96 * hour),
        endsAt: new Date(now + 98 * hour),
        capacity: 80,
        remaining: 30,
      },
      {
        title: "Jazz & Poetry Evening",
        description: "Spoken word and live jazz in the garden.",
        venueId: barefootGarden.id,
        startsAt: new Date(now + 120 * hour),
        endsAt: new Date(now + 123 * hour),
        capacity: 50,
        remaining: 12,
      },
    ],
  });

  console.log("Seeded 3 venues and 5 events.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
