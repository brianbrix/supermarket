// Central brand configuration. Adjust via environment variables at build time.
// Usage: import { BRAND_NAME, BRAND_TAGLINE, BRAND_RECEIPT_TITLE } from '../config/brand';
// Environment variable names (Vite): VITE_BRAND_NAME, VITE_BRAND_TAGLINE, VITE_BRAND_RECEIPT_TITLE

export const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || 'KenSuper';
export const BRAND_TAGLINE = import.meta.env.VITE_BRAND_TAGLINE || 'Fresh & Local';
// Title line used in PDF/email receipts
export const BRAND_RECEIPT_TITLE = import.meta.env.VITE_BRAND_RECEIPT_TITLE || `${BRAND_NAME} Market`;

export const BRAND_COPY_FOOTER = `Powered by ${BRAND_NAME}`;
