import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import AdminCollapsibleSection from '../../components/admin/AdminCollapsibleSection.jsx';

const BRAND_STYLE_PRESETS = [
  {
    id: 'classic',
    label: 'Classic Serif',
    description: 'Cream backdrop with deep green serif lettering.',
    width: 640,
    height: 320,
    background: { type: 'gradient', stops: ['#fbf5e6', '#f2ead3'] },
    textColor: '#0b3d2e',
    fontFamily: '"Playfair Display", "Georgia", serif',
  fontWeight: 600,
  fontSizeRatio: 0.44,
    letterSpacing: 1.8,
    uppercase: true,
    shadow: { color: 'rgba(11, 61, 46, 0.25)', blur: 18, offsetX: 0, offsetY: 8 }
  },
  {
    id: 'sunset-drift',
    label: 'Sunset Drift',
    description: 'Vibrant orange to magenta gradient with bold sans serif.',
    width: 640,
    height: 320,
    background: { type: 'gradient', stops: ['#f86335', '#f43f7d'] },
    textColor: '#ffffff',
    fontFamily: '"Poppins", "Helvetica Neue", sans-serif',
  fontWeight: 700,
  fontSizeRatio: 0.5,
    letterSpacing: 2.8,
    uppercase: true,
    shadow: { color: 'rgba(0,0,0,0.35)', blur: 20, offsetX: 0, offsetY: 10 }
  },
  {
    id: 'lush-garden',
    label: 'Lush Garden',
    description: 'Fresh emerald with soft leaf pattern overlay.',
    width: 640,
    height: 320,
    background: { type: 'gradient', stops: ['#1f8f55', '#68c06b'] },
    overlay: { type: 'noise', opacity: 0.12 },
    textColor: '#f5fdf6',
    fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
  fontWeight: 600,
  fontSizeRatio: 0.46,
    letterSpacing: 1.2,
    uppercase: false,
    shadow: { color: 'rgba(18, 80, 44, 0.45)', blur: 22, offsetX: 0, offsetY: 12 }
  },
  {
    id: 'midnight-neon',
    label: 'Midnight Neon',
    description: 'Deep navy with electric neon outline.',
    width: 640,
    height: 320,
    background: { type: 'solid', color: '#0e1320' },
    textColor: '#7fffd4',
    stroke: { color: '#ff6ad5', width: 6 },
    fontFamily: '"Futura", "Montserrat", sans-serif',
  fontWeight: 800,
  fontSizeRatio: 0.52,
    letterSpacing: 3.6,
    uppercase: true,
    shadow: { color: 'rgba(127, 255, 212, 0.6)', blur: 24, offsetX: 0, offsetY: 0 }
  },
  {
    id: 'minimal-bold',
    label: 'Minimal Bold',
    description: 'Clean black on white with tight kerning.',
    width: 640,
    height: 320,
    background: { type: 'solid', color: '#ffffff' },
    textColor: '#141414',
    fontFamily: '"Archivo Black", "Arial Black", sans-serif',
  fontWeight: 900,
  fontSizeRatio: 0.48,
    letterSpacing: 1.5,
    uppercase: false,
    shadow: { color: 'rgba(0,0,0,0.12)', blur: 12, offsetX: 0, offsetY: 8 }
  },
  {
    id: 'sunrise-glass',
    label: 'Sunrise Glass',
    description: 'Soft sunrise gradient with translucent glass panel.',
    width: 640,
    height: 320,
    background: { type: 'gradient', stops: ['#ffecd2', '#fcb69f'] },
    glassPanel: { color: 'rgba(255, 255, 255, 0.35)', blur: 20 },
    textColor: '#663c3c',
    fontFamily: '"Raleway", "Helvetica Neue", sans-serif',
  fontWeight: 700,
  fontSizeRatio: 0.44,
    letterSpacing: 1.8,
    uppercase: false,
    shadow: { color: 'rgba(102, 60, 60, 0.35)', blur: 18, offsetX: 0, offsetY: 10 }
  }
];

