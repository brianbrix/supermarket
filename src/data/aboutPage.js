export const DEFAULT_ABOUT_LAYOUT = 'story-highlight';

export const ABOUT_LAYOUTS = [
  {
    id: 'story-highlight',
    title: 'Story Highlight',
    description: 'Hero introduction with story, value pillars, and FAQ sidebar.',
    sections: ['hero', 'story', 'pillars', 'faq', 'sidebar'],
  },
  {
    id: 'team-grid',
    title: 'Team Grid',
    description: 'Hero with mission statement, grid of team bios, and company stats.',
    sections: ['hero', 'mission', 'team', 'stats', 'cta'],
  },
  {
    id: 'timeline',
    title: 'Journey Timeline',
    description: 'Hero with milestones timeline and customer impact highlights.',
    sections: ['hero', 'timeline', 'impact', 'cta'],
  },
];

export const ABOUT_LAYOUT_IDS = new Set(ABOUT_LAYOUTS.map(layout => layout.id));

export function normalizeAboutLayout(value) {
  if (!value) return DEFAULT_ABOUT_LAYOUT;
  const normalized = String(value).trim().toLowerCase();
  return ABOUT_LAYOUT_IDS.has(normalized) ? normalized : DEFAULT_ABOUT_LAYOUT;
}

const defaultHero = {
  eyebrow: 'Our Promise',
  headline: 'Fresh groceries, fair prices, friendly faces',
  body: 'We built this marketplace to make everyday shopping faster, clearer, and kinder on your time. From produce to pantry, we re-stock daily and deliver delight.',
  image: '',
};

const defaultStory = {
  heading: 'How it started',
  paragraphs: [
    'Supermarket began as a weekend delivery club for friends and family who were tired of weekend traffic and supermarket queues.',
    'Today we partner with trusted markets and millers to keep the essentials flowing—so you can focus on the meals and moments that matter.',
  ],
};

const defaultPillars = [
  {
    title: 'Fresh rotation',
    description: 'We work directly with market stalls to keep greens crisp, grains dry, and fruit sweet.',
    icon: 'basket',
  },
  {
    title: 'Fair pricing',
    description: 'Shelf prices include VAT. No surprises. We share transparent sourcing and seasonal shifts.',
    icon: 'tags',
  },
  {
    title: 'Careful handling',
    description: 'Orders are hand-packed with insulated liners and labelled so you know what arrived when.',
    icon: 'heart',
  },
];

const defaultFaq = [
  {
    question: 'Are the products real?',
    answer: 'This environment is a demo that mirrors the experience. The assortment is based on real household staples.',
  },
  {
    question: 'Do you deliver everywhere?',
    answer: 'We are piloting with specific estates in Nairobi and expanding in phases. Check the delivery guide for coverage.',
  },
  {
    question: 'How do payments work?',
    answer: 'We integrate with mobile money and cards. During demos we simulate this step with test confirmations only.',
  },
];

const defaultSidebar = {
  heading: 'Quick facts',
  bullets: [
    'Nairobi-grown venture backed by local producers',
    'Mobile-first experience for any smartphone',
    'Free returns on delivery day if something is off',
  ],
  contactCta: {
    label: 'Contact support',
    href: 'mailto:hello@supermarket.co.ke',
  },
};

const defaultMission = {
  headline: 'Our mission',
  body: 'We unlock time for households and small businesses by pairing reliable supply with human service. We believe digital convenience can still feel personal.',
};

const defaultTeam = [
  {
    name: 'Lina Wanjiku',
    role: 'Head of Fresh Supply',
    bio: 'Keeps the morning deliveries crisp by coordinating with Gikomba market at dawn.',
    avatar: '',
  },
  {
    name: 'Brian Otieno',
    role: 'Customer Delight Lead',
    bio: 'If you chat with us on WhatsApp, chances are Brian is already on it.',
    avatar: '',
  },
  {
    name: 'Neema Kariuki',
    role: 'Logistics & Routes',
    bio: 'Maps the optimal route so orders arrive fresh even on rainy days.',
    avatar: '',
  },
];

const defaultStats = [
  { label: 'Orders fulfilled', value: '12k+' },
  { label: 'Partner vendors', value: '58' },
  { label: 'Delivery estates', value: '24' },
  { label: 'Customer rating', value: '4.8/5' },
];

