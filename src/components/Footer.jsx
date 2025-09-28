import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand.js';
import { useSettings } from '../context/SettingsContext.jsx';

export default function Footer() {
  const { settings } = useSettings();
  const storeName = settings?.storeName || BRAND_NAME;
  return (
    <footer className="footer">
      <p>© {new Date().getFullYear()} {storeName} — {BRAND_TAGLINE}</p>
    </footer>
  );
}
