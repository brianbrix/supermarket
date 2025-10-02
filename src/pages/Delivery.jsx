import { useMemo } from 'react';
import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand.js';
import { useSettings } from '../context/SettingsContext.jsx';
import {
  DEFAULT_DELIVERY_CONTENT,
  DEFAULT_DELIVERY_PRICING,
  DEFAULT_SUPPORT_CONTACT,
  normalizeDeliveryContent,
  normalizeDeliveryPricing,
  normalizeSupportContact,
} from '../data/deliveryContent.js';
import { formatCurrency } from '../utils/currency.js';
import { estimateZoneFeeRange, formatFeeRange } from '../utils/deliveryPricing.js';

export default function Delivery() {
  const { settings } = useSettings();
  const storeName = settings?.storeName || BRAND_NAME;
  const support = useMemo(() => normalizeSupportContact({
    ...DEFAULT_SUPPORT_CONTACT,
    ...(settings?.support || {}),
  }), [settings?.support]);

  const deliveryContent = useMemo(
    () => normalizeDeliveryContent(settings?.delivery?.content ?? DEFAULT_DELIVERY_CONTENT),
    [settings?.delivery?.content]
  );

  const deliveryPricing = useMemo(() => normalizeDeliveryPricing({
    ...DEFAULT_DELIVERY_PRICING,
    ...(settings?.delivery?.pricing || {}),
  }), [settings?.delivery?.pricing]);

  const supportEmail = support.email;
  const supportPhone = support.phone;
  const supportPhoneHref = supportPhone ? supportPhone.replace(/[^+\d]/g, '') : '';
  const rawWhatsapp = (support.whatsapp || supportPhone || '').replace(/\D/g, '');
  let normalizedWhatsapp = rawWhatsapp;
  if (!normalizedWhatsapp) {
    normalizedWhatsapp = '254700000000';
  } else if (normalizedWhatsapp.startsWith('0')) {
    normalizedWhatsapp = `254${normalizedWhatsapp.slice(1)}`;
  } else if (normalizedWhatsapp.startsWith('7') && normalizedWhatsapp.length === 9) {
    normalizedWhatsapp = `254${normalizedWhatsapp}`;
  }
  const whatsappLink = `https://wa.me/${normalizedWhatsapp}`;

  const baseFeeValue = useMemo(() => {
    if (Number.isFinite(Number(deliveryContent?.baseFee))) {
      return Number(deliveryContent.baseFee);
    }
    if (Number.isFinite(Number(deliveryPricing?.baseFee))) {
      return Number(deliveryPricing.baseFee);
    }
    return DEFAULT_DELIVERY_PRICING.baseFee;
  }, [deliveryContent?.baseFee, deliveryPricing?.baseFee]);

  const freeDeliveryThresholdValue = useMemo(() => {
    if (Number.isFinite(Number(deliveryContent?.freeDeliveryThreshold))) {
      return Number(deliveryContent.freeDeliveryThreshold);
    }
    if (Number.isFinite(Number(deliveryPricing?.freeAbove))) {
      return Number(deliveryPricing.freeAbove);
    }
    return DEFAULT_DELIVERY_CONTENT.freeDeliveryThreshold ?? DEFAULT_DELIVERY_PRICING.freeAbove;
  }, [deliveryContent?.freeDeliveryThreshold, deliveryPricing?.freeAbove]);

  const formattedBaseFee = formatCurrency(baseFeeValue);
  const formattedThreshold = formatCurrency(freeDeliveryThresholdValue);

  const coverageZones = deliveryContent.coverageZones;

  const coverageZoneRows = useMemo(() => (
    (coverageZones || []).map((zone) => {
      const estimate = estimateZoneFeeRange({ zone, pricing: deliveryPricing });
      const label = formatFeeRange(estimate, (value) => formatCurrency(value));
      const distanceHint = estimate?.distanceRange
        ? `${estimate.distanceRange.minKm.toFixed(1)}–${estimate.distanceRange.maxKm.toFixed(1)} km`
        : null;
      return {
        zone,
        estimate,
        label,
        distanceHint,
      };
    })
  ), [coverageZones, deliveryPricing]);

  const deliveryWindows = deliveryContent.windows;

  const serviceHighlights = deliveryContent.highlights;

  const howItWorks = deliveryContent.processSteps;

  const packagingNotes = deliveryContent.packaging;

  const serviceFaqs = useMemo(() => (
    deliveryContent.faqs.map((item) => {
      const answerWithBase = String(item.answer ?? '')
        .replace('{baseFee}', formattedBaseFee)
        .replace('{freeThreshold}', formattedThreshold);
      return {
        question: item.question,
        answer: answerWithBase,
      };
    })
  ), [deliveryContent.faqs, formattedBaseFee, formattedThreshold]);

  return (
    <section className="delivery-page container py-4 py-lg-5">
      <header className="delivery-hero card border-0 shadow-sm mb-4 mb-lg-5">
        <div className="card-body p-4 p-lg-5">
          <p className="text-uppercase text-success fw-semibold small mb-2">Delivery services</p>
          <h1 className="display-6 mb-3">Fresh groceries, dispatched with care</h1>
          <p className="lead text-muted mb-4">
            {storeName} delivers the {BRAND_TAGLINE} wherever you are. Pick a slot, track your rider, and expect chilled items to arrive the way they left our hub.
          </p>
          <div className="d-flex flex-column flex-md-row gap-2">
            <a className="btn btn-success btn-lg" href="/products">Start shopping</a>
            <a className="btn btn-outline-success btn-lg" href={`mailto:${supportEmail}`}>Talk to dispatch</a>
          </div>
        </div>
      </header>

      <section className="delivery-highlights row g-3 g-lg-4 mb-5" aria-label="Service highlights">
        {serviceHighlights.map((item, index) => (
          <div className="col-12 col-md-6 col-xl-3" key={`${item.icon || 'icon'}-${item.title || index}`}>
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <span className="delivery-icon-wrap text-success mb-3" aria-hidden="true">
                  <i className={`bi bi-${item.icon} fs-2`}></i>
                </span>
                <h2 className="h5 mb-2">{item.title}</h2>
                <p className="text-muted mb-0">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="delivery-coverage card border-0 shadow-sm mb-5" aria-label="Delivery coverage map">
        <div className="card-body p-4 p-lg-5">
          <div className="row g-4 align-items-center">
            <div className="col-12 col-lg-5">
              <h2 className="h4 mb-3">Where we deliver today</h2>
              <p className="text-muted mb-0">
                We run four timed loops every day across Nairobi estates. Slots open weekly—select your estate at checkout or ask dispatch to tag your building.
              </p>
            </div>
            <div className="col-12 col-lg-7">
              <div className="delivery-zones card border border-dashed h-100">
                <div className="card-body p-3 p-md-4">
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col">Estate / zone</th>
                          <th scope="col">Typical ETA</th>
                          <th scope="col">Estimated fee*</th>
                          <th scope="col">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverageZoneRows.map(({ zone, label, estimate, distanceHint }, index) => (
                          <tr key={zone.key || zone.name || index}>
                            <th scope="row" data-label="Estate / zone">{zone.name}</th>
                            <td data-label="Typical ETA">{zone.eta}</td>
                            <td data-label="Estimated fee" className="text-muted small">
                              {estimate?.isFree
                                ? 'Free delivery when you hit the threshold'
                                : (label || '—')}
                              {distanceHint && (
                                <span className="d-block text-body-secondary small">{distanceHint} from our hub</span>
                              )}
                            </td>
                            <td data-label="Notes" className="text-muted small">{zone.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="small text-muted mt-3 mb-1">
                    Need a different estate? Drop us a note—new coverage areas launch every quarter based on demand.
                  </p>
                  <p className="small text-muted mb-0 fst-italic">*Estimates assume a typical cart near the subsidy threshold and may adjust at checkout.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="delivery-windows card border-0 shadow-sm mb-5" aria-label="Delivery windows">
        <div className="card-body p-4 p-lg-5">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
            <div>
              <h2 className="h4 mb-2">Slots built around your day</h2>
              <p className="text-muted mb-0">Lock in an arrival window on checkout—we only open slots we can honour.</p>
            </div>
            <div className="badge text-bg-success fs-6 py-2 px-3">
              Free above {formattedThreshold}
            </div>
          </div>
          <div className="row g-3 g-lg-4">
            {deliveryWindows.map((window, index) => (
              <div className="col-12 col-md-6" key={window.key || window.label || index}>
                <div className="card h-100 border border-dashed">
                  <div className="card-body p-4">
                    <p className="text-uppercase text-success fw-semibold small mb-1">{window.label}</p>
                    <h3 className="h5 mb-2">{window.timeLabel || window.time}</h3>
                    <p className="text-muted mb-0">{window.details}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="alert alert-success d-flex align-items-center gap-3 mt-4 mb-0">
            <i className="bi bi-cash-coin fs-4" aria-hidden="true"></i>
            <div>
              <p className="mb-1 fw-semibold">Standard delivery fee: {formattedBaseFee}</p>
              <p className="mb-0 small text-muted">Includes insulated liners and doorstep hand-off. Bulk orders receive a tailored quote before dispatch.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="delivery-process card border-0 shadow-sm mb-5" aria-label="How delivery works">
        <div className="card-body p-4 p-lg-5">
          <div className="row g-4 align-items-start">
            <div className="col-12 col-lg-4">
              <h2 className="h4 mb-3">How delivery works</h2>
              <p className="text-muted mb-0">
                Every order is scanned from hub to doorstep. You’ll receive SMS and WhatsApp updates at every hand-off so you can prep to receive the rider.
              </p>
            </div>
            <div className="col-12 col-lg-8">
              <div className="row g-3">
                {howItWorks.map((item, index) => (
                  <div className="col-12 col-md-4" key={item.step || item.headline || index}>
                    <div className="delivery-step card h-100 border border-dashed text-center">
                      <div className="card-body p-4">
                        <span className="delivery-step__index">{item.step}</span>
                        <h3 className="h6 mb-2">{item.headline}</h3>
                        <p className="text-muted small mb-0">{item.copy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="delivery-packaging card border-0 shadow-sm mb-5" aria-label="Packaging and freshness">
        <div className="card-body p-4 p-lg-5">
          <h2 className="h4 mb-3">Freshness guaranteed en route</h2>
          <div className="row g-3 g-lg-4">
            {packagingNotes.map((note, index) => (
              <div className="col-12 col-md-4" key={note.title || index}>
                <div className="card h-100 border border-dashed">
                  <div className="card-body p-4">
                    <h3 className="h6 mb-2">{note.title}</h3>
                    <p className="text-muted mb-0">{note.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="delivery-faq card border-0 shadow-sm mb-5" aria-label="Delivery FAQs">
        <div className="card-body p-4 p-lg-5">
          <h2 className="h4 mb-3">Delivery FAQs</h2>
          <div className="accordion" id="deliveryFaqList">
            {serviceFaqs.map((item, index) => {
              const collapseId = `delivery-faq-${index}`;
              return (
                <div className="accordion-item" key={collapseId}>
                  <h3 className="accordion-header" id={`${collapseId}-header`}>
                    <button
                      className={`accordion-button${index === 0 ? '' : ' collapsed'}`}
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#${collapseId}`}
                      aria-expanded={index === 0}
                      aria-controls={collapseId}
                    >
                      {item.question}
                    </button>
                  </h3>
                  <div
                    id={collapseId}
                    className={`accordion-collapse collapse${index === 0 ? ' show' : ''}`}
                    aria-labelledby={`${collapseId}-header`}
                    data-bs-parent="#deliveryFaqList"
                  >
                    <div className="accordion-body text-muted">
                      {item.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="delivery-support card border-0 shadow-sm" aria-label="Support and contact">
        <div className="card-body p-4 p-lg-5 d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <h2 className="h4 mb-2">Need a custom drop?</h2>
            <p className="text-muted mb-0">
              Chat with dispatch about bulk orders, office pantries, or recurring subscriptions. We’ll match you to the right loop and crew.
            </p>
          </div>
          <div className="d-flex flex-column flex-md-row gap-2">
            {supportPhone && (
              <a className="btn btn-outline-success btn-lg" href={`tel:${supportPhoneHref}`}>Call dispatch</a>
            )}
            <a className="btn btn-success btn-lg" href={whatsappLink} target="_blank" rel="noreferrer">
              Message on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </section>
  );
}
