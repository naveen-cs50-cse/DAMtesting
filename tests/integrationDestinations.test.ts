import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWhatsAppDestination, normalizeWhatsAppNumber, resolvePublicIntegrationStatus, validateChromeExtensionListing } from '../lib/integrations/destinations';

test('normalizes a configured WhatsApp number and builds one exact destination', () => {
  assert.equal(normalizeWhatsAppNumber('+91 (98765) 43210'), '919876543210');
  assert.equal(buildWhatsAppDestination('+91 (98765) 43210'), 'https://wa.me/919876543210?text=Hi%20DAM%2C%20please%20verify%20this%20claim');
  assert.equal(normalizeWhatsAppNumber('not-a-number'), null);
  assert.equal(buildWhatsAppDestination('123'), null);
});

test('accepts only an exact Chrome Web Store extension listing', () => {
  const listing = 'https://chromewebstore.google.com/detail/dam-check/abcdefghijklmnopabcdefghijklmnop';
  assert.equal(validateChromeExtensionListing(listing), listing);
  assert.equal(validateChromeExtensionListing('https://chromewebstore.google.com'), null);
  assert.equal(validateChromeExtensionListing('https://example.com/detail/dam/abcdefghijklmnopabcdefghijklmnop'), null);
});

test('reports configured and missing integration states without inventing destinations', () => {
  const missing = resolvePublicIntegrationStatus({});
  assert.deepEqual(missing.whatsapp, { status: 'not_configured', destination: null, displayNumber: null });
  assert.deepEqual(missing.extension, { status: 'not_configured', destination: null });

  const configured = resolvePublicIntegrationStatus({
    DAM_WHATSAPP_BOT_NUMBER: '+91 98765 43210',
    DAM_CHROME_EXTENSION_URL: 'https://chromewebstore.google.com/detail/dam-check/abcdefghijklmnopabcdefghijklmnop',
  });
  assert.equal(configured.whatsapp.status, 'configured');
  assert.match(configured.whatsapp.destination || '', /^https:\/\/wa\.me\/919876543210\?/);
  assert.equal(configured.extension.status, 'configured');
});