const ECOMMERCE_BADGES = [
  {
    id: 'cart-burst',
    label: 'Cart Burst',
    description: 'Shopping cart with a celebratory burst.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Cart Burst"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(0,0,0,0.25)"/></filter></defs><rect width="120" height="120" rx="28" fill="#ffffff"/><path d="M22 32h10.6l6.4 38.4c.4 2.4 2.5 4.1 4.9 4.1h37.5c2 0 3.8-1.3 4.5-3.1l8.8-24.6c1.1-3.1-1.2-6.3-4.5-6.3H44.9" fill="none" stroke="#127a41" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="52" cy="92" r="6" fill="#127a41"/><circle cx="82" cy="92" r="6" fill="#127a41"/><path d="M42 14l4.2 6.8 7.8-1.6-4.8 6.4 4.8 6.4-7.8-1.6-4.2 6.8-1-8-7-2.4 7-2.4z" fill="#ff7a1a" filter="url(#shadow)"/></svg>',
    scale: 0.28,
    opacity: 0.94
  },
  {
    id: 'delivery-van',
    label: 'Delivery Van',
    description: 'Express delivery van illustration.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Delivery Van"><rect width="120" height="120" rx="26" fill="#ecf9ff"/><path d="M22 70V48c0-4.4 3.6-8 8-8h38c3.5 0 6.7 2.3 7.7 5.6l3.3 10.4H98c2.2 0 4 1.8 4 4v18" fill="#1c95d2"/><path d="M91 80h-7m-32 0h-7" stroke="#0b3d2e" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="84" r="10" fill="#0b3d2e"/><circle cx="82" cy="84" r="10" fill="#0b3d2e"/><circle cx="42" cy="84" r="4" fill="#9ad1e8"/><circle cx="82" cy="84" r="4" fill="#9ad1e8"/><path d="M34 44h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M86 64h14" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>',
    scale: 0.3,
    opacity: 0.9
  },
  {
    id: 'storefront-awning',
    label: 'Storefront',
    description: 'Friendly storefront awning badge.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Storefront"><rect width="120" height="120" rx="26" fill="#fff7ec"/><path d="M28 38h64l4 18c1 4.6-2.4 9-7.1 9H31.1c-4.7 0-8.1-4.4-7.1-9l4-18z" fill="#ff9f1c"/><path d="M28 38h64l3-10c.8-2.6-1.1-5.2-3.8-5.2H28.8c-2.7 0-4.6 2.6-3.8 5.2l3 10z" fill="#ef476f"/><rect x="32" y="65" width="56" height="36" rx="8" fill="#fff"/><rect x="42" y="72" width="16" height="20" rx="4" fill="#11866f"/><rect x="64" y="72" width="20" height="12" rx="4" fill="#ffd166"/></svg>',
    scale: 0.32,
    opacity: 0.92
  },
  {
    id: 'price-tag',
    label: 'Price Tag',
    description: 'Tag with percentage symbol.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Price Tag"><rect width="120" height="120" rx="28" fill="#f0f7ff"/><path d="M34 28h36l24 24c1.5 1.5 2.4 3.6 2.4 5.7v26.6c0 4.5-3.6 8.1-8.1 8.1H54.6c-2.1 0-4.2-.9-5.7-2.4L25 66V36c0-4.4 3.6-8 8-8z" fill="#2563eb"/><path d="M76 38a6 6 0 110 12 6 6 0 010-12zm-28 50a6 6 0 110-12 6 6 0 010 12z" fill="#fff"/><path d="M74 54L46 78" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>',
    scale: 0.28,
    opacity: 0.9
  },
  {
    id: 'reward-badge',
    label: 'Reward Badge',
    description: 'Ribbon badge for loyalty rewards.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Reward Badge"><rect width="120" height="120" rx="26" fill="#fbf0ff"/><circle cx="60" cy="52" r="32" fill="#9f2bff"/><circle cx="60" cy="52" r="20" fill="#fdf7ff"/><path d="M54 76l-10 28 16-10 16 10-10-28" fill="#9f2bff"/></svg>',
    scale: 0.26,
    opacity: 0.92
  },
  {
    id: 'basket-fruits',
    label: 'Fresh Basket',
    description: 'Basket filled with fresh produce.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Fresh Basket"><rect width="120" height="120" rx="26" fill="#eefbf1"/><path d="M32 50h56l6 24c1.1 4.4-2.2 8.6-6.7 8.6H32.7c-4.6 0-7.9-4.2-6.7-8.6L32 50z" fill="#d97706"/><path d="M52 50l10-18 10 18" stroke="#0f5132" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="44" cy="44" r="10" fill="#ef4444"/><circle cx="76" cy="44" r="10" fill="#a855f7"/><circle cx="60" cy="40" r="9" fill="#22c55e"/></svg>',
    scale: 0.3,
    opacity: 0.9
  }
];

const BRAND_IMAGE_SHAPES = [
  {
    id: 'square',
    label: 'Sharp corners',
    description: 'Crisp edges for a bold, structured presence.',
  },
  {
    id: 'rounded',
    label: 'Rounded',
    description: 'Soft 16px radius that feels modern and friendly.',
  },
  {
    id: 'circle',
    label: 'Circle',
    description: 'Perfectly circular badge for avatar-style marks.',
  },
  {
    id: 'pill',
    label: 'Pill',
    description: 'Elongated capsule that hugs wider wordmarks.',
  },
  {
    id: 'squircle',
    label: 'Squircle',
    description: 'A curvy square that balances sharp and soft.',
  },
];

const BRAND_IMAGE_SHAPE_IDS = new Set(BRAND_IMAGE_SHAPES.map(shape => shape.id));
const DEFAULT_BRAND_IMAGE_SHAPE = BRAND_IMAGE_SHAPES.find(shape => shape.id === 'rounded')?.id
  || BRAND_IMAGE_SHAPES[0]?.id
  || 'square';

function traceRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  traceRoundedRectPath(ctx, x, y, width, height, r);
  ctx.closePath();
  ctx.fill();
}

