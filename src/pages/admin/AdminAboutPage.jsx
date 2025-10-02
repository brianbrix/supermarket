import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import AdminCollapsibleSection from '../../components/admin/AdminCollapsibleSection.jsx';
import {
  ABOUT_LAYOUTS,
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_ABOUT_LAYOUT,
  normalizeAboutContent,
  normalizeAboutLayout,
} from '../../data/aboutPage.js';

const LAYOUT_FEATURES = {
  'story-highlight': [
    'Long-form story with supporting pillars and FAQ sidebar',
    'Right-hand fact sheet for quick skim of the offer',
    'Great when telling your origin story or service pillars'
  ],
  'team-grid': [
    'Mission-first hero with supporting team grid',
    'Stats strip to showcase traction at a glance',
    'Call-to-action block designed to convert partnerships'
  ],
  timeline: [
    'Milestone timeline to narrate growth',
    'Impact highlights for social proof',
    'Stacks neatly on mobile with progressive disclosure'
  ],
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
}

const INITIAL_STATE = {
  layout: DEFAULT_ABOUT_LAYOUT,
  content: normalizeAboutContent(DEFAULT_ABOUT_CONTENT),
};

export default function AdminAboutPage() {
  const [layout, setLayout] = useState(DEFAULT_ABOUT_LAYOUT);
  const [content, setContent] = useState(() => normalizeAboutContent(DEFAULT_ABOUT_CONTENT));
  const [initialState, setInitialState] = useState(() => deepClone(INITIAL_STATE));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { push } = useToast();
  const { refresh } = useSettings();

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.admin.systemSettings.list()
      .then(settings => {
        if (!active) return;
        const entries = Array.isArray(settings) ? settings : [];
        const map = new Map(entries.map(entry => [entry?.key, entry?.value]));
        const jsonRaw = map.get('about.json') ?? map.get('about_config');
        const jsonParsed = parseJson(jsonRaw);
        const layoutRaw = map.get('about.layout') ?? jsonParsed?.layout;
        const contentRaw = map.get('about.content') ?? jsonParsed?.content;
        const parsedContent = jsonParsed?.content ?? parseJson(contentRaw) ?? contentRaw;
        const normalizedLayout = normalizeAboutLayout(layoutRaw);
        const normalizedContent = normalizeAboutContent(parsedContent ?? DEFAULT_ABOUT_CONTENT);
        setLayout(normalizedLayout);
        setContent(normalizedContent);
        setInitialState({
          layout: normalizedLayout,
          content: deepClone(normalizedContent),
        });
        setError(null);
      })
      .catch(err => {
        if (!active) return;
        setError(err?.message || 'Failed to load About page settings');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const normalizedCurrent = useMemo(() => ({
    layout: normalizeAboutLayout(layout),
    content: normalizeAboutContent(content),
  }), [layout, content]);

  const isDirty = useMemo(() => {
    const currentJson = JSON.stringify(normalizedCurrent);
    const initialJson = JSON.stringify({
      layout: normalizeAboutLayout(initialState.layout),
      content: normalizeAboutContent(initialState.content),
    });
    return currentJson !== initialJson;
  }, [normalizedCurrent, initialState]);

  const handleReset = useCallback(() => {
    setLayout(normalizeAboutLayout(initialState.layout));
    setContent(deepClone(normalizeAboutContent(initialState.content)));
  }, [initialState]);

  const handleSave = useCallback(() => {
    if (saving || !isDirty) return;
    setSaving(true);
    setError(null);
    const normalizedLayout = normalizeAboutLayout(layout);
    const normalizedContent = normalizeAboutContent(content);
    const payload = [
      {
        key: 'about.layout',
        type: 'string',
        value: normalizedLayout,
      },
      {
        key: 'about.content',
        type: 'string',
        value: JSON.stringify(normalizedContent),
      },
      {
        key: 'about.json',
        type: 'string',
        value: JSON.stringify({ layout: normalizedLayout, content: normalizedContent }),
      },
    ];
    api.admin.systemSettings.save(payload)
      .then(() => {
        setInitialState({
          layout: normalizedLayout,
          content: deepClone(normalizedContent),
        });
        setContent(normalizedContent);
        push('About page settings updated successfully.', 'success');
        refresh?.();
      })
      .catch(err => {
        const message = err?.message || 'Failed to save About page settings';
        setError(message);
        push(message, 'danger');
      })
      .finally(() => {
        setSaving(false);
      });
  }, [content, layout, push, refresh, saving, isDirty]);

  const updateHeroField = useCallback((field, value) => {
    setContent(prev => ({
      ...prev,
      hero: {
        ...(prev.hero ?? {}),
        [field]: value,
      },
    }));
  }, []);

  const updateStoryField = useCallback((field, value) => {
    if (field === 'paragraphs') {
      const paragraphs = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      setContent(prev => ({
        ...prev,
        story: {
          ...(prev.story ?? {}),
          paragraphs,
        },
      }));
      return;
    }
    setContent(prev => ({
      ...prev,
      story: {
        ...(prev.story ?? {}),
        [field]: value,
      },
    }));
  }, []);

  const updateMissionField = useCallback((field, value) => {
    setContent(prev => ({
      ...prev,
      mission: {
        ...(prev.mission ?? {}),
        [field]: value,
      },
    }));
  }, []);

  const updateSidebarField = useCallback((field, value) => {
    if (field === 'bullets') {
      const bullets = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      setContent(prev => ({
        ...prev,
        sidebar: {
          ...(prev.sidebar ?? {}),
          bullets,
          contactCta: prev.sidebar?.contactCta ?? { label: '', href: '' },
        },
      }));
      return;
    }
    if (field.startsWith('contact.')) {
      const [, target] = field.split('.');
      setContent(prev => ({
        ...prev,
        sidebar: {
          ...(prev.sidebar ?? {}),
          contactCta: {
            ...(prev.sidebar?.contactCta ?? {}),
            [target]: value,
          },
          bullets: prev.sidebar?.bullets ?? [],
        },
      }));
      return;
    }
    setContent(prev => ({
      ...prev,
      sidebar: {
        ...(prev.sidebar ?? {}),
        [field]: value,
        bullets: prev.sidebar?.bullets ?? [],
        contactCta: prev.sidebar?.contactCta ?? { label: '', href: '' },
      },
    }));
  }, []);

  const addListItem = useCallback((section, factory) => {
    setContent(prev => ({
      ...prev,
      [section]: [...(Array.isArray(prev[section]) ? prev[section] : []), factory()],
    }));
  }, []);

  const updateListItem = useCallback((section, index, field, value) => {
    setContent(prev => {
      const list = Array.isArray(prev[section]) ? [...prev[section]] : [];
      const existing = list[index] ?? {};
      list[index] = { ...existing, [field]: value };
      return {
        ...prev,
        [section]: list,
      };
    });
  }, []);

  const removeListItem = useCallback((section, index) => {
    setContent(prev => ({
      ...prev,
      [section]: Array.isArray(prev[section])
        ? prev[section].filter((_, idx) => idx !== index)
        : [],
    }));
  }, []);

  const updateImpactField = useCallback((field, value) => {
    if (field === 'highlights') {
      return;
    }
    setContent(prev => ({
      ...prev,
      impact: {
        ...(prev.impact ?? {}),
        [field]: value,
        highlights: prev.impact?.highlights ?? [],
      },
    }));
  }, []);

  const addImpactHighlight = useCallback(() => {
    setContent(prev => ({
      ...prev,
      impact: {
        ...(prev.impact ?? { heading: '', highlights: [] }),
        highlights: [
          ...(Array.isArray(prev.impact?.highlights) ? prev.impact.highlights : []),
          { label: '', description: '' },
        ],
      },
    }));
  }, []);

  const updateImpactHighlight = useCallback((index, field, value) => {
    setContent(prev => {
      const highlights = Array.isArray(prev.impact?.highlights) ? [...prev.impact.highlights] : [];
      const existing = highlights[index] ?? {};
      highlights[index] = { ...existing, [field]: value };
      return {
        ...prev,
        impact: {
          ...(prev.impact ?? { heading: '', highlights: [] }),
          highlights,
        },
      };
    });
  }, []);

  const removeImpactHighlight = useCallback((index) => {
    setContent(prev => ({
      ...prev,
      impact: {
        ...(prev.impact ?? { heading: '', highlights: [] }),
        highlights: Array.isArray(prev.impact?.highlights)
          ? prev.impact.highlights.filter((_, idx) => idx !== index)
          : [],
      },
    }));
  }, []);

  const updateFaqItem = useCallback((index, field, value) => {
    updateListItem('faq', index, field, value);
  }, [updateListItem]);

  const updateTeamItem = useCallback((index, field, value) => {
    updateListItem('team', index, field, value);
  }, [updateListItem]);

  const updateStatItem = useCallback((index, field, value) => {
    updateListItem('stats', index, field, value);
  }, [updateListItem]);

  const updateTimelineItem = useCallback((index, field, value) => {
    updateListItem('timeline', index, field, value);
  }, [updateListItem]);

  const updateCtaField = useCallback((field, value) => {
    if (field === 'primary' || field === 'secondary') {
      return;
    }
    setContent(prev => ({
      ...prev,
      cta: {
        ...(prev.cta ?? { heading: '', body: '', primary: { label: '', href: '' }, secondary: { label: '', href: '' } }),
        [field]: value,
        primary: prev.cta?.primary ?? { label: '', href: '' },
        secondary: prev.cta?.secondary ?? { label: '', href: '' },
      },
    }));
  }, []);

  const updateCtaAction = useCallback((action, field, value) => {
    setContent(prev => ({
      ...prev,
      cta: {
        ...(prev.cta ?? { heading: '', body: '', primary: { label: '', href: '' }, secondary: { label: '', href: '' } }),
        primary: {
          ...(prev.cta?.primary ?? { label: '', href: '' }),
          ...(action === 'primary' ? { [field]: value } : {}),
        },
        secondary: {
          ...(prev.cta?.secondary ?? { label: '', href: '' }),
          ...(action === 'secondary' ? { [field]: value } : {}),
        },
        heading: prev.cta?.heading ?? '',
        body: prev.cta?.body ?? '',
      },
    }));
  }, []);

  const selectedLayout = useMemo(() => (
    ABOUT_LAYOUTS.find(item => item.id === normalizedCurrent.layout) ?? ABOUT_LAYOUTS.find(item => item.id === DEFAULT_ABOUT_LAYOUT) ?? ABOUT_LAYOUTS[0]
  ), [normalizedCurrent.layout]);

  const storyParagraphsValue = (content.story?.paragraphs ?? []).join('\n');
  const sidebarBulletsValue = (content.sidebar?.bullets ?? []).join('\n');

  return (
    <section className="container-fluid py-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
        <div>
          <h1 className="h4 mb-1">About Page</h1>
          <p className="text-muted mb-0">Curate the narrative, team highlights, and timeline that appears on the public About page.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={handleReset} disabled={loading || saving || !isDirty}>
            Reset
          </button>
          <button type="button" className="btn btn-success" onClick={handleSave} disabled={loading || saving || !isDirty}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving…
              </>
            ) : 'Save changes'}
          </button>
        </div>
      </div>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="d-flex align-items-center gap-3 text-muted">
          <span className="spinner-border" role="status" aria-hidden="true"></span>
          <span>Loading About page settings…</span>
        </div>
      ) : (
        <>
          <section className="mb-5">
            <h2 className="h5 mb-3">Layout selection</h2>
            <div className="row g-4">
              {ABOUT_LAYOUTS.map(option => {
                const isActive = option.id === normalizedCurrent.layout;
                const features = LAYOUT_FEATURES[option.id] ?? option.sections ?? [];
                return (
                  <div className="col-12 col-xl-4" key={option.id}>
                    <div className={`card h-100 shadow-sm border${isActive ? ' border-success border-2' : ''}`}>
                      <div className="card-body d-flex flex-column gap-3">
                        <div className="d-flex justify-content-between gap-2 align-items-start">
                          <div>
                            <h3 className="h6 mb-1">{option.title}</h3>
                            <p className="text-muted small mb-0">{option.description}</p>
                          </div>
                          {isActive && <span className="badge text-bg-success">Active</span>}
                        </div>
                        <div className="bg-body-secondary bg-opacity-25 rounded-3 p-3 border border-dashed">
                          <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                            {features.map(feature => (
                              <li key={`${option.id}-${feature}`} className="d-flex align-items-start gap-2">
                                <i className="bi bi-check-circle-fill text-success mt-1" aria-hidden="true"></i>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="card-footer bg-body-tertiary d-flex justify-content-between align-items-center">
                        <div className="form-check mb-0">
                          <input
                            className="form-check-input"
                            type="radio"
                            id={`about-layout-${option.id}`}
                            name="aboutLayout"
                            value={option.id}
                            checked={isActive}
                            onChange={() => setLayout(option.id)}
                          />
                          <label className="form-check-label" htmlFor={`about-layout-${option.id}`}>
                            Use this layout
                          </label>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setLayout(option.id)}
                          disabled={isActive}
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <AdminCollapsibleSection
            title="Hero & introduction"
            description="Set the hero message and key story opening copy."
            defaultOpen
            className="mb-5"
          >
            <div className="row g-4">
              <div className="col-12 col-lg-4">
                <label className="form-label small text-muted" htmlFor="hero-eyebrow">Eyebrow</label>
                <input
                  id="hero-eyebrow"
                  type="text"
                  className="form-control"
                  value={content.hero?.eyebrow ?? ''}
                  onChange={event => updateHeroField('eyebrow', event.target.value)}
                  placeholder="e.g. Our promise"
                />
              </div>
              <div className="col-12 col-lg-8">
                <label className="form-label small text-muted" htmlFor="hero-headline">Headline</label>
                <input
                  id="hero-headline"
                  type="text"
                  className="form-control"
                  value={content.hero?.headline ?? ''}
                  onChange={event => updateHeroField('headline', event.target.value)}
                  placeholder="Hero headline"
                />
              </div>
              <div className="col-12">
                <label className="form-label small text-muted" htmlFor="hero-body">Supporting copy</label>
                <textarea
                  id="hero-body"
                  className="form-control"
                  rows={3}
                  value={content.hero?.body ?? ''}
                  onChange={event => updateHeroField('body', event.target.value)}
                  placeholder="Short paragraph describing your mission"
                ></textarea>
                <div className="form-text small">Appears under the hero headline to set tone for the page.</div>
              </div>
              <div className="col-12 col-lg-6">
                <label className="form-label small text-muted" htmlFor="hero-image">Hero image URL</label>
                <input
                  id="hero-image"
                  type="url"
                  className="form-control"
                  value={content.hero?.image ?? ''}
                  onChange={event => updateHeroField('image', event.target.value)}
                  placeholder="https://…"
                />
                <div className="form-text small">Optional. Recommended 1600×900 landscape.</div>
              </div>
              <div className="col-12 col-lg-6">
                <label className="form-label small text-muted" htmlFor="story-heading">Story heading</label>
                <input
                  id="story-heading"
                  type="text"
                  className="form-control"
                  value={content.story?.heading ?? ''}
                  onChange={event => updateStoryField('heading', event.target.value)}
                  placeholder="How it started"
                />
                <div className="form-text small">Used in layouts that surface the long-form story block.</div>
              </div>
              <div className="col-12">
                <label className="form-label small text-muted" htmlFor="story-paragraphs">Story paragraphs</label>
                <textarea
                  id="story-paragraphs"
                  className="form-control"
                  rows={5}
                  value={storyParagraphsValue}
                  onChange={event => updateStoryField('paragraphs', event.target.value)}
                  placeholder="Write each paragraph on a new line"
                ></textarea>
                <div className="form-text small">Split paragraphs with a line break. Empty lines are ignored.</div>
              </div>
            </div>
          </AdminCollapsibleSection>

          <AdminCollapsibleSection
            title="Pillars & sidebar"
            description="Highlight service pillars, quick facts, and support contact."
            defaultOpen={selectedLayout.id === 'story-highlight'}
            rememberState
            className="mb-5"
            persistKey="about:pillars"
          >
            <div className="row g-4">
              <div className="col-12 col-lg-7">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h3 className="h6 mb-0">Pillars</h3>
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addListItem('pillars', () => ({ title: '', description: '', icon: '' }))}>
                    Add pillar
                  </button>
                </div>
                {(content.pillars ?? []).map((pillar, index) => (
                  <div key={`pillar-${index}`} className="card border border-dashed mb-3">
                    <div className="card-body p-3 d-grid gap-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <h4 className="h6 mb-0">Pillar {index + 1}</h4>
                        <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeListItem('pillars', index)}>
                          Remove
                        </button>
                      </div>
                      <div>
                        <label className="form-label small text-muted" htmlFor={`pillar-title-${index}`}>Title</label>
                        <input
                          id={`pillar-title-${index}`}
                          type="text"
                          className="form-control form-control-sm"
                          value={pillar?.title ?? ''}
                          onChange={event => updateListItem('pillars', index, 'title', event.target.value)}
                          placeholder="Fresh rotation"
                        />
                      </div>
                      <div>
                        <label className="form-label small text-muted" htmlFor={`pillar-description-${index}`}>Description</label>
                        <textarea
                          id={`pillar-description-${index}`}
                          className="form-control form-control-sm"
                          rows={3}
                          value={pillar?.description ?? ''}
                          onChange={event => updateListItem('pillars', index, 'description', event.target.value)}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                ))}
                {(!content.pillars || content.pillars.length === 0) && (
                  <div className="alert alert-secondary" role="status">
                    No pillars yet. Add a pillar to introduce your core values.
                  </div>
                )}
              </div>
              <div className="col-12 col-lg-5">
                <div className="card border border-dashed">
                  <div className="card-body p-3 d-grid gap-3">
                    <h3 className="h6 mb-0">Sidebar fact sheet</h3>
                    <div>
                      <label className="form-label small text-muted" htmlFor="sidebar-heading">Heading</label>
                      <input
                        id="sidebar-heading"
                        type="text"
                        className="form-control form-control-sm"
                        value={content.sidebar?.heading ?? ''}
                        onChange={event => updateSidebarField('heading', event.target.value)}
                        placeholder="Quick facts"
                      />
                    </div>
                    <div>
                      <label className="form-label small text-muted" htmlFor="sidebar-bullets">Bullets</label>
                      <textarea
                        id="sidebar-bullets"
                        className="form-control form-control-sm"
                        rows={6}
                        value={sidebarBulletsValue}
                        onChange={event => updateSidebarField('bullets', event.target.value)}
                        placeholder="Line per bullet"
                      ></textarea>
                    </div>
                    <div className="row g-3">
                      <div className="col-12 col-sm-6">
                        <label className="form-label small text-muted" htmlFor="sidebar-contact-label">Contact label</label>
                        <input
                          id="sidebar-contact-label"
                          type="text"
                          className="form-control form-control-sm"
                          value={content.sidebar?.contactCta?.label ?? ''}
                          onChange={event => updateSidebarField('contact.label', event.target.value)}
                          placeholder="Contact support"
                        />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label small text-muted" htmlFor="sidebar-contact-href">Contact href</label>
                        <input
                          id="sidebar-contact-href"
                          type="text"
                          className="form-control form-control-sm"
                          value={content.sidebar?.contactCta?.href ?? ''}
                          onChange={event => updateSidebarField('contact.href', event.target.value)}
                          placeholder="mailto:hello@example.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AdminCollapsibleSection>

          <AdminCollapsibleSection
            title="Mission, team & stats"
            description="Populate sections used by the Team Grid layout."
            defaultOpen={selectedLayout.id === 'team-grid'}
            rememberState
            className="mb-5"
            persistKey="about:team"
          >
            <div className="row g-4">
              <div className="col-12">
                <label className="form-label small text-muted" htmlFor="mission-headline">Mission headline</label>
                <input
                  id="mission-headline"
                  type="text"
                  className="form-control"
                  value={content.mission?.headline ?? ''}
                  onChange={event => updateMissionField('headline', event.target.value)}
                  placeholder="Our mission"
                />
              </div>
              <div className="col-12">
                <label className="form-label small text-muted" htmlFor="mission-body">Mission body</label>
                <textarea
                  id="mission-body"
                  className="form-control"
                  rows={3}
                  value={content.mission?.body ?? ''}
                  onChange={event => updateMissionField('body', event.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h6 mb-0">Team members</h3>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addListItem('team', () => ({ name: '', role: '', bio: '', avatar: '' }))}>
                  Add member
                </button>
              </div>
              {(content.team ?? []).map((member, index) => (
                <div key={`team-${index}`} className="card border border-dashed mb-3">
                  <div className="card-body p-3 d-grid gap-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <h4 className="h6 mb-0">Member {index + 1}</h4>
                      <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeListItem('team', index)}>
                        Remove
                      </button>
                    </div>
                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-muted" htmlFor={`team-name-${index}`}>Name</label>
                        <input
                          id={`team-name-${index}`}
                          type="text"
                          className="form-control form-control-sm"
                          value={member?.name ?? ''}
                          onChange={event => updateTeamItem(index, 'name', event.target.value)}
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-muted" htmlFor={`team-role-${index}`}>Role</label>
                        <input
                          id={`team-role-${index}`}
                          type="text"
                          className="form-control form-control-sm"
                          value={member?.role ?? ''}
                          onChange={event => updateTeamItem(index, 'role', event.target.value)}
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-muted" htmlFor={`team-avatar-${index}`}>Avatar URL</label>
                        <input
                          id={`team-avatar-${index}`}
                          type="text"
                          className="form-control form-control-sm"
                          value={member?.avatar ?? ''}
                          onChange={event => updateTeamItem(index, 'avatar', event.target.value)}
                          placeholder="https://…"
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small text-muted" htmlFor={`team-bio-${index}`}>Bio</label>
                        <textarea
                          id={`team-bio-${index}`}
                          className="form-control form-control-sm"
                          rows={3}
                          value={member?.bio ?? ''}
                          onChange={event => updateTeamItem(index, 'bio', event.target.value)}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!content.team || content.team.length === 0) && (
                <div className="alert alert-secondary" role="status">
                  No team members added yet.
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h6 mb-0">Stats</h3>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addListItem('stats', () => ({ label: '', value: '' }))}>
                  Add stat
                </button>
              </div>
              {(content.stats ?? []).map((stat, index) => (
                <div key={`stat-${index}`} className="row g-3 align-items-end mb-3">
                  <div className="col-12 col-md-5">
                    <label className="form-label small text-muted" htmlFor={`stat-label-${index}`}>Label</label>
                    <input
                      id={`stat-label-${index}`}
                      type="text"
                      className="form-control form-control-sm"
                      value={stat?.label ?? ''}
                      onChange={event => updateStatItem(index, 'label', event.target.value)}
                      placeholder="Orders fulfilled"
                    />
                  </div>
                  <div className="col-12 col-md-5">
                    <label className="form-label small text-muted" htmlFor={`stat-value-${index}`}>Value</label>
                    <input
                      id={`stat-value-${index}`}
                      type="text"
                      className="form-control form-control-sm"
                      value={stat?.value ?? ''}
                      onChange={event => updateStatItem(index, 'value', event.target.value)}
                      placeholder="12k+"
                    />
                  </div>
                  <div className="col-12 col-md-2 d-flex justify-content-md-end">
                    <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeListItem('stats', index)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {(!content.stats || content.stats.length === 0) && (
                <div className="alert alert-secondary" role="status">
                  No stats configured. Add stats to show traction numbers.
                </div>
              )}
            </div>
          </AdminCollapsibleSection>

          <AdminCollapsibleSection
            title="Timeline & impact"
            description="Configure milestones and impact highlights for the journey layout."
            defaultOpen={selectedLayout.id === 'timeline'}
            rememberState
            className="mb-5"
            persistKey="about:timeline"
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 mb-0">Timeline milestones</h3>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addListItem('timeline', () => ({ year: '', title: '', description: '' }))}>
                Add milestone
              </button>
            </div>
            {(content.timeline ?? []).map((item, index) => (
              <div key={`timeline-${index}`} className="card border border-dashed mb-3">
                <div className="card-body p-3 d-grid gap-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <h4 className="h6 mb-0">Milestone {index + 1}</h4>
                    <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeListItem('timeline', index)}>
                      Remove
                    </button>
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-md-3">
                      <label className="form-label small text-muted" htmlFor={`timeline-year-${index}`}>Year</label>
                      <input
                        id={`timeline-year-${index}`}
                        type="text"
                        className="form-control form-control-sm"
                        value={item?.year ?? ''}
                        onChange={event => updateTimelineItem(index, 'year', event.target.value)}
                        placeholder="2024"
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small text-muted" htmlFor={`timeline-title-${index}`}>Title</label>
                      <input
                        id={`timeline-title-${index}`}
                        type="text"
                        className="form-control form-control-sm"
                        value={item?.title ?? ''}
                        onChange={event => updateTimelineItem(index, 'title', event.target.value)}
                        placeholder="Same-day delivery"
                      />
                    </div>
                    <div className="col-12 col-md-5">
                      <label className="form-label small text-muted" htmlFor={`timeline-description-${index}`}>Description</label>
                      <textarea
                        id={`timeline-description-${index}`}
                        className="form-control form-control-sm"
                        rows={2}
                        value={item?.description ?? ''}
                        onChange={event => updateTimelineItem(index, 'description', event.target.value)}
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!content.timeline || content.timeline.length === 0) && (
              <div className="alert alert-secondary" role="status">
                Timeline milestones help narrate your growth stages.
              </div>
            )}
            <div className="mt-4 card border border-dashed">
              <div className="card-body p-3 d-grid gap-3">
                <h3 className="h6 mb-0">Impact highlights</h3>
                <div>
                  <label className="form-label small text-muted" htmlFor="impact-heading">Heading</label>
                  <input
                    id="impact-heading"
                    type="text"
                    className="form-control form-control-sm"
                    value={content.impact?.heading ?? ''}
                    onChange={event => updateImpactField('heading', event.target.value)}
                    placeholder="Impact so far"
                  />
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="h6 mb-0">Highlights</h4>
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={addImpactHighlight}>
                    Add highlight
                  </button>
                </div>
                {(content.impact?.highlights ?? []).map((item, index) => (
                  <div key={`impact-${index}`} className="row g-3 align-items-end">
                    <div className="col-12 col-md-5">
                      <label className="form-label small text-muted" htmlFor={`impact-label-${index}`}>Label</label>
                      <input
                        id={`impact-label-${index}`}
                        type="text"
                        className="form-control form-control-sm"
                        value={item?.label ?? ''}
                        onChange={event => updateImpactHighlight(index, 'label', event.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-5">
                      <label className="form-label small text-muted" htmlFor={`impact-description-${index}`}>Description</label>
                      <input
                        id={`impact-description-${index}`}
                        type="text"
                        className="form-control form-control-sm"
                        value={item?.description ?? ''}
                        onChange={event => updateImpactHighlight(index, 'description', event.target.value)}
                      />
                    </div>
                    <div className="col-12 col-md-2 d-flex justify-content-md-end">
                      <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeImpactHighlight(index)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {(!content.impact?.highlights || content.impact.highlights.length === 0) && (
                  <div className="alert alert-secondary" role="status">
                    Add highlights to brag about meaningful outcomes.
                  </div>
                )}
              </div>
            </div>
          </AdminCollapsibleSection>

          <AdminCollapsibleSection
            title="FAQ & call-to-action"
            description="Close with helpful answers and CTA buttons for next steps."
            defaultOpen
            rememberState
            className="mb-5"
            persistKey="about:faq"
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 mb-0">FAQ entries</h3>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addListItem('faq', () => ({ question: '', answer: '' }))}>
                Add question
              </button>
            </div>
            {(content.faq ?? []).map((item, index) => (
              <div key={`faq-${index}`} className="card border border-dashed mb-3">
                <div className="card-body p-3 d-grid gap-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <h4 className="h6 mb-0">Question {index + 1}</h4>
                    <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => removeListItem('faq', index)}>
                      Remove
                    </button>
                  </div>
                  <div>
                    <label className="form-label small text-muted" htmlFor={`faq-question-${index}`}>Question</label>
                    <input
                      id={`faq-question-${index}`}
                      type="text"
                      className="form-control form-control-sm"
                      value={item?.question ?? ''}
                      onChange={event => updateFaqItem(index, 'question', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label small text-muted" htmlFor={`faq-answer-${index}`}>Answer</label>
                    <textarea
                      id={`faq-answer-${index}`}
                      className="form-control form-control-sm"
                      rows={3}
                      value={item?.answer ?? ''}
                      onChange={event => updateFaqItem(index, 'answer', event.target.value)}
                    ></textarea>
                  </div>
                </div>
              </div>
            ))}
            {(!content.faq || content.faq.length === 0) && (
              <div className="alert alert-secondary" role="status">
                No FAQs yet. Add a few to address common questions.
              </div>
            )}
            <div className="mt-4 card border border-dashed">
              <div className="card-body p-3 d-grid gap-3">
                <h3 className="h6 mb-0">Call-to-action</h3>
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <label className="form-label small text-muted" htmlFor="cta-heading">Heading</label>
                    <input
                      id="cta-heading"
                      type="text"
                      className="form-control"
                      value={content.cta?.heading ?? ''}
                      onChange={event => updateCtaField('heading', event.target.value)}
                      placeholder="Partner with us"
                    />
                  </div>
                  <div className="col-12 col-lg-6">
                    <label className="form-label small text-muted" htmlFor="cta-body">Body</label>
                    <textarea
                      id="cta-body"
                      className="form-control"
                      rows={3}
                      value={content.cta?.body ?? ''}
                      onChange={event => updateCtaField('body', event.target.value)}
                    ></textarea>
                  </div>
                  <div className="col-12 col-lg-6">
                    <h4 className="h6">Primary action</h4>
                    <div className="mb-3">
                      <label className="form-label small text-muted" htmlFor="cta-primary-label">Label</label>
                      <input
                        id="cta-primary-label"
                        type="text"
                        className="form-control form-control-sm"
                        value={content.cta?.primary?.label ?? ''}
                        onChange={event => updateCtaAction('primary', 'label', event.target.value)}
                        placeholder="Join as a vendor"
                      />
                    </div>
                    <div>
                      <label className="form-label small text-muted" htmlFor="cta-primary-href">Href</label>
                      <input
                        id="cta-primary-href"
                        type="text"
                        className="form-control form-control-sm"
                        value={content.cta?.primary?.href ?? ''}
                        onChange={event => updateCtaAction('primary', 'href', event.target.value)}
                        placeholder="/partners"
                      />
                    </div>
                  </div>
                  <div className="col-12 col-lg-6">
                    <h4 className="h6">Secondary action</h4>
                    <div className="mb-3">
                      <label className="form-label small text-muted" htmlFor="cta-secondary-label">Label</label>
                      <input
                        id="cta-secondary-label"
                        type="text"
                        className="form-control form-control-sm"
                        value={content.cta?.secondary?.label ?? ''}
                        onChange={event => updateCtaAction('secondary', 'label', event.target.value)}
                        placeholder="See careers"
                      />
                    </div>
                    <div>
                      <label className="form-label small text-muted" htmlFor="cta-secondary-href">Href</label>
                      <input
                        id="cta-secondary-href"
                        type="text"
                        className="form-control form-control-sm"
                        value={content.cta?.secondary?.href ?? ''}
                        onChange={event => updateCtaAction('secondary', 'href', event.target.value)}
                        placeholder="/careers"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AdminCollapsibleSection>

          <aside className="alert alert-info" role="status">
            <h2 className="h6 mb-2">Publish guidance</h2>
            <ul className="small mb-0 ps-3">
              <li>Hero copy and FAQ show on every layout; other sections render based on the selected layout.</li>
              <li>The About page updates instantly after saving. Refresh the storefront to preview changes.</li>
              <li>Use the Team Grid layout for people-centric storytelling and Timeline when you have milestone-rich history.</li>
            </ul>
          </aside>
        </>
      )}
    </section>
  );
}
