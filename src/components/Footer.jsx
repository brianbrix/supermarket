import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand.js';
import { useSettings } from '../context/SettingsContext.jsx';

export default function Footer() {
  const { settings } = useSettings();
  const storeName = settings?.storeName || BRAND_NAME;
  const branding = settings?.branding || {};
  const brandAsset = (branding.brandImage || branding.systemLogo || '').trim();
  return (
    <footer className="footer">
      <div className="footer-brand d-flex flex-column flex-sm-row align-items-sm-center gap-3">
        {brandAsset ? (
          <img src={brandAsset} alt={`${storeName} brand mark`} className="footer-brand-image" />
        ) : null}
        <div>
          <p className="mb-1">© {new Date().getFullYear()} {storeName}</p>
          <small className="text-muted d-block">{BRAND_TAGLINE}</small>
        </div>
      </div>
    </footer>
  );
}
