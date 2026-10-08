import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Demo-account credentials come from `.env` (gitignored), with fallbacks
// so a fresh clone still seeds and runs without any setup. The real
// passwords for THIS machine live in the repo-root `passwords.md`, which
// is also gitignored.
const STAFF_EMAIL = "staff@eventpass.dev";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD ?? "staffpass123";
const DEMO_EMAIL = "demo@eventpass.dev";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demopass123";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Reseeding must be idempotent- this script gets re-run before every demo
  // (event start times are relative to Date.now(), so they go stale fast).
  // Without clearing first, every re-run duplicated all venues/events
  // forever. Delete in FK-dependency order- tickets and itinerary items
  // reference events, which reference venues.
  await prisma.ticket.deleteMany();
  await prisma.itineraryItem.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();

  // Staff accounts are provisioned, not self-registered (public signup
  // always creates attendees)- upsert so re-running the seed doesn't
  // duplicate or fail on the unique email constraint, and doesn't wipe
  // real attendee accounts created via signup along the way.
  await prisma.user.upsert({
    where: { email: STAFF_EMAIL },
    // The hash is refreshed on update too, so rotating STAFF_PASSWORD in
    // .env and reseeding actually changes the login- an update that only
    // set `role` would silently keep the old password.
    update: { role: "staff", passwordHash: await bcrypt.hash(STAFF_PASSWORD, 10) },
    create: {
      email: STAFF_EMAIL,
      passwordHash: await bcrypt.hash(STAFF_PASSWORD, 10),
      role: "staff",
    },
  });

  // A ready-made attendee, so the demo does not have to start with a
  // signup flow every time the database is reset.
  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { role: "attendee", passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) },
    create: {
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      role: "attendee",
    },
  });

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

  const nelumPokuna = await prisma.venue.create({
    data: {
      name: "Nelum Pokuna Theatre",
      address: "Elvitigala Mawatha, Colombo 07",
      lat: 6.9027,
      lng: 79.8752,
    },
  });

  const racecourse = await prisma.venue.create({
    data: {
      name: "Racecourse Grounds",
      address: "Reid Ave, Colombo 07",
      lat: 6.9058,
      lng: 79.8654,
    },
  });

  // ~7km south of the Colombo 07 cluster. Every other venue is within
  // ~2km of the others, which at the solver's assumed 30km/h is only a
  // few minutes of travel- too short for a travel-time clash to ever
  // trigger. This venue exists so that constraint is demonstrable.
  const mountLaviniaBeach = await prisma.venue.create({
    data: {
      name: "Mount Lavinia Beach Stage",
      address: "Hotel Rd, Mount Lavinia",
      lat: 6.8389,
      lng: 79.8653,
    },
  });

  const viharamahadeviTheatre = await prisma.venue.create({
    data: {
      name: "Viharamahadevi Open Air Theatre",
      address: "Viharamahadevi Park, Colombo 07",
      lat: 6.9147,
      lng: 79.8607,
    },
  });

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  await prisma.event.createMany({
    data: [
      {
        title: "Colombo Tech Meetup",
        description:
          "Local developers demo side projects, swap notes on shipping to production, and grab free pizza. This month's lightning talks cover offline-first mobile architecture, Postgres performance tuning, and a live teardown of a real outage postmortem. Open to all experience levels- no talk is too small.",
        venueId: independenceArcade.id,
        startsAt: new Date(now + 5 * hour),
        endsAt: new Date(now + 7 * hour),
        capacity: 100,
        remaining: 42,
        imageKey: "tech",
      },
      {
        title: "Acoustic Night Live",
        description:
          "An intimate evening of stripped-back live sets from three local singer-songwriters, seated cafe-style with fairy lights and a small bar menu. Doors open thirty minutes before the first set- seating is first-come, first-served and this one tends to sell out.",
        venueId: barefootGarden.id,
        startsAt: new Date(now + day),
        endsAt: new Date(now + day + 3 * hour),
        capacity: 60,
        remaining: 6,
        imageKey: "music",
      },
      {
        title: "Contemporary Art Expo",
        description:
          "Thirty-two local and regional artists showcase paintings, sculpture, and mixed-media installations across three gallery floors, with an opening-night artist talk at 6pm. Free guided tours run every hour for anyone who wants context on the pieces.",
        venueId: lionelWendt.id,
        startsAt: new Date(now + 3 * day),
        endsAt: new Date(now + 3 * day + 6 * hour),
        capacity: 200,
        remaining: 156,
        imageKey: "art",
      },
      {
        title: "Startup Pitch Night",
        description:
          "Eight early-stage founders get six minutes each to pitch to a room of angel investors and mentors, followed by open networking over drinks. Judged audience voting decides a small cash prize for the crowd favorite- come early, seats near the front fill up fast.",
        venueId: independenceArcade.id,
        startsAt: new Date(now + 4 * day),
        endsAt: new Date(now + 4 * day + 2 * hour),
        capacity: 80,
        remaining: 30,
        imageKey: "business",
      },
      {
        title: "Jazz & Poetry Evening",
        description:
          "Spoken-word poets share the stage with a live jazz trio in the garden courtyard, trading sets back and forth as the sun goes down. Bring a jacket- it's an open-air venue and gets cool after dark.",
        venueId: barefootGarden.id,
        startsAt: new Date(now + 5 * day),
        endsAt: new Date(now + 5 * day + 3 * hour),
        capacity: 50,
        remaining: 12,
        imageKey: "music",
      },
      {
        title: "Stand-up Comedy Showcase",
        description:
          "Five of the city's sharpest stand-up comics take the stage for a rapid-fire night of sets, headlined by a comic fresh off a national tour. Strictly 18+, and yes, there's a good chance you'll get called on if you sit in the front two rows.",
        venueId: nelumPokuna.id,
        startsAt: new Date(now + 2 * day),
        endsAt: new Date(now + 2 * day + 2 * hour),
        capacity: 300,
        remaining: 88,
        imageKey: "comedy",
      },
      {
        title: "Sunset Yoga & Wellness",
        description:
          "An all-levels outdoor yoga flow timed to end right as the sun sets over the park, followed by a short guided meditation. Mats provided, but bring your own if you have a favorite- it gets crowded near the front.",
        venueId: viharamahadeviTheatre.id,
        startsAt: new Date(now + 1 * day + 6 * hour),
        endsAt: new Date(now + 1 * day + 8 * hour),
        capacity: 120,
        remaining: 97,
        imageKey: "wellness",
      },
      {
        title: "Indie Film Screening Night",
        description:
          "Three award-winning short films from local independent filmmakers, followed by a Q&A panel with the directors. Snacks and a cash bar available in the lobby before doors and during intermission.",
        venueId: lionelWendt.id,
        startsAt: new Date(now + 6 * day),
        endsAt: new Date(now + 6 * day + 3 * hour),
        capacity: 90,
        remaining: 51,
        imageKey: "film",
      },
      {
        title: "Colombo Marathon Expo",
        description:
          "Bib pickup, gear check, and a full sports-brand expo floor for this weekend's city marathon- open to runners and spectators alike. Physio and sports-massage booths are first-come, first-served, so come early if you want one before race day.",
        venueId: racecourse.id,
        startsAt: new Date(now + 7 * day),
        endsAt: new Date(now + 7 * day + 8 * hour),
        capacity: 500,
        remaining: 412,
        imageKey: "sports",
      },
      {
        title: "Craft Beer & Food Festival",
        description:
          "A dozen local breweries and twice as many food stalls set up across the grounds for an afternoon-to-evening festival, with two live bands on the main stage. Entry includes a tasting glass and four drink tokens- food is pay-as-you-go.",
        venueId: racecourse.id,
        startsAt: new Date(now + 8 * day),
        endsAt: new Date(now + 8 * day + 6 * hour),
        capacity: 400,
        remaining: 340,
        imageKey: "food",
      },
      {
        title: "UX/UI Design Workshop",
        description:
          "A hands-on half-day workshop covering user research basics, rapid prototyping, and a live critique session- bring a laptop with Figma installed. Small-group format capped well below the room's capacity so everyone gets feedback on their work.",
        venueId: independenceArcade.id,
        startsAt: new Date(now + 9 * day),
        endsAt: new Date(now + 9 * day + 4 * hour),
        capacity: 40,
        remaining: 9,
        imageKey: "workshop",
      },
      {
        title: "Symphony Under the Stars",
        description:
          "The city's philharmonic orchestra performs an open-air program of classical favorites, ending with a full-orchestra rendition of a well-loved film score. Bring a picnic blanket- lawn seating opens ninety minutes before the show.",
        venueId: viharamahadeviTheatre.id,
        startsAt: new Date(now + 10 * day),
        endsAt: new Date(now + 10 * day + 3 * hour),
        capacity: 600,
        remaining: 233,
        imageKey: "classical",
      },
      // ---------------------------------------------------------------
      // The two events below exist specifically to make the constraint
      // algorithm demonstrable. Without them NO pair of seeded events
      // clashes (verified: 0 of 66 pairs), so the app's core feature
      // could never be shown in a demo or viva.
      //
      // Both are scheduled against "Colombo Tech Meetup" (now+5h -> +7h),
      // one per constraint:
      // ---------------------------------------------------------------
      {
        // CONSTRAINT 1- TIME OVERLAP. Runs 6h-8h30 against the meetup's
        // 5h-7h, so the intervals genuinely intersect.
        title: "Indie Film Double Bill",
        description:
          "Two independent features back to back with a short director Q&A in between, screened from 35mm in the gallery's upstairs room. Seating is unreserved and the room is small, so arrive early if you want a good view of the screen.",
        venueId: lionelWendt.id,
        startsAt: new Date(now + 6 * hour),
        endsAt: new Date(now + 8 * hour + 30 * 60 * 1000),
        capacity: 80,
        remaining: 31,
        imageKey: "film",
      },
      {
        // CONSTRAINT 2- INSUFFICIENT TRAVEL TIME. Starts 10 minutes
        // after the meetup ends, but Mount Lavinia is ~7km from
        // Independence Arcade: ~14 min at 30km/h. No time overlap at
        // all, so this isolates the travel-buffer rule cleanly.
        title: "Sunset Beach Session",
        description:
          "An open-air DJ set on the sand as the sun goes down, running into the evening with food trucks along the back of the beach. Barefoot encouraged; the stage is a short walk from the railway station.",
        venueId: mountLaviniaBeach.id,
        startsAt: new Date(now + 7 * hour + 10 * 60 * 1000),
        endsAt: new Date(now + 10 * hour),
        capacity: 300,
        remaining: 118,
        imageKey: "music",
      },
    ],
  });

  console.log("Seeded 7 venues and 14 events.");
  console.log(`Staff login:    ${STAFF_EMAIL} / ${STAFF_PASSWORD}`);
  console.log(`Attendee login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
