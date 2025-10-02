import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand.js';
import {
  ABOUT_LAYOUTS,
  DEFAULT_ABOUT_LAYOUT,
  normalizeAboutSettings,
} from '../data/aboutPage.js';

export default function About() {
  const { settings, loading } = useSettings();
  const aboutSettings = useMemo(() => normalizeAboutSettings(settings?.about ?? {}), [settings?.about]);
  const layoutConfig = useMemo(() => {
    const found = ABOUT_LAYOUTS.find(item => item.id === aboutSettings.layout);
    if (found) return found;
    return ABOUT_LAYOUTS.find(item => item.id === DEFAULT_ABOUT_LAYOUT) ?? ABOUT_LAYOUTS[0];
  }, [aboutSettings.layout]);

  return (
    <section
      className={`about-page container py-3 px-3 px-sm-4 about-layout-${layoutConfig.id}`}
      aria-busy={loading}
    >
      {renderLayout(layoutConfig.id, aboutSettings.content)}
    </section>
  );
}

function renderLayout(layoutId, content) {
  switch (layoutId) {
    case 'team-grid':
      return <TeamGridLayout content={content} />;
    case 'timeline':
      return <TimelineLayout content={content} />;
    case 'story-highlight':
    default:
      return <StoryHighlightLayout content={content} />;
  }
}

function StoryHighlightLayout({ content }) {
  return (
    <div className="about-layout about-layout--story">
      <HeroSection hero={content.hero} />
      <div className="row g-4 align-items-start">
        <div className="col-12 col-lg-8">
          <StorySection story={content.story} />
          <PillarsSection pillars={content.pillars} />
          <FaqSection faq={content.faq} />
        </div>
        <aside className="col-12 col-lg-4">
          <SidebarSection sidebar={content.sidebar} />
        </aside>
      </div>
      <CtaSection cta={content.cta} />
    </div>
  );
}

function TeamGridLayout({ content }) {
  return (
    <div className="about-layout about-layout--team">
      <HeroSection hero={content.hero} />
      <MissionSection mission={content.mission} />
      <TeamSection team={content.team} />
      <StatsSection stats={content.stats} />
      <ImpactSection impact={content.impact} />
      <CtaSection cta={content.cta} />
      <FaqSection faq={content.faq} />
    </div>
  );
}

function TimelineLayout({ content }) {
  return (
    <div className="about-layout about-layout--timeline">
      <HeroSection hero={content.hero} />
      <div className="row g-4 align-items-start">
        <div className="col-12 col-lg-7">
          <TimelineSection timeline={content.timeline} />
        </div>
        <div className="col-12 col-lg-5">
          <ImpactSection impact={content.impact} />
          <StatsSection stats={content.stats} variant="stacked" />
        </div>
      </div>
      <StorySection story={content.story} />
      <CtaSection cta={content.cta} />
      <FaqSection faq={content.faq} />
    </div>
  );
}

