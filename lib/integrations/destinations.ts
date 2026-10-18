export type IntegrationAvailability = 'configured' | 'not_configured';

export interface PublicIntegrationStatus {
  whatsapp: { status: IntegrationAvailability; destination: string | null; displayNumber: string | null };
  extension: { status: IntegrationAvailability; destination: string | null };
}

export const WHATSAPP_GREETING = 'Hi DAM, please verify this claim';

export function normalizeWhatsAppNumber(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function buildWhatsAppDestination(value: string | undefined, message = WHATSAPP_GREETING): string | null {
  const number = normalizeWhatsAppNumber(value);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export function validateChromeExtensionListing(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'chromewebstore.google.com') return null;
    if (!/^\/detail\/(?:[^/]+\/)?[a-p]{32}\/?$/.test(url.pathname)) return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function resolvePublicIntegrationStatus(env: Record<string, string | undefined>): PublicIntegrationStatus {
  const rawNumber = env.DAM_WHATSAPP_BOT_NUMBER || env.NEXT_PUBLIC_DAM_WHATSAPP_BOT_NUMBER;
  const whatsappDestination = buildWhatsAppDestination(rawNumber);
  const whatsappNumber = normalizeWhatsAppNumber(rawNumber);
  const extensionDestination = validateChromeExtensionListing(env.DAM_CHROME_EXTENSION_URL || env.NEXT_PUBLIC_DAM_CHROME_EXTENSION_URL);
  return {
    whatsapp: { status: whatsappDestination ? 'configured' : 'not_configured', destination: whatsappDestination, displayNumber: whatsappNumber ? `+${whatsappNumber}` : null },
    extension: { status: extensionDestination ? 'configured' : 'not_configured', destination: extensionDestination },
  };
}
