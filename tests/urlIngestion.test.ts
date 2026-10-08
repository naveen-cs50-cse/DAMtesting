import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndNormalizeUrl,
  isPrivateOrReservedIp,
  verifyHostSafety,
  analyzeDomainRisk,
  extractHtmlContent,
  extractFactualClaims,
  detectSocialPlatform,
  ingestUrlSecurely
} from '../lib/investigation/urlIngestion';

test('URL Ingestion: validateAndNormalizeUrl permits only HTTP and HTTPS', () => {
  // Valid URLs
  const valid1 = validateAndNormalizeUrl('https://pib.gov.in/PressReleasePage.aspx?PRID=123456');
  assert.equal(valid1.url, 'https://pib.gov.in/PressReleasePage.aspx?PRID=123456');
  assert.equal(valid1.domain, 'pib.gov.in');

  const valid2 = validateAndNormalizeUrl('http://example.com/page');
  assert.equal(valid2.url, 'http://example.com/page');

  // Strip tracking parameters
  const withTracking = validateAndNormalizeUrl('https://example.com/news?id=42&utm_source=twitter&utm_medium=social');
  assert.equal(withTracking.url, 'https://example.com/news?id=42');

  // Reject unsupported protocols
  assert.throws(
    () => validateAndNormalizeUrl('file:///etc/passwd'),
    /Disallowed protocol "file:"/
  );
  assert.throws(
    () => validateAndNormalizeUrl('ftp://ftp.example.com/file.zip'),
    /Disallowed protocol "ftp:"/
  );
  assert.throws(
    () => validateAndNormalizeUrl('javascript:alert(1)'),
    /Disallowed protocol "javascript:"/
  );
  assert.throws(
    () => validateAndNormalizeUrl('data:text/html,<html></html>'),
    /Disallowed protocol "data:"/
  );

  // Reject embedded credentials
  assert.throws(
    () => validateAndNormalizeUrl('https://admin:secret@example.com/dashboard'),
    /embedded user credentials/
  );
});

test('URL Ingestion: isPrivateOrReservedIp detects all private, loopback, and metadata ranges', () => {
  // IPv4 Loopback
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('127.255.255.255'), true);

  // IPv4 Private Class A, B, C
  assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.254.1.1'), true);
  assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
  assert.equal(isPrivateOrReservedIp('172.31.255.254'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
  assert.equal(isPrivateOrReservedIp('192.168.0.254'), true);

  // Cloud Metadata & Link-Local (169.254.x)
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('169.254.1.1'), true);

  // Current network (0.0.0.0) & Broadcast
  assert.equal(isPrivateOrReservedIp('0.0.0.0'), true);
  assert.equal(isPrivateOrReservedIp('255.255.255.255'), true);

  // Public IPv4 (should return false)
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
  assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);
  assert.equal(isPrivateOrReservedIp('164.100.158.135'), false); // PIB

  // IPv6 Loopback & Unspecified
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('::'), true);

  // IPv6 Unique Local (fc00::/7) & Link-local (fe80::/10)
  assert.equal(isPrivateOrReservedIp('fc00::1'), true);
  assert.equal(isPrivateOrReservedIp('fd12:3456::1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);

  // IPv4-mapped IPv6
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:192.168.1.1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:8.8.8.8'), false);
});

test('URL Ingestion: verifyHostSafety defends against SSRF, internal hostnames, and IP evasions', async () => {
  // Localhost names
  await assert.rejects(
    () => verifyHostSafety('localhost'),
    /SSRF blocked: Access to internal host "localhost"/
  );
  await assert.rejects(
    () => verifyHostSafety('app.localhost'),
    /SSRF blocked: Access to internal host "app.localhost"/
  );
  await assert.rejects(
    () => verifyHostSafety('metadata.google.internal'),
    /SSRF blocked/
  );

  // Decimal IP evasion (2130706433 = 127.0.0.1)
  await assert.rejects(
    () => verifyHostSafety('2130706433'),
    /SSRF blocked: Integer host decoded to private IP 127.0.0.1/
  );

  // Hex / Octal IP evasions
  await assert.rejects(
    () => verifyHostSafety('0x7f000001'),
    /SSRF blocked/
  );

  // Direct private IP
  await assert.rejects(
    () => verifyHostSafety('192.168.1.1'),
    /SSRF blocked: Direct connection to private\/reserved IP/
  );
  await assert.rejects(
    () => verifyHostSafety('169.254.169.254'),
    /SSRF blocked: Direct connection to private\/reserved IP/
  );
});