function applyBrandShapeClip(ctx, width, height, shape) {
  const normalized = (shape || '').toLowerCase();
  if (!normalized || normalized === 'square') {
    return;
  }
  ctx.beginPath();
  if (normalized === 'circle') {
    const radius = Math.min(width, height) / 2;
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  } else {
    let radius;
    if (normalized === 'pill') {
      radius = Math.min(width, height) / 2;
    } else if (normalized === 'squircle') {
      radius = Math.min(width, height) * 0.32;
    } else {
      radius = Math.min(width, height) * 0.18;
    }
    traceRoundedRectPath(ctx, 0, 0, width, height, radius);
  }
  ctx.closePath();
  ctx.clip();
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getPresetPreviewStyle(preset) {
  if (!preset) {
    return {
      backgroundColor: '#f5f5f5',
      color: '#111111',
    };
  }
  const style = {
    backgroundColor: preset.background?.color || '#f5f5f5',
    color: preset.textColor || '#111111',
  };
  if (preset.background?.type === 'gradient' && Array.isArray(preset.background.stops) && preset.background.stops.length >= 2) {
    style.backgroundImage = `linear-gradient(135deg, ${preset.background.stops.join(', ')})`;
  } else if (preset.background?.color) {
    style.backgroundImage = 'none';
  }
  return style;
}

function loadSvgImage(svgString) {
  return new Promise((resolve, reject) => {
    if (!svgString) {
      reject(new Error('Missing SVG markup'));
      return;
    }
    const encoded = typeof window !== 'undefined'
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
      : null;
    if (!encoded) {
      reject(new Error('SVG encoding unavailable'));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load SVG image'));
    img.src = encoded;
  });
}

function getBadgePreviewSrc(badge) {
  if (!badge?.svg) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badge.svg)}`;
}

async function renderBrandImageFromPreset(text, preset, { badge, shape } = {}) {
  const width = Math.max(320, Math.round(preset.width || 640));
  const height = Math.max(160, Math.round(preset.height || 320));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is not supported in this browser.');

  const requestedShape = typeof shape === 'string' ? shape.toLowerCase() : undefined;
  const resolvedShape = requestedShape && BRAND_IMAGE_SHAPE_IDS.has(requestedShape)
    ? requestedShape
    : DEFAULT_BRAND_IMAGE_SHAPE;

  ctx.save();
  applyBrandShapeClip(ctx, width, height, resolvedShape);

  // Background fill
  if (preset.background?.type === 'gradient' && Array.isArray(preset.background.stops) && preset.background.stops.length >= 2) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const stops = preset.background.stops;
    const divisor = stops.length - 1;
    stops.forEach((color, index) => {
      if (divisor === 0) {
        gradient.addColorStop(0, color);
      } else {
        gradient.addColorStop(index / divisor, color);
      }
    });
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = preset.background?.color || '#ffffff';
  }
  ctx.fillRect(0, 0, width, height);

  if (preset.overlay?.type === 'noise') {
    const opacity = typeof preset.overlay.opacity === 'number' ? Math.min(Math.max(preset.overlay.opacity, 0), 1) : 0.1;
    ctx.save();
    ctx.globalAlpha = opacity;
    for (let i = 0; i < width * height * 0.015; i += 1) {
      const size = Math.random() * 3 + 1;
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  if (preset.glassPanel) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = preset.glassPanel.color || 'rgba(255, 255, 255, 0.35)';
    drawRoundedRect(ctx, width * 0.08, height * 0.18, width * 0.84, height * 0.64, Math.min(width, height) * 0.08);
    ctx.restore();
  }

  const fontSizeRatio = typeof preset.fontSizeRatio === 'number' ? preset.fontSizeRatio : 0.42;
  const fontSize = Math.round(height * fontSizeRatio);
  const fontFamily = preset.fontFamily || '"Poppins", sans-serif';
  const fontWeight = preset.fontWeight || 700;
  let outputText = text;
  if (preset.uppercase) {
    outputText = text.toUpperCase();
  }

  ctx.save();
  if (preset.shadow) {
    ctx.shadowColor = preset.shadow.color || 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = preset.shadow.blur ?? 12;
    ctx.shadowOffsetX = preset.shadow.offsetX ?? 0;
    ctx.shadowOffsetY = preset.shadow.offsetY ?? 6;
  }
  ctx.fillStyle = preset.textColor || '#111111';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxWidth = width * 0.86;
  drawFittedText(ctx, outputText, width / 2, height / 2, maxWidth, fontSize, fontWeight, fontFamily, preset);

  ctx.restore();

  if (preset.stroke) {
    ctx.save();
    ctx.strokeStyle = preset.stroke.color || 'rgba(255,255,255,0.65)';
    ctx.lineWidth = preset.stroke.width || 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.strokeText(outputText, width / 2, height / 2);
    ctx.restore();
  }

  if (badge?.svg) {
    try {
      const image = await loadSvgImage(badge.svg);
      const scale = typeof badge.scale === 'number' ? badge.scale : 0.28;
      const badgeSize = Math.min(width, height) * scale;
      const padding = Math.min(width, height) * 0.05;
      const position = badge.position || 'bottom-right';
      let x = width - badgeSize - padding;
      let y = height - badgeSize - padding;
      if (position === 'bottom-left') {
        x = padding;
        y = height - badgeSize - padding;
      } else if (position === 'top-right') {
        x = width - badgeSize - padding;
        y = padding;
      } else if (position === 'top-left') {
        x = padding;
        y = padding;
      }
      ctx.save();
      ctx.globalAlpha = badge.opacity ?? 0.9;
      ctx.drawImage(image, x, y, badgeSize, badgeSize);
      ctx.restore();
    } catch (err) {
      console.error('Failed to render badge overlay', err);
    }
  }

  ctx.restore();
  return canvas.toDataURL('image/png', 0.92);
}

function drawFittedText(ctx, text, centerX, centerY, maxWidth, fontSize, fontWeight, fontFamily, preset) {
  let currentFontSize = fontSize;
  let words = [text];
  if (text.length > 24) {
    const mid = Math.ceil(text.length / 2);
    const breakpoint = text.lastIndexOf(' ', mid);
    if (breakpoint > 8) {
      words = [text.slice(0, breakpoint), text.slice(breakpoint + 1)];
    }
  }

  if (words.length === 1) {
    while (currentFontSize > 28) {
      ctx.font = `${fontWeight} ${currentFontSize}px ${fontFamily}`;
      if (ctx.measureText(text).width <= maxWidth) break;
      currentFontSize -= 2;
    }
    ctx.font = `${fontWeight} ${currentFontSize}px ${fontFamily}`;
    ctx.fillText(text, centerX, centerY);
  } else {
    const lineHeight = currentFontSize * 1.05;
    const totalHeight = lineHeight * words.length;
    let startY = centerY - totalHeight / 2 + lineHeight / 2;
    words.forEach(line => {
      let sizedFont = currentFontSize;
      while (sizedFont > 24) {
        ctx.font = `${fontWeight} ${sizedFont}px ${fontFamily}`;
        if (ctx.measureText(line).width <= maxWidth) break;
        sizedFont -= 2;
      }
      ctx.font = `${fontWeight} ${sizedFont}px ${fontFamily}`;
      ctx.fillText(preset.uppercase ? line.toUpperCase() : line, centerX, startY);
      startY += lineHeight;
    });
  }
}

function deriveAltFromFileName(fileName) {
  if (!fileName) return 'Brand logo';
  const cleaned = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  const normalized = cleaned.trim();
  if (!normalized) return 'Brand logo';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const DEFAULT_FORM = {
  storeName: 'Supermarket',
  currencyCode: 'KES',
  currencySymbol: 'KES',
  currencyLocale: 'en-KE',
  defaultTheme: 'light',
  enableDarkMode: true,
  systemLogo: '',
  systemLogoAlt: '',
  brandImage: '',
  brandImageSource: 'upload',
  brandImageText: '',
  brandImageStyle: 'classic',
  brandImageBadge: '',
  brandImageShape: DEFAULT_BRAND_IMAGE_SHAPE,
  brandNameScale: 1,
  showBrandName: true,
  lowStockThreshold: 5,
  orderDelayAlertHours: 6,
  orderHighValueThreshold: 25000,
};

const KEY_MAP = {
  storeName: 'store.name',
  currencyCode: 'currency.code',
  currencySymbol: 'currency.symbol',
  currencyLocale: 'currency.locale',
  defaultTheme: 'theme.default',
  enableDarkMode: 'theme.enableDarkMode',
  systemLogo: 'branding.system_logo',
  systemLogoAlt: 'branding.system_logo_alt',
  brandImage: 'branding.brand_image',
  brandImageSource: 'branding.brand_image_source',
  brandImageText: 'branding.brand_image_text',
  brandImageStyle: 'branding.brand_image_style',
  brandImageBadge: 'branding.brand_image_badge',
  brandImageShape: 'branding.brand_image_shape',
  brandNameScale: 'branding.brand_name_scale',
  showBrandName: 'branding.show_brand_name',
  lowStockThreshold: 'inventory.low_stock_threshold',
  orderDelayAlertHours: 'orders.delay_alert_hours',
  orderHighValueThreshold: 'orders.high_value_threshold',
};

const FIELD_TYPES = {
  storeName: 'string',
  currencyCode: 'string',
  currencySymbol: 'string',
  currencyLocale: 'string',
  defaultTheme: 'string',
  enableDarkMode: 'boolean',
  systemLogo: 'string',
  systemLogoAlt: 'string',
  brandImage: 'string',
  brandImageSource: 'string',
  brandImageText: 'string',
  brandImageStyle: 'string',
  brandImageBadge: 'string',
  brandImageShape: 'string',
  brandNameScale: 'number',
  showBrandName: 'boolean',
  lowStockThreshold: 'number',
  orderDelayAlertHours: 'number',
  orderHighValueThreshold: 'number',
};

export default function AdminSystemSettings() {
  const { push } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [error, setError] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandImageUploading, setBrandImageUploading] = useState(false);
  const [brandImageGenerating, setBrandImageGenerating] = useState(false);

  const readFileAsDataUrl = useCallback((file) => new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  }), []);

  const uploadBrandAsset = useCallback(async (file, assetType) => {
    if (!file) {
      throw new Error('No file to upload');
    }
    let lastError;
    if (typeof api?.admin?.systemSettings?.uploadAsset === 'function') {
      try {
        const response = await api.admin.systemSettings.uploadAsset(file, { type: assetType });
        const url = response?.url || response?.data?.url || response?.location || response?.absoluteUrl;
        if (url) {
          return url;
        }
        throw new Error('Upload succeeded but returned no URL');
      } catch (err) {
        lastError = err;
      }
    }
    if (typeof api?.admin?.homepageLayouts?.uploadMedia === 'function') {
      try {
        const response = await api.admin.homepageLayouts.uploadMedia(file);
        const url = response?.url || response?.data?.url || response?.location || response?.absoluteUrl;
        if (url) {
          return url;
        }
        throw new Error('Upload succeeded but returned no URL');
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) throw lastError;
    throw new Error('Upload endpoint unavailable');
  }, []);

  const findPreset = useCallback((id) => BRAND_STYLE_PRESETS.find(preset => preset.id === id) || BRAND_STYLE_PRESETS[0], []);

  const findBadge = useCallback((id) => {
    if (!id) return null;
    return ECOMMERCE_BADGES.find(item => item.id === id) || null;
  }, []);

  const handleLogoFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await uploadBrandAsset(file, 'system-logo');
      setForm(prev => ({
        ...prev,
        systemLogo: url,
        systemLogoAlt: prev.systemLogoAlt || deriveAltFromFileName(file.name),
      }));
      push('System logo updated.', 'info');
    } catch (err) {
      console.error('System logo upload failed', err);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setForm(prev => ({
          ...prev,
          systemLogo: dataUrl,
          systemLogoAlt: prev.systemLogoAlt || deriveAltFromFileName(file.name),
        }));
        push(`${err?.message ? `${err.message}. ` : ''}Embedded the logo directly for now.`, 'warning');
      } catch (readErr) {
        console.error('System logo inline fallback failed', readErr);
        push(err?.message || 'Failed to upload logo. Please try again.', 'error');
      }
    } finally {
      setLogoUploading(false);
    }
  }, [uploadBrandAsset, push, readFileAsDataUrl]);

  const handleBrandImageFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBrandImageUploading(true);
    try {
      const url = await uploadBrandAsset(file, 'brand-image');
      setForm(prev => ({
        ...prev,
        brandImage: url,
        brandImageSource: 'upload',
        brandImageBadge: '',
      }));
      push('Brand image updated.', 'info');
    } catch (err) {
      console.error('Brand image upload failed', err);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setForm(prev => ({
          ...prev,
          brandImage: dataUrl,
          brandImageSource: 'upload',
          brandImageBadge: '',
        }));
        push(`${err?.message ? `${err.message}. ` : ''}Embedded the brand image inline for now.`, 'warning');
      } catch (readErr) {
        console.error('Brand image inline fallback failed', readErr);
        push(err?.message || 'Failed to upload brand image. Please try again.', 'error');
      }
    } finally {
      setBrandImageUploading(false);
    }
  }, [uploadBrandAsset, push, readFileAsDataUrl]);

  const handleBrandImageSourceChange = useCallback((value) => {
    setForm(prev => {
      if (prev.brandImageSource === value) return prev;
      const next = {
        ...prev,
        brandImageSource: value,
      };
      if (value === 'text' && !prev.brandImageText) {
        next.brandImageText = prev.storeName || DEFAULT_FORM.storeName;
      }
      if (value === 'text') {
        next.brandImage = '';
      }
      if (value === 'upload') {
        // Keep existing upload preview but clear inline generated if nothing else
        return next;
      }
      return next;
    });
  }, []);

  const handleBrandImageTextChange = useCallback((event) => {
    const value = event.target.value;
    setForm(prev => ({
      ...prev,
      brandImageText: value,
      brandImageSource: 'text',
    }));
  }, []);

  const handleBrandImageStyleSelect = useCallback((id) => {
    setForm(prev => ({
      ...prev,
      brandImageStyle: id,
      brandImageSource: prev.brandImageSource === 'text' ? 'text' : prev.brandImageSource,
    }));
  }, []);

  const handleBrandImageBadgeSelect = useCallback((id) => {
    setForm(prev => ({
      ...prev,
      brandImageBadge: prev.brandImageBadge === id ? '' : id,
      brandImageSource: 'text',
    }));
  }, []);

  const handleBrandImageShapeSelect = useCallback((shapeId) => {
    if (!shapeId) return;
    const normalized = String(shapeId).toLowerCase();
    if (!BRAND_IMAGE_SHAPE_IDS.has(normalized)) return;
    setForm(prev => {
      if (prev.brandImageShape === normalized) return prev;
      return {
        ...prev,
        brandImageShape: normalized,
      };
    });
  }, []);

  const handleClearLogo = useCallback(() => {
    setForm(prev => ({
      ...prev,
      systemLogo: '',
      systemLogoAlt: '',
    }));
  }, []);

  const handleClearBrandImage = useCallback(() => {
    setForm(prev => ({
      ...prev,
      brandImage: '',
    }));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.admin.systemSettings.list()
      .then(settings => {
        if (!active) return;
        const mapped = applySettingsToForm(settings);
        setForm(prev => ({ ...prev, ...mapped }));
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || 'Failed to load system settings');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const brandImageSource = form.brandImageSource || 'upload';
  const normalizedShape = typeof form.brandImageShape === 'string' ? form.brandImageShape.toLowerCase() : DEFAULT_BRAND_IMAGE_SHAPE;
  const brandImageShape = BRAND_IMAGE_SHAPE_IDS.has(normalizedShape) ? normalizedShape : DEFAULT_BRAND_IMAGE_SHAPE;
  const debouncedBrandText = useDebounce(form.brandImageText, 400);
  const debouncedBrandStyle = useDebounce(form.brandImageStyle, 150);
  const debouncedBrandBadge = useDebounce(form.brandImageBadge, 150);
  const debouncedBrandShape = useDebounce(brandImageShape, 150);

  useEffect(() => {
    if (brandImageSource !== 'text') {
      setBrandImageGenerating(false);
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }
    const trimmed = (debouncedBrandText || '').trim();
    if (!trimmed) {
      setBrandImageGenerating(false);
      setForm(prev => (prev.brandImage === '' ? prev : { ...prev, brandImage: '' }));
      return;
    }
    let cancelled = false;
    setBrandImageGenerating(true);
  const styleId = debouncedBrandStyle || BRAND_STYLE_PRESETS[0].id;
  const preset = findPreset(styleId);
  const badge = findBadge(debouncedBrandBadge);
  renderBrandImageFromPreset(trimmed, preset, { badge, shape: debouncedBrandShape })
      .then((dataUrl) => {
        if (cancelled) return;
        setForm(prev => (prev.brandImage === dataUrl ? prev : { ...prev, brandImage: dataUrl }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Brand image generation failed', err);
        push('Could not generate a brand image. Please try again.', 'error');
      })
      .finally(() => {
        if (cancelled) return;
        setBrandImageGenerating(false);
      });
    return () => { cancelled = true; };
  }, [brandImageSource, debouncedBrandText, debouncedBrandStyle, debouncedBrandBadge, debouncedBrandShape, findPreset, findBadge, push]);

  const logoPreview = (form.systemLogo || '').trim();
  const brandImagePreview = (form.brandImage || '').trim();

  const previewCurrency = useMemo(() => {
    try {
      return new Intl.NumberFormat(form.currencyLocale || 'en-KE', { style: 'currency', currency: form.currencyCode || 'KES' }).format(1250.5);
    } catch (e) {
      return `${form.currencySymbol || form.currencyCode || 'KES'} 1,250.50`;
    }
  }, [form.currencyCode, form.currencyLocale, form.currencySymbol]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const fieldType = FIELD_TYPES[name] ?? (type === 'checkbox' ? 'boolean' : 'string');

    setForm(prev => {
      if (fieldType === 'boolean') {
        return { ...prev, [name]: type === 'checkbox' ? checked : value === 'true' };
      }
      if (fieldType === 'number') {
        if (value === '') {
          return { ...prev, [name]: '' };
        }
        const numeric = Number(value);
        return { ...prev, [name]: Number.isFinite(numeric) ? numeric : prev[name] };
      }
      return { ...prev, [name]: value };
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = formToPayload(form);
    api.admin.systemSettings.save(payload)
      .then(() => {
        setSaving(false);
        push('System settings updated', 'info');
      })
      .catch(err => {
        setSaving(false);
        setError(err.message || 'Could not save settings');
      });
  }

  function handleRefreshCache() {
    if (refreshingCache) return;
    setError(null);
    setRefreshingCache(true);
    const refresher = api?.admin?.systemSettings?.refreshCache;
    const refreshPromise = typeof refresher === 'function'
      ? refresher()
      : Promise.reject(new Error('Cache refresh API is not available.'));

    refreshPromise
      .then(() => {
        push('Application cache refreshed successfully.', 'success');
      })
      .catch(err => {
        const message = err?.message || 'Failed to refresh cache';
        setError(message);
        push(message, 'danger');
      })
      .finally(() => {
        setRefreshingCache(false);
      });
  }

  return (
    <section className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">System Settings</h1>
          <p className="text-muted mb-0">Update global preferences that affect the storefront experience.</p>
        </div>
      </div>
      <div className="card border-0 shadow-sm">
        <form onSubmit={handleSubmit} className="card-body d-flex flex-column gap-4">
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <fieldset disabled={loading || saving} className="d-flex flex-column gap-4">
            <section>
              <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 p-3 border rounded-3 bg-body-secondary bg-opacity-25">
                <div>
                  <h2 className="h6 mb-1">Cache controls</h2>
                  <p className="text-muted small mb-0">Refresh application cache to pull the latest configuration and branding updates into the storefront.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
                  onClick={handleRefreshCache}
                  disabled={refreshingCache || loading || saving}
                >
                  {refreshingCache ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Refreshing…</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-repeat"></i>
                      <span>Refresh cache</span>
                    </>
                  )}
                </button>
              </div>
            </section>
            <AdminCollapsibleSection
              title="Store identity"
              description="Shown in the navigation bar, emails and invoices."
              rememberState
              persistKey="admin:system-settings:store-identity"
            >
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="storeName">Store name</label>
                  <input id="storeName" name="storeName" type="text" className="form-control" value={form.storeName} onChange={handleChange} required />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="brandNameScale">Site name size</label>
                  <div className="d-flex flex-column gap-2">
                    <input
                      id="brandNameScale"
                      name="brandNameScale"
                      type="range"
                      className="form-range"
                      min="0.6"
                      max="1.8"
                      step="0.05"
                      value={form.brandNameScale ?? 1}
                      onChange={handleChange}
                    />
                    <div className="d-flex justify-content-between align-items-center small text-muted">
                      <span>{Math.round((form.brandNameScale ?? 1) * 100)}%</span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0"
                        onClick={() => setForm(prev => ({ ...prev, brandNameScale: DEFAULT_FORM.brandNameScale }))}
                        disabled={(form.brandNameScale ?? 1) === DEFAULT_FORM.brandNameScale}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <p className="form-text">Controls the navigation brand text size for better alignment with uploaded logos.</p>
                </div>
                <div className="col-12 col-md-6">
                  <div className="form-check mt-md-5 pt-md-1">
                    <input className="form-check-input" type="checkbox" id="showBrandName" name="showBrandName" checked={!!form.showBrandName} onChange={handleChange} />
                    <label className="form-check-label" htmlFor="showBrandName">Display brand name next to the logo</label>
                    <p className="form-text small mb-0">Turn this off to show only the brand image in the storefront navigation.</p>
                  </div>
                </div>
                <div className="col-12">
                  <div className="row g-3">
                    <div className="col-12 col-xl-6">
                      <div className="p-3 border rounded-3 h-100 bg-body-secondary bg-opacity-25">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <h3 className="h6 mb-1">System logo</h3>
                            <p className="text-muted small mb-0">Displayed in the storefront navigation and customer emails.</p>
                          </div>
                          {logoUploading && (
                            <div className="spinner-border spinner-border-sm text-success" role="status" aria-label="Uploading logo"></div>
                          )}
                        </div>
                        <div className="brand-preview border bg-white rounded-3 d-flex align-items-center justify-content-center mb-3 position-relative overflow-hidden" style={{ minHeight: '140px' }}>
                          {logoPreview ? (
                            <img src={logoPreview} alt={form.systemLogoAlt || 'Store logo preview'} style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }} />
                          ) : (
                            <span className="text-muted small">No logo uploaded yet.</span>
                          )}
                        </div>
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                          <label className="btn btn-outline-primary btn-sm mb-0">
                            <span className="d-inline-flex align-items-center gap-1">
                              <i className="bi bi-upload"></i>
                              <span>{logoUploading ? 'Uploading…' : 'Upload logo'}</span>
                            </span>
                            <input type="file" accept="image/*" onChange={handleLogoFileChange} hidden aria-label="Upload system logo" />
                          </label>
                          {logoPreview && (
                            <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleClearLogo} disabled={logoUploading}>
                              <i className="bi bi-trash"></i>
                              <span className="ms-1">Remove</span>
                            </button>
                          )}
                        </div>
                        <div className="mt-3">
                          <label className="form-label small text-muted" htmlFor="systemLogoAlt">Logo alt text</label>
                          <input id="systemLogoAlt" name="systemLogoAlt" type="text" className="form-control form-control-sm" value={form.systemLogoAlt} onChange={handleChange} placeholder="Accessible description for screen readers" />
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-xl-6">
                      <div className="p-3 border rounded-3 h-100 bg-body-secondary bg-opacity-25">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <h3 className="h6 mb-1">Brand image</h3>
                            <p className="text-muted small mb-0">Use an uploaded image or auto-generate stylised artwork from text.</p>
                          </div>
                          {(brandImageUploading || brandImageGenerating) && (
                            <div className="spinner-border spinner-border-sm text-success" role="status" aria-label="Processing brand image"></div>
                          )}
                        </div>
                        <div
                          className={`brand-preview border bg-white rounded-3 mb-3 position-relative overflow-hidden brand-preview--shape-${brandImageShape} brand-shape-surface`}
                          style={{ minHeight: '160px' }}
                          data-shape={brandImageShape}
                        >
                          {(brandImageUploading || (brandImageGenerating && brandImageSource === 'text')) && (
                            <div className="position-absolute top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center bg-body bg-opacity-50">
                              <div className="spinner-border text-success" role="status" aria-label="Rendering brand image"></div>
                            </div>
                          )}
                          {brandImagePreview ? (
                            <img
                              src={brandImagePreview}
                              alt="Brand image preview"
                              className={`brand-preview-image brand-preview-image--${brandImageShape} brand-shape-surface`}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              data-shape={brandImageShape}
                            />
                          ) : (
                            <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted text-center px-3 small">
                              {brandImageSource === 'text' ? 'Enter a brand phrase and pick a style to generate artwork.' : 'No brand image uploaded yet.'}
                            </div>
                          )}
                        </div>
                        <div className="brand-shape-selector mb-3">
                          <span className="form-label small text-muted d-block mb-2">Brand image shape</span>
                          <div className="row g-2" role="list">
                            {BRAND_IMAGE_SHAPES.map((shapeOption) => {
                              const isActive = brandImageShape === shapeOption.id;
                              return (
                                <div className="col-6 col-lg-4" key={shapeOption.id} role="listitem">
                                  <button
                                    type="button"
                                    className={`brand-shape-option btn btn-outline-secondary w-100 text-start${isActive ? ' active' : ''}`}
                                    onClick={() => handleBrandImageShapeSelect(shapeOption.id)}
                                    aria-pressed={isActive}
                                  >
                                    <span className={`brand-shape-swatch brand-shape-swatch--${shapeOption.id} mb-2`} aria-hidden="true">
                                      <span className="brand-shape-swatch-inner brand-shape-surface" data-shape={shapeOption.id}></span>
                                    </span>
                                    <span className="d-block fw-semibold small">{shapeOption.label}</span>
                                    <span className="d-block text-muted small">{shapeOption.description}</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="btn-group w-100 mb-3" role="group" aria-label="Brand image source">
                          <input type="radio" className="btn-check" name="brandImageSource" id="brandImageSourceUpload" value="upload" checked={brandImageSource === 'upload'} onChange={() => handleBrandImageSourceChange('upload')} />
                          <label className="btn btn-outline-secondary" htmlFor="brandImageSourceUpload">Upload image</label>
                          <input type="radio" className="btn-check" name="brandImageSource" id="brandImageSourceText" value="text" checked={brandImageSource === 'text'} onChange={() => handleBrandImageSourceChange('text')} />
                          <label className="btn btn-outline-secondary" htmlFor="brandImageSourceText">Generate from text</label>
                        </div>
                        {brandImageSource === 'upload' ? (
                          <div className="d-flex flex-wrap gap-2">
                            <label className="btn btn-outline-primary btn-sm mb-0">
                              <span className="d-inline-flex align-items-center gap-1">
                                <i className="bi bi-upload"></i>
                                <span>{brandImageUploading ? 'Uploading…' : 'Upload brand image'}</span>
                              </span>
                              <input type="file" accept="image/*" onChange={handleBrandImageFileChange} hidden aria-label="Upload brand image" />
                            </label>
                            {brandImagePreview && (
                              <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleClearBrandImage} disabled={brandImageUploading}>
                                <i className="bi bi-trash"></i>
                                <span className="ms-1">Remove</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="vstack gap-3">
                            <div>
                              <label className="form-label small text-muted" htmlFor="brandImageText">Brand text</label>
                              <input id="brandImageText" type="text" className="form-control" value={form.brandImageText} onChange={handleBrandImageTextChange} placeholder="e.g. KenSuper Fresh" maxLength={48} />
                              <p className="form-text small text-muted mb-0">We render this text into artwork using the selected style.</p>
                            </div>
                            <div className="row g-2">
                              {BRAND_STYLE_PRESETS.map(preset => {
                                const isActive = form.brandImageStyle === preset.id;
                                const previewStyle = getPresetPreviewStyle(preset);
                                const sampleText = (form.brandImageText || form.storeName || 'Your Brand').slice(0, 18) || 'Brand';
                                return (
                                  <div className="col-12 col-sm-6" key={preset.id}>
                                    <button type="button" className={`brand-style-option btn btn-outline-secondary w-100 text-start${isActive ? ' active' : ''}`} onClick={() => handleBrandImageStyleSelect(preset.id)}>
                                      <div className="brand-style-swatch rounded-3 mb-2" style={previewStyle}>
                                        <span className="brand-style-text fw-semibold">{preset.uppercase ? sampleText.toUpperCase() : sampleText}</span>
                                      </div>
                                      <span className="d-block fw-semibold small">{preset.label}</span>
                                      <span className="d-block text-muted small">{preset.description}</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            <div>
                              <div className="d-flex align-items-center justify-content-between mt-3 mb-2">
                                <span className="form-label small text-muted mb-0">E-commerce badge overlay</span>
                                {form.brandImageBadge && (
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm p-0 text-decoration-none"
                                    onClick={() => handleBrandImageBadgeSelect(form.brandImageBadge)}
                                  >
                                    <i className="bi bi-x-circle me-1"></i>
                                    Remove badge
                                  </button>
                                )}
                              </div>
                              <p className="form-text small text-muted">Optional accent to make the artwork feel more shoppable.</p>
                              <div className="row g-2" role="list">
                                {ECOMMERCE_BADGES.map((badge) => {
                                  const isActive = form.brandImageBadge === badge.id;
                                  return (
                                    <div className="col-6 col-md-4 col-lg-3" key={badge.id} role="listitem">
                                      <button
                                        type="button"
                                        className={`brand-badge-option btn btn-outline-secondary w-100 text-start${isActive ? ' active' : ''}`}
                                        onClick={() => handleBrandImageBadgeSelect(badge.id)}
                                        aria-pressed={isActive}
                                      >
                                        <span className="brand-badge-thumb rounded-3 mb-2">
                                          <img src={getBadgePreviewSrc(badge)} alt={`${badge.label} badge preview`} loading="lazy" />
                                        </span>
                                        <span className="d-block fw-semibold small">{badge.label}</span>
                                        <span className="d-block text-muted small">{badge.description}</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AdminCollapsibleSection>

            <AdminCollapsibleSection
              title="Currency"
              description="Controls how amounts are displayed across the app."
              rememberState
              persistKey="admin:system-settings:currency"
            >
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="currencyCode">Currency code</label>
                  <input id="currencyCode" name="currencyCode" type="text" className="form-control" value={form.currencyCode} onChange={handleChange} required maxLength={8} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="currencySymbol">Currency symbol</label>
                  <input id="currencySymbol" name="currencySymbol" type="text" className="form-control" value={form.currencySymbol} onChange={handleChange} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="currencyLocale">Locale</label>
                  <input id="currencyLocale" name="currencyLocale" type="text" className="form-control" value={form.currencyLocale} onChange={handleChange} placeholder="e.g. en-KE" />
                </div>
              </div>
              <p className="small text-muted mt-2 mb-0">Preview: <strong>{previewCurrency}</strong></p>
            </AdminCollapsibleSection>

            <AdminCollapsibleSection
              title="Theme"
              description="Set the default appearance for new visitors."
              rememberState
              persistKey="admin:system-settings:theme"
            >
              <div className="row g-3 align-items-center">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="defaultTheme">Default theme</label>
                  <select id="defaultTheme" name="defaultTheme" className="form-select" value={form.defaultTheme} onChange={handleChange}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <div className="form-check form-switch mt-4">
                    <input className="form-check-input" type="checkbox" id="enableDarkMode" name="enableDarkMode" checked={form.enableDarkMode} onChange={handleChange} />
                    <label className="form-check-label" htmlFor="enableDarkMode">Allow users to toggle dark mode</label>
                  </div>
                </div>
              </div>
            </AdminCollapsibleSection>

            <AdminCollapsibleSection
              title="Operational alerts"
              description="Fine-tune when admins get notified about inventory levels and order activity."
              rememberState
              persistKey="admin:system-settings:operational-alerts"
            >
              <div className="row g-3">
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="lowStockThreshold">Low stock threshold</label>
                  <input
                    id="lowStockThreshold"
                    name="lowStockThreshold"
                    type="number"
                    min={0}
                    step={1}
                    className="form-control"
                    value={form.lowStockThreshold ?? ''}
                    onChange={handleChange}
                    required
                  />
                  <p className="form-text small">We alert when product inventory drops to or below this quantity.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="orderDelayAlertHours">Order delay alert</label>
                  <div className="input-group">
                    <input
                      id="orderDelayAlertHours"
                      name="orderDelayAlertHours"
                      type="number"
                      min={1}
                      step={1}
                      className="form-control"
                      value={form.orderDelayAlertHours ?? ''}
                      onChange={handleChange}
                      required
                    />
                    <span className="input-group-text">hours</span>
                  </div>
                  <p className="form-text small">Orders older than this without fulfilment will raise a delay alert.</p>
                </div>
                <div className="col-12 col-sm-6 col-lg-4">
                  <label className="form-label" htmlFor="orderHighValueThreshold">High value alert</label>
                  <div className="input-group">
                    <span className="input-group-text">{form.currencySymbol || form.currencyCode}</span>
                    <input
                      id="orderHighValueThreshold"
                      name="orderHighValueThreshold"
                      type="number"
                      min={0}
                      step={100}
                      className="form-control"
                      value={form.orderHighValueThreshold ?? ''}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <p className="form-text small">Trigger a notification when an order total meets or exceeds this amount.</p>
                </div>
              </div>
            </AdminCollapsibleSection>

          </fieldset>
          <div className="d-flex justify-content-end gap-2">
            <button type="reset" className="btn btn-outline-secondary" onClick={() => setForm(DEFAULT_FORM)} disabled={loading || saving}>Reset</button>
            <button type="submit" className="btn btn-success" disabled={loading || saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> : null}
              Save settings
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function applySettingsToForm(settings) {
  if (!Array.isArray(settings)) return {};
  const fieldByKey = Object.entries(KEY_MAP).reduce((acc, [field, key]) => {
    acc[key] = field;
    return acc;
  }, {});

  const map = {};
  for (const setting of settings) {
    const field = fieldByKey[setting.key];
    if (!field) continue;
    const fieldType = FIELD_TYPES[field] ?? 'string';
    const fallback = DEFAULT_FORM[field];
    const rawValue = Object.prototype.hasOwnProperty.call(setting, 'value') ? setting.value : fallback;

    let value = fallback;
    if (fieldType === 'number') {
      const numeric = Number(rawValue);
      value = Number.isFinite(numeric) ? numeric : Number(fallback ?? 0);
    } else if (fieldType === 'boolean') {
      if (typeof rawValue === 'boolean') {
        value = rawValue;
      } else if (typeof rawValue === 'number') {
        value = rawValue !== 0;
      } else if (typeof rawValue === 'string') {
        const normalized = rawValue.toLowerCase();
        value = ['true', '1', 'yes', 'on'].includes(normalized);
      } else {
        value = Boolean(rawValue);
      }
    } else {
      value = rawValue ?? fallback ?? '';
    }

    map[field] = value;
  }
  if (!map.brandImageSource) {
    if (typeof map.brandImage === 'string' && map.brandImage.startsWith('data:image/')) {
      map.brandImageSource = 'text';
    } else {
      map.brandImageSource = DEFAULT_FORM.brandImageSource;
    }
  }
  if (!map.brandImageStyle) {
    map.brandImageStyle = DEFAULT_FORM.brandImageStyle;
  }
  if (typeof map.brandImageText !== 'string') {
    map.brandImageText = DEFAULT_FORM.brandImageText;
  }
  if (typeof map.systemLogoAlt !== 'string') {
    map.systemLogoAlt = '';
  }
  if (typeof map.brandImageBadge !== 'string') {
    map.brandImageBadge = DEFAULT_FORM.brandImageBadge;
  }
  if (typeof map.brandImageShape === 'string') {
    const normalized = map.brandImageShape.toLowerCase();
    map.brandImageShape = BRAND_IMAGE_SHAPE_IDS.has(normalized) ? normalized : DEFAULT_FORM.brandImageShape;
  } else {
    map.brandImageShape = DEFAULT_FORM.brandImageShape;
  }
  if (typeof map.brandNameScale !== 'number' || Number.isNaN(map.brandNameScale)) {
    map.brandNameScale = DEFAULT_FORM.brandNameScale;
  } else {
    map.brandNameScale = Math.min(Math.max(map.brandNameScale, 0.6), 1.8);
  }
  if (typeof map.showBrandName !== 'boolean') {
    map.showBrandName = DEFAULT_FORM.showBrandName;
  }
  return map;
}

function formToPayload(form) {
  return Object.entries(KEY_MAP).map(([field, key]) => {
    const fieldType = FIELD_TYPES[field] ?? 'string';
    const fallback = DEFAULT_FORM[field];
    let value = form[field];

    if (fieldType === 'number') {
      if (value === '' || value === null || value === undefined) {
        value = Number(fallback ?? 0);
      } else {
        const numeric = Number(value);
        value = Number.isFinite(numeric) ? numeric : Number(fallback ?? 0);
      }
    } else if (fieldType === 'boolean') {
      value = Boolean(value);
    } else {
      value = value ?? '';
    }

    if (field === 'brandImageSource') {
      const normalized = String(value || '').toLowerCase();
      value = ['text', 'upload'].includes(normalized) ? normalized : DEFAULT_FORM.brandImageSource;
    }
    if (field === 'brandImageShape') {
      const normalized = String(value || '').toLowerCase();
      value = BRAND_IMAGE_SHAPE_IDS.has(normalized) ? normalized : DEFAULT_FORM.brandImageShape;
    }
    if (field === 'brandNameScale') {
      value = Math.min(Math.max(Number(value) || DEFAULT_FORM.brandNameScale, 0.6), 1.8);
    }

    return {
      key,
      type: fieldType === 'number' ? 'number' : fieldType === 'boolean' ? 'boolean' : 'string',
      value,
    };
  });
}
