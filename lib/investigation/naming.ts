/**
 * Smart conversation title generator for UseDAM.
 * Derives professional, concise case titles from the submitted user query.
 */
export function generateSmartTitle(prompt: string, meta?: import('./types').InvestigationMeta | null): string {
  const p = (prompt || '').trim();
  if (!p) return 'India Regulatory Investigation';

  // Titles are intentionally derived from the submitted prompt, not asynchronous
  // response metadata. This keeps a late or stale response from renaming another case.
  void meta;

  // 1. High-precision pattern matching for common Indian threat vectors & circulars
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
  if (/income\s*tax|tax\s*refund|refund.*(?:cvv|bank\s+account|debit\s+card)/i.test(p)) {
    return 'Income Tax Refund Phishing Alert';
  }
  if (
    /\b500\s*(?:rupee\s*)?(?:note|banknote)s?\b/i.test(p) ||
    (/\b(?:demonetiz(?:e|ed|ation)?|withdraw(?:n|al)?|ban(?:ned)?)\b/i.test(p) && /\b(?:500|banknote|currency)\b/i.test(p))
  ) {
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

  // 2. Fallback: Clean conversational filler words
  let cleaned = p
    .replace(/^["'“”‘’]|["'“”‘’]$/g, '')
    .replace(/^(?:please\s+)?(?:fact-check|check|verify|assess|investigate|is this genuine|is this real|review)(?:\s+this)?(?:\s+(?:claim|message|forward|notification|notice|order|sms|call|post|link|if this))?[:\s]*/i, '')
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