test('URL Ingestion: analyzeDomainRisk detects Punycode, Cyrillic homoglyphs, and deceptive subdomains', () => {
  // 1. Punycode domain
  const punycodeRes = analyzeDomainRisk('xn--sbi-9o0a.com');
  assert.equal(punycodeRes.isPunycode, true);
  assert.ok(punycodeRes.warnings.some(w => w.includes('Punycode')));

  // 2. Homoglyph with Cyrillic 'а' (U+0430) mixed with Latin 'sbi'
  const homoglyphRes = analyzeDomainRisk('sbi-\u0430lert.com');
  assert.equal(homoglyphRes.hasHomoglyphs, true);
  assert.equal(homoglyphRes.riskLevel, 'High');

  // 3. Deceptive subdomain (official domain inside third-party subdomain)
  const deceptiveRes = analyzeDomainRisk('sbi.co.in.attacker-portal.net');
  assert.equal(deceptiveRes.isDeceptiveSubdomain, true);
  assert.equal(deceptiveRes.riskLevel, 'High');

  // 4. Typosquatting / Impersonation of Indian Institution
  const typosquatRes = analyzeDomainRisk('sbi-yono-update.in');
  assert.ok(typosquatRes.typosquatTarget?.includes('State Bank of India'));
  assert.equal(typosquatRes.riskLevel, 'Medium');

  // 5. Genuine institutional domain
  const cleanRes = analyzeDomainRisk('sbi.co.in');
  assert.equal(cleanRes.riskLevel, 'Low');
  assert.equal(cleanRes.isPunycode, false);
  assert.equal(cleanRes.hasHomoglyphs, false);
});

test('URL Ingestion: extractHtmlContent and extractFactualClaims parse text, metadata, and download links', () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>PIB Fact Check: Clarification on Banknotes</title>
        <link rel="canonical" href="https://pib.gov.in/clarification">
        <meta name="author" content="PIB Fact Check Unit">
        <meta property="article:published_time" content="2026-05-12T10:00:00Z">
      </head>
      <body>
        <nav><a href="/home">Home</a></nav>
        <main>
          <h1>Official Press Release</h1>
          <p>The Reserve Bank of India has issued Notification No. RBI/2026/04 confirming that ₹500 banknotes remain legal tender.</p>
          <p>Reports claiming demonetization of ₹500 notes from June 2026 are fake and baseless.</p>
          <p>Citizens can report fake news on our WhatsApp helpline or download the advisory notice here: <a href="/files/advisory.pdf">PDF Notice</a></p>
          <p>Beware of malicious APK files circulating on messaging apps: <a href="http://scam-site.com/rbi-update.apk">Download APK</a></p>
        </main>
        <footer><p>&copy; 2026 Government of India</p></footer>
      </body>
    </html>
  `;

  const extracted = extractHtmlContent(html, 'https://pib.gov.in');
  assert.equal(extracted.title, 'PIB Fact Check: Clarification on Banknotes');
  assert.equal(extracted.canonicalUrl, 'https://pib.gov.in/clarification');
  assert.equal(extracted.author, 'PIB Fact Check Unit');
  assert.ok(extracted.publishedDate?.includes('2026-05-12'));
  assert.ok(extracted.visibleText.includes('₹500 banknotes remain legal tender'));
  assert.ok(!extracted.visibleText.includes('Home')); // Nav was stripped

  // Download link detection
  assert.ok(extracted.downloadLinks.some(l => l.includes('.apk')));

  // Factual claim extraction
  const claims = extractFactualClaims(extracted.visibleText);
  assert.ok(claims.length > 0);
  assert.ok(claims.some(c => c.includes('Notification No. RBI/2026/04') || c.includes('₹500 banknotes')));
});

test('URL Ingestion: detectSocialPlatform identifies Twitter, Reddit, YouTube, Telegram', () => {
  assert.deepEqual(detectSocialPlatform('twitter.com'), { isSocialPost: true, platform: 'twitter' });
  assert.deepEqual(detectSocialPlatform('x.com'), { isSocialPost: true, platform: 'twitter' });
  assert.deepEqual(detectSocialPlatform('reddit.com'), { isSocialPost: true, platform: 'reddit' });
  assert.deepEqual(detectSocialPlatform('youtube.com'), { isSocialPost: true, platform: 'youtube' });
  assert.deepEqual(detectSocialPlatform('t.me'), { isSocialPost: true, platform: 'telegram' });
  assert.deepEqual(detectSocialPlatform('example.com'), { isSocialPost: false });
});

test('URL Ingestion: ingestUrlSecurely blocks SSRF attempts safely without crashing', async () => {
  // Test local SSRF blocking
  const res1 = await ingestUrlSecurely('http://127.0.0.1:8080/internal-api');
  assert.equal(res1.status, 'ssrf_blocked');
  assert.ok(res1.errorDetails?.includes('SSRF blocked'));

  const res2 = await ingestUrlSecurely('http://169.254.169.254/latest/meta-data/');
  assert.equal(res2.status, 'ssrf_blocked');
  assert.ok(res2.errorDetails?.includes('SSRF blocked'));

  const res3 = await ingestUrlSecurely('http://localhost/admin');
  assert.equal(res3.status, 'ssrf_blocked');
  assert.ok(res3.errorDetails?.includes('SSRF blocked'));
});