const defaultTimeline = [
  {
    year: '2021',
    title: 'Weekend pilot',
    description: 'Started delivering farm-fresh baskets to friends and neighbours every Saturday.',
  },
  {
    year: '2022',
    title: 'Vendor network',
    description: 'Signed long-term supply agreements with trusted stalls and millers.',
  },
  {
    year: '2023',
    title: 'Digital launch',
    description: 'Released the first version of the marketplace with live inventory tracking.',
  },
  {
    year: '2024',
    title: 'Same-day delivery',
    description: 'Expanded to multiple estates with dedicated cold-chain partners.',
  },
];

const defaultImpact = {
  heading: 'Impact so far',
  highlights: [
    {
      label: 'Households served',
      description: '5,400 families now rely on weekly deliveries for key staples.',
    },
    {
      label: 'Food saved',
      description: '18 tonnes of produce rescued from waste via route optimization.',
    },
    {
      label: 'Vendors empowered',
      description: '30+ market traders now benefit from predictable demand and fair pricing.',
    },
  ],
};

const defaultCta = {
  heading: 'Partner with us',
  body: 'We collaborate with farmers, millers, and delivery riders to keep supply resilient. Let’s grow together.',
  primary: {
    label: 'Join as a vendor',
    href: '/partners',
  },
  secondary: {
    label: 'See careers',
    href: '/careers',
  },
};

export const DEFAULT_ABOUT_CONTENT = {
  hero: defaultHero,
  story: defaultStory,
  pillars: defaultPillars,
  faq: defaultFaq,
  sidebar: defaultSidebar,
  mission: defaultMission,
  team: defaultTeam,
  stats: defaultStats,
  timeline: defaultTimeline,
  impact: defaultImpact,
  cta: defaultCta,
};

function cloneHero(value) {
  if (!value || typeof value !== 'object') return { ...defaultHero };
  return {
    eyebrow: safeString(value.eyebrow, defaultHero.eyebrow),
    headline: safeString(value.headline, defaultHero.headline),
    body: safeString(value.body, defaultHero.body),
    image: safeString(value.image, defaultHero.image),
  };
}

function cloneStory(value) {
  if (!value || typeof value !== 'object') return { ...defaultStory };
  const paragraphs = Array.isArray(value.paragraphs)
    ? value.paragraphs.map(par => safeString(par)).filter(Boolean)
    : defaultStory.paragraphs;
  return {
    heading: safeString(value.heading, defaultStory.heading),
    paragraphs: paragraphs.length > 0 ? paragraphs : [...defaultStory.paragraphs],
  };
}

function clonePillars(value) {
  if (!Array.isArray(value)) return [...defaultPillars];
  return value.map(item => ({
    title: safeString(item?.title),
    description: safeString(item?.description),
    icon: safeString(item?.icon, 'sparkle'),
  })).filter(item => item.title || item.description);
}

function cloneFaq(value) {
  if (!Array.isArray(value)) return [...defaultFaq];
  return value.map(item => ({
    question: safeString(item?.question),
    answer: safeString(item?.answer),
  })).filter(item => item.question && item.answer);
}

function cloneSidebar(value) {
  if (!value || typeof value !== 'object') return { ...defaultSidebar };
  const bullets = Array.isArray(value.bullets)
    ? value.bullets.map(text => safeString(text)).filter(Boolean)
    : defaultSidebar.bullets;
  const contactCta = value.contactCta && typeof value.contactCta === 'object'
    ? {
        label: safeString(value.contactCta.label, defaultSidebar.contactCta.label),
        href: safeString(value.contactCta.href, defaultSidebar.contactCta.href),
      }
    : { ...defaultSidebar.contactCta };
  return {
    heading: safeString(value.heading, defaultSidebar.heading),
    bullets: bullets.length > 0 ? bullets : [...defaultSidebar.bullets],
    contactCta,
  };
}

function cloneMission(value) {
  if (!value || typeof value !== 'object') return { ...defaultMission };
  return {
    headline: safeString(value.headline, defaultMission.headline),
    body: safeString(value.body, defaultMission.body),
  };
}

function cloneTeam(value) {
  if (!Array.isArray(value)) return [...defaultTeam];
  return value.map(member => ({
    name: safeString(member?.name),
    role: safeString(member?.role),
    bio: safeString(member?.bio),
    avatar: safeString(member?.avatar),
  })).filter(member => member.name || member.role || member.bio);
}

function cloneStats(value) {
  if (!Array.isArray(value)) return [...defaultStats];
  return value.map(stat => ({
    label: safeString(stat?.label),
    value: safeString(stat?.value),
  })).filter(stat => stat.label && stat.value);
}

function cloneTimeline(value) {
  if (!Array.isArray(value)) return [...defaultTimeline];
  return value.map(entry => ({
    year: safeString(entry?.year),
    title: safeString(entry?.title),
    description: safeString(entry?.description),
  })).filter(entry => entry.year && entry.title);
}

