import { normalizeContact, dateValue, DAY } from "../shared/domain.js";
import { prepareWorkspaceImport } from "../shared/import-plan.js";

export function mergeDemoImport(current, payload) {
  const plan = prepareWorkspaceImport(
    current.contacts,
    current.settings,
    payload,
  );
  const keepExisting = (existing, incoming) => {
    const records = new Map(existing.map((row) => [row.id, row]));
    for (const row of incoming)
      if (!records.has(row.id)) records.set(row.id, row);
    return [...records.values()];
  };
  return {
    added: plan.added,
    updated: plan.updated,
    idMap: plan.idMap,
    state: {
      ...current,
      contacts: plan.contacts,
      circles: keepExisting(current.circles, plan.circles),
      messages: keepExisting(current.messages, plan.messages).sort(
        (a, b) => dateValue(a.at) - dateValue(b.at),
      ),
      settings: plan.settings,
    },
  };
}

export function demoState() {
  const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
  const circles = [
    {
      id: "square",
      name: "Square crew",
      color: "green",
      memory:
        "We were on the seller experience team at Square, 2021-2023. Launch reviews, Friday demos, and making complex things simple.",
    },
    {
      id: "mentors",
      name: "People I learn from",
      color: "violet",
      memory:
        "Product leaders I've learned from. Stay curious and make space for what they are working on.",
    },
    {
      id: "school",
      name: "NYU friends",
      color: "blue",
      memory:
        "Our grad school cohort. Late nights in the library, early product ideas, and the first job search.",
    },
    {
      id: "community",
      name: "Product community",
      color: "rose",
      memory:
        "People from meetups and thoughtful conversations about building useful products.",
    },
  ];
  const people = [
    {
      id: "maya",
      name: "Maya Patel",
      role: "Senior Product Manager",
      company: "Stripe",
      circleIds: ["square"],
      memory:
        "We worked on seller onboarding experiments at Square. Maya made sense of the messy research findings.",
      reason:
        "You noted that Maya started a new role. A good moment to catch up.",
      lastContactAt: ago(94),
      favorite: true,
      cadence: 60,
    },
    {
      id: "ari",
      name: "Ari Kim",
      role: "Engineering Manager",
      company: "Block",
      circleIds: ["square"],
      memory:
        "We shipped the checkout reliability project together. Our launch reviews were always honest and useful.",
      lastContactAt: ago(76),
      favorite: true,
      cadence: 60,
    },
    {
      id: "jordan",
      name: "Jordan Lee",
      role: "Design Director",
      company: "Figma",
      circleIds: ["mentors", "community"],
      memory:
        "Jordan helped me prepare for a product strategy presentation last year.",
      lastContactAt: ago(123),
      cadence: 90,
    },
    {
      id: "sam",
      name: "Sam Rivera",
      role: "Data Scientist",
      company: "Square",
      circleIds: ["square"],
      memory: "Sam and I paired on the first seller retention dashboard.",
      lastContactAt: ago(4),
      needsReply: true,
      latestMessageAt: ago(0.2),
      cadence: 60,
      reminderAt: ago(-1),
    },
    {
      id: "nina",
      name: "Nina Garcia",
      role: "Talent Partner",
      company: "Notion",
      circleIds: ["community"],
      memory:
        "We met at a product meetup. Both interested in smaller product teams.",
      lastContactAt: ago(2),
      needsReply: true,
      latestMessageAt: ago(0.6),
      cadence: 90,
    },
    {
      id: "alex",
      name: "Alex Chen",
      role: "Product Manager",
      company: "Spotify",
      circleIds: ["school"],
      memory:
        "Our study group teammate. We built a small music discovery prototype in class.",
      lastContactAt: ago(32),
      cadence: 60,
    },
    {
      id: "priya",
      name: "Priya Shah",
      role: "Founder",
      company: "Daybreak",
      circleIds: ["school", "community"],
      memory: "We met in the NYU product club and swap notes on building.",
      lastContactAt: ago(18),
      cadence: 30,
    },
    {
      id: "marcus",
      name: "Marcus Wilson",
      role: "Staff Product Designer",
      company: "Square",
      circleIds: ["square"],
      memory:
        "We worked on the seller dashboard. He always asked the question the room was avoiding.",
      lastContactAt: ago(51),
      cadence: 60,
    },
    {
      id: "elena",
      name: "Elena Park",
      role: "VP of Product",
      company: "Ramp",
      circleIds: ["mentors"],
      memory:
        "A former manager who helped me get more precise about product bets.",
      lastContactAt: ago(41),
      cadence: 60,
      favorite: true,
    },
    {
      id: "daniel",
      name: "Daniel Brooks",
      role: "Product Lead",
      company: "Linear",
      circleIds: ["community"],
      memory: "Met at a small product dinner. Talked about quality and scope.",
      lastContactAt: ago(8),
      cadence: 90,
    },
  ];
  const contacts = people.map((p) =>
    normalizeContact({ ...p, source: "demo", createdAt: ago(150) }),
  );
  const messages = [
    {
      id: "sample1",
      contactId: "sam",
      text: "Hey Sam! I came across our old retention dashboard the other day. How have you been?",
      direction: "out",
      at: ago(4),
      source: "demo",
    },
    {
      id: "sample2",
      contactId: "sam",
      text: "Amit! So good to hear from you. Things are good, just wrapped a big launch. Would love to grab coffee next week if you're around?",
      direction: "in",
      at: ago(0.2),
      source: "demo",
    },
    {
      id: "sample3",
      contactId: "nina",
      text: "It was great catching up at the meetup. I'd love to stay in touch!",
      direction: "out",
      at: ago(2),
      source: "demo",
    },
    {
      id: "sample4",
      contactId: "nina",
      text: "Likewise! I found that article we were talking about. Sending it over later today.",
      direction: "in",
      at: ago(0.6),
      source: "demo",
    },
  ];
  return {
    contacts,
    circles,
    messages,
    settings: {
      name: "Amit",
      weeklyGoal: 3,
      voice:
        "Short, friendly, and direct. I usually start with Hey and ask one question.",
      notifications: false,
    },
    connection: null,
    capabilities: { ai: false, linkedin: false, portability: false },
  };
}
