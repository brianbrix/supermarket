import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand.js';

export default function Footer() {
  return (
    <footer className="footer">
      <p>© {new Date().getFullYear()} {BRAND_NAME} — {BRAND_TAGLINE}</p>
    </footer>
  );
}
