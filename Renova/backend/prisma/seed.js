// backend/prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      key: "free",
      name: "Free",
      priceId: "price_1SasQH7XfxcKzPnIfiSb8dlV",     // TODO: replace with real Stripe price IDs
      interval: "mo",
      price: 0,
      limits: { generations: 3, moodboards: 5 },
      perks: [
        "3 AI generations / month",
        "5 moodboards",
      ],
      },
    {
      key: "starter",
      name: "Starter",
      priceId: "price_1Sbw237XfxcKzPnIXPvGPm2C",
      interval: "mo",
      price: 900,                    // $9.00
      limits: { generations: 20, moodboards: 15 },
      perks: [
        "20 AI generations / month",
        "15 moodboards",
        "Email support",
        
      ],
      },
    {
      key: "pro",
      name: "Pro",
      priceId: "price_1Sbw7v7XfxcKzPnILt3i6lOV",
      interval: "mo",
      price: 1900,                   // $19.00
      limits: { generations: 50, moodboards: 50 },
      perks: [
        "50 generations / month",
        "50 moodboards",
        "Priority support",
        
      ],
      },
    {
      key: "studio",
      name: "Studio",
      priceId: "price_1SbwAN7XfxcKzPnIHx0b65lu",
      interval: "mo",
      price: 3900,                   // $39.00
      limits: { generations: 150, moodboards: 150 },
      perks: [
        "150 AI generations / month",
        "150 moodboards",
        "Priority support",
        
      ],
      },
    {
      key: "team",
      name: "Team",
      priceId: "price_1SbwAl7XfxcKzPnImPcXN5fZ",
      interval: "mo",
      price: 7900,                   // $79.00
      limits: { generations: 500, moodboards: 500 },
      perks: [
        "500 AI generations / month",
        "500 moodboards",
        
        "Priority support",
      ],
      },

  //ADD-ONS
    {
      key: "addon_gen_10",
      name: "+10 Generations",
      priceId: "price_1TG3s67XfxcKzPnIwD47ihx9",
      interval: "ot", 
      price: 500, // 5.00 USD
      limits: { isAddon: true, addonType: "generations", addonAmount: 10 },
      perks: ["One-time purchase", "Never resets", "Adds 10 generations",],
    },

    {
      key: "addon_gen_20",
      name: "+20 Generations",
      priceId: "price_1TG4il7XfxcKzPnIcY6NtVzM", 
      interval: "ot",
      price: 1000, // 10.00 USD
      limits: { isAddon: true, addonType: "generations", addonAmount: 20 },
      perks: ["One-time purchase", "Never resets", "Adds 20 generations",],
    },

    {
      key: "addon_gen_30",
      name: "+30 Generations",
      priceId: "price_1TG4so7XfxcKzPnI4kkb6iL2", 
      interval: "ot",
      price: 1500, // 15.00 USD
      limits: { isAddon: true, addonType: "generations", addonAmount: 30 },
      perks: ["One-time purchase", "Never resets", "Adds 30 generations",],
    },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { key: p.key },
      update: p,
      create: p,
    });
  }

  console.log("Seeded plans + addons (Plan table)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
