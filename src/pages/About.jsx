import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand.js';

export default function About() {
  return (
    <section className="container py-3 px-3 px-sm-4">
      <header className="mb-4">
        <h1 className="h3 mb-1">About {BRAND_NAME}</h1>
        <p className="text-muted mb-0">{BRAND_TAGLINE}</p>
      </header>
      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <section className="mb-4" aria-labelledby="storyHeading">
            <h2 id="storyHeading" className="h5">Our Story</h2>
            <p>{BRAND_NAME} was created with one simple idea: make everyday grocery shopping easier, clearer and kinder on your time. Whether you need a quick top‑up of fresh sukuma wiki or a full weekly basket, we help you plan and checkout without stress.</p>
            <p>We focus on freshness, fair pricing, and a smooth experience on any phone. No complicated steps—just browse, add, and confirm.</p>
          </section>
          <section className="mb-4" aria-labelledby="whyHeading">
            <h2 id="whyHeading" className="h5">Why Shop With Us</h2>
            <ul className="small mb-0">
              <li><strong>Fresh everyday staples</strong>—greens, grains, cooking essentials.</li>
              <li><strong>Clear prices</strong>—what you see is what you pay (VAT already included).</li>
              <li><strong>Quick checkout</strong>—familiar mobile money flow (simulated here).</li>
              <li><strong>Order history</strong>—look back at what you bought and re‑plan easily.</li>
              <li><strong>Receipts you can keep</strong>—download, print or email a clean copy.</li>
              <li><strong>Works on any device</strong>—built with mobile screens in mind.</li>
            </ul>
          </section>
          <section className="mb-4" aria-labelledby="howHeading">
            <h2 id="howHeading" className="h5">How It Works</h2>
            <ol className="small mb-3">
              <li>Browse categories & search for items.</li>
              <li>Add what you need to your basket.</li>
              <li>Enter your name and contact details.</li>
              <li>Choose pickup or delivery preference.</li>
              <li>Confirm a simulated payment (test flow only).</li>
              <li>Get a receipt instantly—save or print.</li>
            </ol>
            <p className="small text-muted mb-0">Because this is a demo, payments are not real and stock isn’t live—but the experience reflects how the real service would feel.</p>
          </section>
          <section className="mb-4" aria-labelledby="careHeading">
            <h2 id="careHeading" className="h5">Freshness & Care</h2>
            <p>Market staples matter to the household budget. We emphasise rotation, respectful handling of produce, and clarity so you can trust what lands in your basket. In a full launch scenario we would surface freshness indicators and time‑stamped batch info.</p>
          </section>
          <section className="mb-4" aria-labelledby="faqHeading">
            <h2 id="faqHeading" className="h5 mb-3">Frequently Asked Questions</h2>
            <div className="vstack gap-2">
              <details>
                <summary className="fw-semibold">Are these real products?</summary>
                <p className="small mb-0">They represent common Kenyan household items to illustrate the experience.</p>
              </details>
              <details>
                <summary className="fw-semibold">Is payment real?</summary>
                <p className="small mb-0">No—this version only simulates a safe mobile money step for demonstration.</p>
              </details>
              <details>
                <summary className="fw-semibold">Can I get a receipt?</summary>
                <p className="small mb-0">Yes—after confirming you can download a PDF, save a text copy, print, or email.</p>
              </details>
              <details>
                <summary className="fw-semibold">Why does VAT show separately?</summary>
                <p className="small mb-0">So you can see the tax portion clearly while the shelf price stays familiar.</p>
              </details>
              <details>
                <summary className="fw-semibold">Will delivery be available?</summary>
                <p className="small mb-0">Delivery selection is shown for future readiness; in this demo it’s informational only.</p>
              </details>
            </div>
          </section>
        </div>
        <aside className="col-12 col-lg-5">
          <div className="border rounded p-3 bg-body mb-4">
            <h2 className="h6 mb-2">At a Glance</h2>
            <ul className="small m-0 ps-3">
              <li>Everyday essentials in one place</li>
              <li>Simple, clean interface</li>
              <li>Fast add-to-basket flow</li>
              <li>Instant receipt options</li>
              <li>Light & dark viewing modes</li>
              <li>Built mobile-first</li>
            </ul>
          </div>
          <div className="border rounded p-3 bg-body mb-4">
            <h2 className="h6 mb-2">Coming Later</h2>
            <ul className="small m-0 ps-3">
              <li>Real-time stock levels</li>
              <li>Scheduled delivery windows</li>
              <li>Loyalty & smart re-order tips</li>
              <li>Promo bundles & seasonal picks</li>
              <li>Live payment integration</li>
            </ul>
          </div>
          <div className="border rounded p-3 bg-body">
            <h2 className="h6 mb-2">Need Help?</h2>
            <p className="small mb-2">Have a suggestion or spotted something off? We’d love to hear your feedback as we grow.</p>
            <p className="small mb-0">Thank you for shopping with {BRAND_NAME}.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
