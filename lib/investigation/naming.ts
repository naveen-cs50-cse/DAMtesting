/**
 * Smart conversation title generator for UseDAM.
 * Derives professional, concise case titles from user queries and investigation metadata.
 */
export function generateSmartTitle(prompt: string, meta?: any): string {
  const p = (prompt || '').trim();
  if (!p) return 'India Regulatory Investigation';

  // 1. Check metadata claims first if available
  if (meta?.claims && Array.isArray(meta.claims) && meta.claims.length > 0) {
    const firstClaim = meta.claims[0].claim;
    if (firstClaim && firstClaim.length <= 44) {
      return firstClaim;
    }
  }

  // 2. High-precision pattern matching for common Indian threat vectors & circulars
  if (/electricity.*(?:disconnect|power|bill|cut|officer|tonight)/i.test(p)) {
    return 'Electricity Bill Disconnection Threat';
  }
  if (/(?:yono|sbi|hdfc|icici|axis|pnb|canara|bank).*apk/i.test(p) || /apk.*(?:susp|pan|kyc|reward)/i.test(p)) {
    return 'Malicious Banking APK Notice';
  }
  if (/trai|dot.*(?:block|disconnect|deactivat|illegal|advertising)/i.test(p)) {
    return 'TRAI / DoT Mobile Number Threat';
  }
  if (/pm\s*kisan|kanya|ayush|subsidy|yojana|scheme.*(?:bonus|free|claim)/i.test(p)) {
    return 'PM Scheme / Subsidy Verification';
  }
  if (/(?:demonetiz|withdraw|ban|500.*(?:note|banknote)|currency)/i.test(p)) {
    return 'RBI ₹500 Note Withdrawal Claim';
  }
  if (/challan|traffic.*(?:fine|camera|e-challan)|parivahan.*apk/i.test(p)) {
    return 'Traffic E-Challan Fake Notice';
  }
  if (/digital\s*arrest|cbi|customs|narcotics|police\s*extortion|video\s*call/i.test(p)) {
    return 'Digital Arrest / CBI Extortion Call';
  }
  if (/kyc.*(?:block|suspend|update|expire)/i.test(p)) {
    return 'Bank Account KYC Deactivation Alert';
  }
  if (/cert-in|advisory|banking\s*trojan|malware/i.test(p)) {
    return 'CERT-In Android Trojan Advisory';
  }
  if (/gazette|notification|ministry.*order/i.test(p)) {
    return 'Official Gazette Notification Review';
  }

  // 3. Fallback: Clean conversational filler words
  let cleaned = p
    .replace(/^["'“”‘’]|["'“”‘’]$/g, '')
    .replace(/^(?:fact-check|check|verify|assess|investigate|is this genuine|is this real|review|please check)(?:\s+this)?(?:\s+(?:claim|message|forward|notification|notice|order|sms|call|post|link))?[:\s]*/i, '')
    .replace(/^["'“”‘’]|["'“”‘’]$/g, '')
    .trim();

  // Strip inner quoted wrappers: e.g. 'Dear consumer, ...'
  if (cleaned.startsWith("'") || cleaned.startsWith('"')) {
    cleaned = cleaned.replace(/^["']|["']$/g, '');
  }

  if (cleaned.length > 44) {
    cleaned = cleaned.slice(0, 42).trim() + '…';
  }

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned || 'India Regulatory Investigation';
}