function cloneImpact(value) {
  if (!value || typeof value !== 'object') return { ...defaultImpact };
  const highlights = Array.isArray(value.highlights)
    ? value.highlights.map(item => ({
        label: safeString(item?.label),
        description: safeString(item?.description),
      })).filter(item => item.label || item.description)
    : defaultImpact.highlights;
  return {
    heading: safeString(value.heading, defaultImpact.heading),
    highlights: highlights.length > 0 ? highlights : [...defaultImpact.highlights],
  };
}

function cloneCta(value) {
  if (!value || typeof value !== 'object') return { ...defaultCta };
  const primary = value.primary && typeof value.primary === 'object'
    ? {
        label: safeString(value.primary.label, defaultCta.primary.label),
        href: safeString(value.primary.href, defaultCta.primary.href),
      }
    : { ...defaultCta.primary };
  const secondary = value.secondary && typeof value.secondary === 'object'
    ? {
        label: safeString(value.secondary.label, defaultCta.secondary.label),
        href: safeString(value.secondary.href, defaultCta.secondary.href),
      }
    : { ...defaultCta.secondary };
  return {
    heading: safeString(value.heading, defaultCta.heading),
    body: safeString(value.body, defaultCta.body),
    primary,
    secondary,
  };
}

function safeString(value, fallback = '') {
  if (value == null) return fallback;
  return String(value).trim();
}

export function normalizeAboutContent(value = {}) {
  const source = typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    hero: cloneHero(source.hero),
    story: cloneStory(source.story),
    pillars: clonePillars(source.pillars),
    faq: cloneFaq(source.faq),
    sidebar: cloneSidebar(source.sidebar),
    mission: cloneMission(source.mission),
    team: cloneTeam(source.team),
    stats: cloneStats(source.stats),
    timeline: cloneTimeline(source.timeline),
    impact: cloneImpact(source.impact),
    cta: cloneCta(source.cta),
  };
}

export function normalizeAboutSettings(value) {
  if (!value || typeof value !== 'object') {
    return {
      layout: DEFAULT_ABOUT_LAYOUT,
      content: normalizeAboutContent(DEFAULT_ABOUT_CONTENT),
    };
  }
  return {
    layout: normalizeAboutLayout(value.layout),
    content: normalizeAboutContent(value.content),
  };
}

export function mergeAboutContent(baseContent, overrides) {
  const normalizedBase = normalizeAboutContent(baseContent);
  const normalizedOverrides = normalizeAboutContent(overrides);
  return normalizeAboutContent({
    hero: { ...normalizedBase.hero, ...normalizedOverrides.hero },
    story: {
      heading: normalizedOverrides.story.heading || normalizedBase.story.heading,
      paragraphs: normalizedOverrides.story.paragraphs.length > 0 ? normalizedOverrides.story.paragraphs : normalizedBase.story.paragraphs,
    },
    pillars: normalizedOverrides.pillars.length > 0 ? normalizedOverrides.pillars : normalizedBase.pillars,
    faq: normalizedOverrides.faq.length > 0 ? normalizedOverrides.faq : normalizedBase.faq,
    sidebar: {
      ...normalizedBase.sidebar,
      ...normalizedOverrides.sidebar,
      bullets: normalizedOverrides.sidebar.bullets.length > 0 ? normalizedOverrides.sidebar.bullets : normalizedBase.sidebar.bullets,
      contactCta: {
        ...normalizedBase.sidebar.contactCta,
        ...normalizedOverrides.sidebar.contactCta,
      },
    },
    mission: {
      ...normalizedBase.mission,
      ...normalizedOverrides.mission,
    },
    team: normalizedOverrides.team.length > 0 ? normalizedOverrides.team : normalizedBase.team,
    stats: normalizedOverrides.stats.length > 0 ? normalizedOverrides.stats : normalizedBase.stats,
    timeline: normalizedOverrides.timeline.length > 0 ? normalizedOverrides.timeline : normalizedBase.timeline,
    impact: {
      ...normalizedBase.impact,
      ...normalizedOverrides.impact,
      highlights: normalizedOverrides.impact.highlights.length > 0 ? normalizedOverrides.impact.highlights : normalizedBase.impact.highlights,
    },
    cta: {
      ...normalizedBase.cta,
      ...normalizedOverrides.cta,
      primary: {
        ...normalizedBase.cta.primary,
        ...normalizedOverrides.cta.primary,
      },
      secondary: {
        ...normalizedBase.cta.secondary,
        ...normalizedOverrides.cta.secondary,
      },
    },
  });
}
