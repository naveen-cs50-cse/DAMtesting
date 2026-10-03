import Link from 'next/link';

export const metadata = {
  title: 'How DAM Verifies Evidence — India Regulatory & Scam Protocol',
  description: 'Methodology documentation explaining UseDAM zero-hallucination verification standards.',
};

export default function HowDamVerifiesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--dam-bg-root, #09090b)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', background: 'var(--dam-bg-panel, #131317)', border: '1px solid var(--dam-border-default, #2d2d34)', borderRadius: 'var(--radius-lg, 16px)', padding: '36px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dam-border-subtle, #202025)', paddingBottom: 20, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/assets/dam-mark-transparent.png" alt="DAM" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--dam-text-primary, #f8f8fc)' }}>How DAM Verifies Evidence</h1>
              <small style={{ color: 'var(--dam-text-muted, #9c9ca8)' }}>India Regulatory &amp; Scam Detection Protocol v2.4</small>
            </div>
          </div>
          <Link href="/investigate" className="quiet-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <span>&larr; Back to Workspace</span>
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, lineHeight: 1.7, color: 'var(--dam-text-secondary, #c5c5cf)' }}>
          <section>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--dam-text-primary)', marginBottom: 8 }}>1. Primary Source Registry First</h2>
            <p>
              DAM indexes official Indian registries including the <strong>Reserve Bank of India (rbi.org.in)</strong>, <strong>Press Information Bureau Fact Check (pib.gov.in)</strong>, <strong>Telecom Regulatory Authority of India (trai.gov.in)</strong>, and <strong>CERT-In (cert-in.org.in)</strong>. It never accepts second-hand viral forwards without primary confirmation.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--dam-text-primary)', marginBottom: 8 }}>2. Autonomous Challenger Agent</h2>
            <p>
              Every finding is probed by an adversarial challenger agent that actively seeks reasons why the verdict could be premature, outdated, or jurisdictionally restricted (e.g. state-specific disconnections vs central notifications).
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--dam-text-primary)', marginBottom: 8 }}>3. Three Separate Verdicts &mdash; Never Blended</h2>
            <p>
              DAM rejects single composite truth scores. We report:
              <br />&bull; <strong>Factual Correctness</strong> (Supported, Contradicted, Mixed, Unverified)
              <br />&bull; <strong>Scam Risk</strong> (Low, Medium, High + specific triggered signals)
              <br />&bull; <strong>Evidence Sufficiency</strong> (Sufficient, Partial, Insufficient)
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--dam-text-primary)', marginBottom: 8 }}>4. Insufficient Evidence is a First-Class Verdict</h2>
            <p>
              When authoritative proof is not yet published by the relevant regulatory authority, DAM explicitly concludes <em>&quot;Insufficient Evidence&quot;</em> instead of guessing or hallucinating.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