function HeroSection({ hero }) {
  const eyebrow = hero?.eyebrow?.trim();
  const headline = hero?.headline?.trim() || `About ${BRAND_NAME}`;
  const body = hero?.body?.trim() || BRAND_TAGLINE;
  const image = hero?.image?.trim();

  return (
    <header className={`about-hero card border-0 shadow-sm mb-4 ${image ? 'about-hero--with-image' : ''}`}>
      <div className="row g-0 align-items-stretch">
        <div className={`col-12 ${image ? 'col-lg-7' : ''}`}>
          <div className="p-4 p-lg-5">
            {eyebrow && <p className="text-uppercase text-primary fw-semibold small mb-2">{eyebrow}</p>}
            <h1 className="display-6 mb-3">{headline}</h1>
            <p className="lead mb-0 text-muted">{body}</p>
          </div>
        </div>
        {image && (
          <div className="col-12 col-lg-5">
            <div className="about-hero__image-wrapper h-100">
              <img src={image} alt={headline} className="about-hero__image" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function StorySection({ story }) {
  if (!story) return null;
  const heading = story.heading?.trim();
  const paragraphs = Array.isArray(story.paragraphs) ? story.paragraphs.filter(Boolean) : [];
  if (!heading && paragraphs.length === 0) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-story">
      <div className="card-body p-4">
        {heading && <h2 id="about-story" className="h5 mb-3">{heading}</h2>}
        {paragraphs.map((text, index) => (
          <p key={`story-${index}`} className={index === paragraphs.length - 1 ? 'mb-0' : 'mb-3'}>
            {text}
          </p>
        ))}
      </div>
    </section>
  );
}

function PillarsSection({ pillars = [] }) {
  if (!pillars.length) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-pillars">
      <div className="card-body p-4">
        <h2 id="about-pillars" className="h5 mb-3">What keeps us grounded</h2>
        <div className="row g-3">
          {pillars.map((pillar, index) => (
            <div className="col-12 col-md-6" key={pillar.title || `pillar-${index}`}>
              <div className="about-pillars__item">
                {pillar.title && <h3 className="h6 mb-2">{pillar.title}</h3>}
                {pillar.description && <p className="small text-muted mb-0">{pillar.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ faq = [] }) {
  if (!faq.length) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-faq">
      <div className="card-body p-4">
        <h2 id="about-faq" className="h5 mb-3">Frequently asked</h2>
        <div className="vstack gap-2">
          {faq.map((entry, index) => {
            if (!entry?.question || !entry?.answer) return null;
            return (
              <details key={entry.question || `faq-${index}`}>
                <summary className="fw-semibold">{entry.question}</summary>
                <p className="small text-muted mb-0 mt-1">{entry.answer}</p>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SidebarSection({ sidebar }) {
  if (!sidebar) return null;
  const heading = sidebar.heading?.trim();
  const bullets = Array.isArray(sidebar.bullets) ? sidebar.bullets.filter(Boolean) : [];
  const contact = sidebar.contactCta;

  if (!heading && bullets.length === 0 && !contact?.label) return null;

  return (
    <aside className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-sidebar">
      <div className="card-body p-4">
        {heading && <h2 id="about-sidebar" className="h6 text-uppercase text-muted mb-3">{heading}</h2>}
        {bullets.length > 0 && (
          <ul className="small ps-3 mb-3">
            {bullets.map((item, index) => (
              <li key={item || `sidebar-${index}`} className="mb-1">{item}</li>
            ))}
          </ul>
        )}
        {contact?.label && contact?.href && (
          <a className="btn btn-outline-primary btn-sm" href={contact.href}>{contact.label}</a>
        )}
      </div>
    </aside>
  );
}

function MissionSection({ mission }) {
  if (!mission) return null;
  const headline = mission.headline?.trim();
  const body = mission.body?.trim();
  if (!headline && !body) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-mission">
      <div className="card-body p-4">
        {headline && <h2 id="about-mission" className="h4 mb-3">{headline}</h2>}
        {body && <p className="mb-0">{body}</p>}
      </div>
    </section>
  );
}

function TeamSection({ team = [] }) {
  const filtered = team.filter(member => member?.name || member?.role || member?.bio);
  if (!filtered.length) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-team">
      <div className="card-body p-4">
        <h2 id="about-team" className="h5 mb-3">Meet the crew</h2>
        <div className="row g-3">
          {filtered.map((member, index) => (
            <div className="col-12 col-md-6 col-lg-4" key={member.name || `team-${index}`}>
              <div className="about-team__member h-100">
                <Avatar name={member.name} avatar={member.avatar} />
                <div className="about-team__body">
                  {member.name && <h3 className="h6 mb-1">{member.name}</h3>}
                  {member.role && <p className="text-primary small mb-2">{member.role}</p>}
                  {member.bio && <p className="small text-muted mb-0">{member.bio}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Avatar({ name, avatar }) {
  if (avatar) {
    return <img src={avatar} alt={name || ''} className="about-team__avatar" />;
  }

  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('')
    : 'SM';

  return (
    <div className="about-team__avatar about-team__avatar--initials" aria-hidden="true">
      {initials || 'SM'}
    </div>
  );
}

function StatsSection({ stats = [], variant = 'grid' }) {
  const filtered = stats.filter(stat => stat?.label && stat?.value);
  if (!filtered.length) return null;

  const layoutClass = variant === 'stacked' ? 'about-stats about-stats--stacked' : 'about-stats';

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-stats">
      <div className="card-body p-4">
        <h2 id="about-stats" className="h6 text-uppercase text-muted mb-3">By the numbers</h2>
        <div className={layoutClass}>
          {filtered.map((stat, index) => (
            <div className="about-stats__item" key={stat.label || `stat-${index}`}>
              <span className="about-stats__value">{stat.value}</span>
              <span className="about-stats__label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineSection({ timeline = [] }) {
  const filtered = timeline.filter(item => item?.year && (item?.title || item?.description));
  if (!filtered.length) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-timeline">
      <div className="card-body p-4">
        <h2 id="about-timeline" className="h5 mb-3">Our journey</h2>
        <ol className="about-timeline">
          {filtered.map((item, index) => (
            <li key={`${item.year}-${index}`} className="about-timeline__item">
              <div className="about-timeline__year">{item.year}</div>
              <div className="about-timeline__content">
                {item.title && <h3 className="h6 mb-1">{item.title}</h3>}
                {item.description && <p className="small text-muted mb-0">{item.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ImpactSection({ impact }) {
  if (!impact) return null;
  const heading = impact.heading?.trim();
  const highlights = Array.isArray(impact.highlights) ? impact.highlights.filter(item => item?.label || item?.description) : [];
  if (!heading && highlights.length === 0) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4" aria-labelledby="about-impact">
      <div className="card-body p-4">
        {heading && <h2 id="about-impact" className="h5 mb-3">{heading}</h2>}
        {highlights.length > 0 && (
          <div className="about-impact__grid">
            {highlights.map((item, index) => (
              <div className="about-impact__item" key={item.label || `impact-${index}`}>
                {item.label && <p className="fw-semibold mb-1">{item.label}</p>}
                {item.description && <p className="small text-muted mb-0">{item.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CtaSection({ cta }) {
  if (!cta) return null;
  const heading = cta.heading?.trim();
  const body = cta.body?.trim();
  const primary = cta.primary?.label && cta.primary?.href ? cta.primary : null;
  const secondary = cta.secondary?.label && cta.secondary?.href ? cta.secondary : null;

  if (!heading && !body && !primary && !secondary) return null;

  return (
    <section className="about-card card border-0 shadow-sm mb-4 about-cta" aria-labelledby="about-cta">
      <div className="card-body p-4 p-lg-5 text-center text-lg-start">
        {heading && <h2 id="about-cta" className="h4 mb-3">{heading}</h2>}
        {body && <p className="mb-4 text-muted">{body}</p>}
        <div className="d-flex flex-column flex-lg-row gap-2">
          {primary && <ButtonLink action={primary} variant="primary" />}
          {secondary && <ButtonLink action={secondary} variant="ghost" />}
        </div>
      </div>
    </section>
  );
}

function ButtonLink({ action, variant }) {
  if (!action?.href || !action?.label) return null;
  const href = typeof action.href === 'string' ? action.href : String(action.href);
  const isExternal = /^https?:/i.test(href);
  const className = variant === 'primary'
    ? 'btn btn-primary'
    : 'btn btn-outline-primary';
  return (
    <a className={className} href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
      {action.label}
    </a>
  );
}
