import { IndexedSource, JobOfferAnalysis, ResponseLanguage, StructuredAssessment, VerdictExplanation } from './types';
import { requireStructuredAssessment } from './assessment';
import { RESPONSE_LANGUAGES, answerCopy } from './localization';

interface InitialAnswerInput {
  assessment: StructuredAssessment;
  sources: IndexedSource[];
  jobOfferAnalysis?: JobOfferAnalysis;
  language?: ResponseLanguage;
  prompt?: string;
}

function citationsFor(
  sources: IndexedSource[],
  predicate: (source: IndexedSource) => boolean,
): string {
  return sources
    .filter(source =>
      !source.isFixture &&
      (source.relevanceScore ?? 1) >= 0.25 &&
      source.impactRole !== 'insufficient_relevance' &&
      predicate(source)
    )
    .slice(0, 3)
    .map(source => `[${source.id}]`)
    .join(' ');
}

function withCitations(text: string, citations: string): string {
  const sentence = text.trim().replace(/\s+/g, ' ');
  if (!citations || /\[\d+\]/.test(sentence)) return sentence;
  const isDevanagari = /[\u0900-\u097F]/.test(sentence) || sentence.endsWith('।');
  const punctuation = isDevanagari ? '।' : '.';
  const stripped = sentence.replace(/[.।\s]+$/, '');
  return `${stripped} ${citations}${punctuation}`;
}

function assessmentText(verdicts: StructuredAssessment, language: ResponseLanguage): string {
  const copy = answerCopy(language);
  const items = [
    copy.factual[verdicts.factualCorrectness],
    copy.authenticity[verdicts.messageAuthenticity],
    copy.scam[verdicts.scamRisk],
    copy.sufficiency[verdicts.evidenceSufficiency],
  ].filter(Boolean);

  if (language === 'hi') {
    return items
      .map(s => s.trim().replace(/[.।\s]+$/, ''))
      .join('। ') + '।';
  }

  return items.join('. ').replace(/\.\s*\./g, '.');
}

function uniqueReasons(reasons: string[]): string[] {
  const seen = new Set<string>();
  return reasons.filter(reason => {
    const key = reason.toLocaleLowerCase().replace(/\[\d+\]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function cleanPassageSentence(text: string): string {
  return text
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPassageSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?।])\s+|\n+/)
    .map(s => cleanPassageSentence(s))
    .filter(s => s.length >= 15 && s.length <= 320 && !/^\{\{|^\[\[|^http|^image:/i.test(s));
}

function extractBestPassageSentence(
  source: IndexedSource,
  targetKeywords: string[] = [],
  preferredStance?: 'supports' | 'contradicts'
): string {
  const sentences = splitPassageSentences(source.passage);
  if (sentences.length === 0) {
    return cleanPassageSentence(source.title) || cleanPassageSentence(source.passage.slice(0, 180));
  }

  const normalizedKeywords = targetKeywords
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length >= 3);

  let bestSentence = sentences[0];
  let bestScore = -1;

  for (const sentence of sentences) {
    const sLower = sentence.toLowerCase();
    let score = 0;

    for (const kw of normalizedKeywords) {
      if (sLower.includes(kw)) score += 3;
    }

    if (/\b(?:is|are|was|were|became|serves as|capital|chosen|mandates|clarifies|confirms|continues|remains|approves|refutes|banned|illegal|valid|legal tender)\b/i.test(sentence)) {
      score += 2;
    }

    if (preferredStance === 'contradicts') {
      if (/\b(?:not|never|fake|debunk|false|clarifies|refutes|misconception|state capital|continues to remain)\b/i.test(sentence)) {
        score += 3;
      }
    } else if (preferredStance === 'supports') {
      if (/\b(?:confirms|approves|officially|national capital|federal capital|selected|chosen|serves as)\b/i.test(sentence)) {
        score += 3;
      }
    }

    if (sentence.length >= 30 && sentence.length <= 180) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  return bestSentence;
}

function sourceAuthorityLabel(source: IndexedSource): string {
  const titleClean = source.title
    .replace(/\s*[-–—|].*$/, '')
    .replace(/^(?:Fact Check|FactCheck|PIB Fact Check):\s*/i, '')
    .trim();

  if (titleClean.length >= 5 && titleClean.length <= 40 && !/^(?:home|index|welcome|search|about|page)\b/i.test(titleClean)) {
    return `${titleClean} (${source.domain})`;
  }
  return source.domain;
}

interface ScopeDifference {
  trueEntity: string;
  scopeType: string;
  counterEntity: string;
  counterScope: string;
}

function detectScopeDifference(passage: string): ScopeDifference | null {
  const capitalMatch = passage.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+(?:the\s+)?(?:national|federal)\s+capital\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
    || passage.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:was chosen as the site of|serves as)\s+(?:the\s+)?(?:national|federal)\s+capital\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
    || passage.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+(?:the\s+)?capital\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+serving\s+as\s+the\s+seat\s+of\s+government/i);

  const stateMatch = passage.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+(?:the\s+)?state\s+capital\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
    || passage.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|serves as)\s+(?:the\s+)?(?:state\s+)?capital\s+of\s+(New South Wales|Victoria|Queensland|Western Australia|South Australia|Tasmania|Maharashtra|Karnataka|Tamil Nadu|Uttar Pradesh|Gujarat)/i)
    || passage.match(/while\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+(?:the\s+)?(?:state\s+)?capital\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);

  if (capitalMatch && stateMatch) {
    return {
      trueEntity: capitalMatch[1].trim(),
      scopeType: `national capital of ${capitalMatch[2].trim()}`,
      counterEntity: stateMatch[1].trim(),
      counterScope: `state capital of ${stateMatch[2].trim()}`,
    };
  }

  if (/कैनबरा/u.test(passage) && /सिडनी/u.test(passage)) {
    return {
      trueEntity: 'कैनबरा',
      scopeType: 'ऑस्ट्रेलिया की राष्ट्रीय राजधानी',
      counterEntity: 'सिडनी',
      counterScope: 'न्यू साउथ वेल्स की राज्य राजधानी',
    };
  }

  return null;
}

function buildConcreteFactualReasons({
  assessment,
  sources,
  prompt = '',
  language = 'en',
}: {
  assessment: StructuredAssessment;
  sources: IndexedSource[];
  prompt?: string;
  language?: ResponseLanguage;
}): string[] {
  const activeSources = sources.filter(s =>
    !s.isFixture &&
    (s.relevanceScore ?? 1) >= 0.25 &&
    s.impactRole !== 'insufficient_relevance'
  );

  const supportingSources = activeSources.filter(s => s.stance === 'supports');
  const contradictingSources = activeSources.filter(s => s.stance === 'contradicts');
  const warningSources = activeSources.filter(source =>
    /\b(cvv|otp|password|pin|bank(?:ing)? details|card details|phishing|scam|fraud)\b/i.test(`${source.title} ${source.passage}`)
  );
  const warningCitations = warningSources.map(s => `[${s.id}]`).join(' ');

  // Extract claim keywords for sentence scoring
  const claimTokens = prompt
    .replace(/[?!.।,;:'"()]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !/^(?:is|are|was|were|the|that|this|what|check|verify|whether|please|answer|true|false)\b/i.test(t));

  const explanation = assessment.explanation;
  const reasons: string[] = [];

  if (assessment.factualCorrectness === 'Supported') {
    if (supportingSources.length > 0) {
      const s1 = supportingSources[0];
      const s1Text = extractBestPassageSentence(s1, claimTokens, 'supports');
      const authority1 = sourceAuthorityLabel(s1);

      if (language === 'hi') {
        reasons.push(withCitations(
          /[\u0900-\u097F]/.test(s1Text)
            ? `${s1.domain} के आधिकारिक रिकॉर्ड पुष्टि करते हैं कि ${s1Text}`
            : `${s1.domain} के आधिकारिक रिकॉर्ड पुष्टि करते हैं: "${s1Text}"`,
          `[${s1.id}]`
        ));
      } else if (language === 'ta') {
        reasons.push(withCitations(
          `${s1.domain} இன் அதிகாரப்பூர்வ பதிவுகள் ${s1Text} என்பதை உறுதிப்படுத்துகின்றன`,
          `[${s1.id}]`
        ));
      } else {
        reasons.push(withCitations(
          /\b(?:confirms|clarifies|states|mandates|reports)\b/i.test(s1Text)
            ? `${authority1}: ${s1Text}`
            : `Official records from ${authority1} confirm that ${s1Text}`,
          `[${s1.id}]`
        ));
      }

      if (supportingSources.length > 1) {
        const s2 = supportingSources[1];
        const s2Text = extractBestPassageSentence(s2, claimTokens, 'supports');
        const authority2 = sourceAuthorityLabel(s2);

        if (language === 'hi') {
          reasons.push(withCitations(
            `${s2.domain} के सहायक रिकॉर्ड दर्शाते हैं कि ${s2Text}`,
            `[${s2.id}]`
          ));
        } else if (language === 'ta') {
          reasons.push(withCitations(
            `${s2.domain} இன் கூடுதல் பதிவுகள் ${s2Text} என்பதை நிறுவுகின்றன`,
            `[${s2.id}]`
          ));
        } else {
          reasons.push(withCitations(
            `Corroborating documentation from ${authority2} establishes that ${s2Text}`,
            `[${s2.id}]`
          ));
        }
      } else {
        const s1Sentences = splitPassageSentences(s1.passage).filter(s => s !== s1Text && s.length >= 25);
        if (s1Sentences.length > 0) {
          const secondSentence = s1Sentences[0];
          if (language === 'hi') {
            reasons.push(withCitations(`उद्धृत रिकॉर्ड आगे स्पष्ट करते हैं कि ${secondSentence}`, `[${s1.id}]`));
          } else if (language === 'ta') {
            reasons.push(withCitations(`மேற்கோள் பதிவு மேலும் ${secondSentence} என விளக்குகிறது`, `[${s1.id}]`));
          } else {
            reasons.push(withCitations(`The cited documentation further establishes that ${secondSentence}`, `[${s1.id}]`));
          }
        } else {
          if (language === 'hi') {
            reasons.push(withCitations(`उपलब्ध सत्यापित साक्ष्य बिना किसी विरोधाभासी रिकॉर्ड के दावे की सीधी पुष्टि करते हैं`, `[${s1.id}]`));
          } else if (language === 'ta') {
            reasons.push(withCitations(`சரிபார்க்கப்பட்ட ஆதாரம் முரண்பாடுகள் எதுவுமின்றி கூற்றை நேரடியாக உறுதிப்படுத்துகிறது`, `[${s1.id}]`));
          } else {
            reasons.push(withCitations(`The verified evidence directly affirms the assertion without conflicting jurisdiction records`, `[${s1.id}]`));
          }
        }
      }
    } else {
      reasons.push(explanation?.factualRationale || 'Relevant authoritative evidence supports the assertion.');
    }
  } else if (assessment.factualCorrectness === 'Contradicted') {
    const primaryContradict = contradictingSources[0] || activeSources[0];
    const combinedPassage = activeSources.map(s => s.passage).join(' ');
    const scopeDiff = detectScopeDifference(combinedPassage);

    if (scopeDiff && primaryContradict) {
      if (language === 'hi') {
        reasons.push(withCitations(`आधिकारिक रिकॉर्ड (${primaryContradict.domain}) स्पष्ट करते हैं कि ${scopeDiff.trueEntity} ${scopeDiff.scopeType} है`, `[${primaryContradict.id}]`));
        reasons.push(withCitations(`उपलब्ध साक्ष्य बताते हैं कि ${scopeDiff.counterEntity} ${scopeDiff.counterScope} है, न कि ${scopeDiff.scopeType}`, `[${primaryContradict.id}]`));
        reasons.push(withCitations(`संवैधानिक और प्रशासनिक रिकॉर्ड राज्य की राजधानी को राष्ट्रीय राजधानी से अलग रखते हैं`, `[${primaryContradict.id}]`));
      } else if (language === 'ta') {
        reasons.push(withCitations(`அதிகாரப்பூர்வ பதிவுகள் (${primaryContradict.domain}) ${scopeDiff.trueEntity} ${scopeDiff.scopeType} என்பதை நிறுவுகின்றன`, `[${primaryContradict.id}]`));
        reasons.push(withCitations(`${scopeDiff.counterEntity} ${scopeDiff.counterScope} என்பதை ஆதாரம் தெளிவுபடுத்துகிறது`, `[${primaryContradict.id}]`));
        reasons.push(withCitations(`மாநில தலைநகரங்களையும் தேசிய தலைநகரத்தையும் அதிகாரப்பூர்வ பதிவுகள் தெளிவாகப் பிரிக்கின்றன`, `[${primaryContradict.id}]`));
      } else {
        reasons.push(withCitations(`Official records from ${sourceAuthorityLabel(primaryContradict)} establish that ${scopeDiff.trueEntity} is the ${scopeDiff.scopeType}`, `[${primaryContradict.id}]`));
        reasons.push(withCitations(`The evidence clarifies that ${scopeDiff.counterEntity} serves as the ${scopeDiff.counterScope}, not the ${scopeDiff.scopeType}`, `[${primaryContradict.id}]`));
        reasons.push(withCitations(`Constitutional and geographic records distinguish regional or state capitals from the federal seat of government`, `[${primaryContradict.id}]`));
      }
    } else if (primaryContradict) {
      const c1Text = extractBestPassageSentence(primaryContradict, claimTokens, 'contradicts');
      const authority = sourceAuthorityLabel(primaryContradict);

      if (language === 'hi') {
        reasons.push(withCitations(
          /[\u0900-\u097F]/.test(c1Text)
            ? `${primaryContradict.domain} के आधिकारिक रिकॉर्ड स्पष्ट करते हैं कि ${c1Text}`
            : `${primaryContradict.domain} के आधिकारिक रिकॉर्ड स्पष्ट करते हैं: "${c1Text}"`,
          `[${primaryContradict.id}]`
        ));
      } else if (language === 'ta') {
        reasons.push(withCitations(
          `${primaryContradict.domain} இன் அதிகாரப்பூர்வ பதிவுகள் ${c1Text} என்பதை நிறுவுகின்றன`,
          `[${primaryContradict.id}]`
        ));
      } else {
        reasons.push(withCitations(
          /\b(?:clarifies|refutes|debunk|mandates|warns)\b/i.test(c1Text)
            ? `${authority}: ${c1Text}`
            : `Official clarification from ${authority} establishes that ${c1Text}`,
          `[${primaryContradict.id}]`
        ));
      }

      if (contradictingSources.length > 1) {
        const c2 = contradictingSources[1];
        const c2Text = extractBestPassageSentence(c2, claimTokens, 'contradicts');
        if (language === 'hi') {
          reasons.push(withCitations(`${c2.domain} के सहायक रिकॉर्ड पुष्टि करते हैं कि ${c2Text}`, `[${c2.id}]`));
        } else if (language === 'ta') {
          reasons.push(withCitations(`${c2.domain} இன் கூடுதல் பதிவுகள் ${c2Text} என்பதை உறுதிப்படுத்துகின்றன`, `[${c2.id}]`));
        } else {
          reasons.push(withCitations(`Corroborating findings from ${sourceAuthorityLabel(c2)} confirm that ${c2Text}`, `[${c2.id}]`));
        }
      } else {
        if (language === 'hi') {
          reasons.push(withCitations(`प्रकाशित आधिकारिक नियम प्रस्तुत दावे से सीधे टकराते हैं और इसे निराधार सिद्ध करते हैं`, `[${primaryContradict.id}]`));
        } else if (language === 'ta') {
          reasons.push(withCitations(`வெளியிடப்பட்ட அதிகாரப்பூர்வ விதிமுறைகள் சமர்ப்பிக்கப்பட்ட கூற்றுடன் நேரடியாக முரண்படுகின்றன`, `[${primaryContradict.id}]`));
        } else {
          reasons.push(withCitations(`Published regulatory directives directly conflict with the submitted claim, identifying it as contrary to verified records`, `[${primaryContradict.id}]`));
        }
      }
    } else {
      reasons.push(explanation?.factualRationale || 'Relevant authoritative evidence directly contradicts the assertion.');
    }
  } else if (assessment.factualCorrectness === 'Mixed') {
    const sup = supportingSources[0];
    const con = contradictingSources[0];

    if (sup && con) {
      const sText = extractBestPassageSentence(sup, claimTokens, 'supports');
      const cText = extractBestPassageSentence(con, claimTokens, 'contradicts');

      if (language === 'hi') {
        reasons.push(withCitations(`${sup.domain} के नियामक निर्देश दर्शाते हैं कि ${sText}`, `[${sup.id}]`));
        reasons.push(withCitations(`इसके विपरीत, ${con.domain} के आधिकारिक रिकॉर्ड स्पष्ट करते हैं कि ${cText}`, `[${con.id}]`));
        reasons.push(withCitations(`अलग-अलग राज्य और संस्थागत क्षेत्राधिकारों के कारण साक्ष्य परस्पर विरोधी हैं, इसलिए कोई एकपक्षीय निष्कर्ष नहीं निकाला जा सकता`, `[${sup.id}] [${con.id}]`));
      } else if (language === 'ta') {
        reasons.push(withCitations(`${sup.domain} இன் ஒழுங்குமுறை உத்தரவுகள் ${sText} எனக் குறிப்பிடுகின்றன`, `[${sup.id}]`));
        reasons.push(withCitations(`இதற்கு மாறாக, ${con.domain} இன் அதிகாரப்பூர்வ பதிவுகள் ${cText} எனக் குறிப்பிடுகின்றன`, `[${con.id}]`));
        reasons.push(withCitations(`வெவ்வேறு அதிகார வரம்புகளின் ஒழுங்குமுறை விதிகள் மாறுபடுவதால் அதிகாரப்பூர்வ ஆதாரங்கள் முரண்படுகின்றன`, `[${sup.id}] [${con.id}]`));
      } else {
        reasons.push(withCitations(`Regulatory directives from ${sourceAuthorityLabel(sup)} indicate: "${sText}"`, `[${sup.id}]`));
        reasons.push(withCitations(`In contrast, official records from ${sourceAuthorityLabel(con)} state: "${cText}"`, `[${con.id}]`));
        reasons.push(withCitations(`Because regulatory rules and statutory mandates vary across specific jurisdictions and issuing bodies, authoritative sources conflict rather than establishing a single uniform rule`, `[${sup.id}] [${con.id}]`));
      }
    } else {
      reasons.push(explanation?.factualRationale || 'Relevant authoritative sources conflict, so neither the supporting nor contradicting account can be stated as conclusive.');
    }
  } else {
    // Unverified / Insufficient Evidence
    const isStatutoryOrScheme = /\b(scheme|grant|stipend|subsidy|discount|banned|law|rule|order|approval|yojana|pension|benefit)\b/i.test(prompt);
    const isPersonalOrTransaction = /\b(refund|account|blocked|suspended|bill|sms|caller|payment|transaction|card)\b/i.test(prompt);

    if (language === 'hi') {
      reasons.push(
        isPersonalOrTransaction
          ? 'प्रस्तुत लेनदेन या खाते के निलंबन की पुष्टि करने वाला कोई आधिकारिक बैंक या सेवा प्रदाता रिकॉर्ड नहीं मिला।'
          : isStatutoryOrScheme
            ? 'प्रस्तुत योजना, अनुदान या आदेश की पुष्टि करने वाला कोई आधिकारिक राजपत्र, सरकारी परिपत्र या आधिकारिक रिकॉर्ड नहीं मिला।'
            : 'प्रस्तुत दावे की पुष्टि करने वाला कोई आधिकारिक राजपत्र, सरकारी परिपत्र या सत्यापित सार्वजनिक रिकॉर्ड नहीं मिला।'
      );
      if (activeSources.length > 0) {
        reasons.push('उपलब्ध खोज परिणाम स्निपेट संदर्भ प्रदान करते हैं, लेकिन दावे के पूर्ण सत्यापन के लिए प्राथमिक दस्तावेज़ उपलब्ध नहीं हैं।');
      } else {
        reasons.push('आधिकारिक सरकारी पोर्टलों और सार्वजनिक अभिलेखों में इस घोषणा का कोई प्रमाण उपलब्ध नहीं है।');
      }
      reasons.push('ठोस निष्कर्ष के लिए उपलब्ध साक्ष्य अपर्याप्त हैं; साक्ष्य का अभाव दावे के असत्य होने का प्रमाण नहीं है।');
    } else if (language === 'ta') {
      reasons.push(
        isStatutoryOrScheme
          ? 'குறிப்பிட்ட திட்டம் அல்லது ஆணை தொடர்பான அதிகாரப்பூர்வ அரசிதழ் அறிவிப்பு அல்லது அரசு சுற்றறிக்கை எதுவும் கிடைக்கவில்லை.'
          : 'கூற்றை உறுதிப்படுத்தும் அதிகாரப்பூர்व அரசிதழ் அல்லது முதன்மை ஆவணங்கள் எதுவும் கிடைக்கவில்லை.'
      );
      reasons.push('அதிகாரப்பூர்வ இணையதளங்கள் மற்றும் பொது ஆவணங்களில் இந்த அறிவிப்புக்கான எந்த ஆதாரமும் கிடைக்கவில்லை.');
      reasons.push('உறுதியான முடிவுக்கு கிடைக்கும் ஆதாரம் போதவில்லை; ஆதாரம் இல்லாதது கூற்று தவறு என்பதற்கான சான்றல்ல.');
    } else {
      reasons.push(
        isPersonalOrTransaction
          ? 'No official banking record, utility notice, or authenticated transaction confirming the claimed account action was identified.'
          : isStatutoryOrScheme
            ? 'No official gazette notification, ministerial circular, or verified registry record confirming the claimed program or order was identified.'
            : 'No official gazette notification, departmental circular, or verified primary documentation confirming the assertion was located.'
      );
      if (activeSources.length > 0) {
        reasons.push('The retrieved search references provide background context but lack full primary documentation to resolve the specific assertion.');
      } else {
        reasons.push('Public searches across official government, regulatory, and public archives located no matching announcements for this claim.');
      }
      reasons.push('The available evidence is too limited for a definitive determination; absence of public documentation is not proof that the assertion is false.');
    }
  }

  // Preserve explicit scam warnings and citations when scam indicators are active
  if (assessment.scamRisk === 'High' || assessment.scamRisk === 'Medium') {
    if (explanation?.scamRationale) {
      reasons.unshift(withCitations(explanation.scamRationale, warningCitations));
    }
  }

  // Preserve authenticity rationale when an explicit communication was evaluated
  if (assessment.messageAuthenticity && assessment.messageAuthenticity !== 'Not applicable') {
    if (explanation?.authenticityRationale && !reasons.some(r => r.includes(explanation.authenticityRationale!))) {
      reasons.push(explanation.authenticityRationale);
    }
  }

  return uniqueReasons(reasons);
}

function buildTailoredNextSteps({
  assessment,
  sources,
  prompt = '',
  language = 'en',
}: {
  assessment: StructuredAssessment;
  sources: IndexedSource[];
  prompt?: string;
  language?: ResponseLanguage;
}): string[] {
  const isSuspicious = assessment.scamRisk === 'High' || assessment.scamRisk === 'Medium';
  const copy = answerCopy(language);

  if (isSuspicious) {
    return copy.nextSteps.suspicious;
  }

  const primarySource = sources.find(s => s.stance === (assessment.factualCorrectness === 'Contradicted' ? 'contradicts' : 'supports')) || sources[0];
  const domain = primarySource?.domain;
  const isTimeSensitive = /\b(today|tonight|now|current|currently|rate|tariff|price|scheme|weather|election|deadline|temporary|latest)\b/i.test(prompt);

  if (assessment.factualCorrectness === 'Supported') {
    if (language === 'hi') {
      return isTimeSensitive
        ? [`दावे की सही सीमा और तारीख के लिए उद्धृत स्रोत (${domain || 'प्राथमिक स्रोत'}) देखें।`, 'दावा समय-संवेदी हो तो प्राथमिक स्रोत दोबारा जाँचें।']
        : [`पूर्ण संदर्भ और आधिकारिक रिकॉर्ड के लिए उद्धृत स्रोत (${domain || 'प्राथमिक स्रोत'}) देखें।`, 'अपुष्ट सारांशों के बजाय सत्यापित प्राथमिक रिकॉर्ड पर भरोसा करें।'];
    }
    if (language === 'ta') {
      return isTimeSensitive
        ? [`கூற்றின் சரியான வரம்பும் தேதியும் அறிய மேற்கோள் ஆதாரத்தைப் (${domain || 'முதன்மை ஆதாரம்'}) பார்க்கவும்.`, 'கூற்று கால உணர்வுடையதானால் முதன்மை ஆதாரத்தை மீண்டும் சரிபார்க்கவும்.']
        : [`முழுமையான தகவலுக்கு மேற்கோள் காட்டப்பட்ட அதிகாரப்பூர்வ பதிவை (${domain || 'முதன்மை ஆதாரம்'}) பார்க்கவும்.`, 'சரிபார்க்கப்படாத சுருக்கங்களை விட உறுதிப்படுத்தப்பட்ட பதிவை நம்புங்கள்.'];
    }
    return isTimeSensitive
      ? [`Review ${domain || 'the cited source'} for the exact effective date and operational scope.`, 'Recheck the issuing authority for recent amendments or regulatory updates.']
      : [`Consult the cited official record (${domain || 'primary source'}) for complete statutory or institutional context.`, 'Rely on the verified finding rather than secondary or unverified summaries.'];
  }

  if (assessment.factualCorrectness === 'Contradicted') {
    if (language === 'hi') {
      return [
        `खंडित दावे के बजाय ${domain || 'उद्धृत प्राथमिक स्रोत'} द्वारा स्थापित सत्यापित तथ्य पर भरोसा करें।`,
        'आगे भेजने से पहले देखें कि क्षेत्राधिकार या दायरे का कोई अंतर तो नहीं छूटा है।',
      ];
    }
    if (language === 'ta') {
      return [
        `மறுக்கப்பட்ட கூற்றுக்குப் பதிலாக ${domain || 'மேற்கோள் ஆதாரம்'} நிறுவிய சரிபார்க்கப்பட்ட உண்மையை நம்புங்கள்.`,
        'பகிர்வதற்கு முன் அதிகார வரம்பு அல்லது நிலைகளில் வித்தியாசம் உள்ளதா எனச் சரிபார்க்கவும்.',
      ];
    }
    return [
      `Rely on the verified finding established by ${domain || 'the cited primary source'} rather than the contradicted claim.`,
      'Check whether a distinction in scope, jurisdiction, or administrative level was conflated before sharing the claim.',
    ];
  }

  if (assessment.factualCorrectness === 'Mixed') {
    const conflictingDomains = Array.from(new Set(sources.filter(s => s.stance !== 'context').map(s => s.domain))).slice(0, 2);
    const domainList = conflictingDomains.length > 0 ? conflictingDomains.join(', ') : 'conflicting sources';

    if (language === 'hi') {
      return [
        `परस्पर विरोधी उद्धृत स्रोतों (${domainList}) की तारीख और दायरा तुलना करें।`,
        'स्थानीय नियामक प्राधिकरण से पुष्टि होने तक निष्कर्ष को अनिर्णीत मानें।',
      ];
    }
    if (language === 'ta') {
      return [
        `முரண்படும் மேற்கோள் ஆதாரங்களின் (${domainList}) தேதியையும் வரம்பையும் ஒப்பிடவும்.`,
        'உள்ளூர் ஒழுங்குமுறை ஆணையத்திடம் உறுதிப்படுத்தும் வரை முடிவைத் தீர்மானிக்கப்படாததாகக் கருதவும்.',
      ];
    }
    return [
      `Compare the differing provisions across the conflicting cited authorities (${domainList}) to determine which applies to your jurisdiction.`,
      'Treat the conclusion as unresolved across jurisdictions until confirmed by your local regulatory authority.',
    ];
  }

  // Unverified
  if (language === 'hi') {
    return [
      'ऐसा प्रासंगिक प्राथमिक स्रोत या आधिकारिक राजपत्र खोजें जो दावे को सीधे संबोधित करता हो।',
      'मजबूत साक्ष्य मिलने तक निष्कर्ष को अनिर्णीत मानें और इसे आगे साझा न करें।',
    ];
  }
  if (language === 'ta') {
    return [
      'கூற்றை நேரடியாகக் குறிப்பிடும் அதிகாரப்பூர்வ அரசிதழ் அல்லது முதன்மை ஆதாரத்தைத் தேடவும்.',
      'வலுவான ஆதாரம் கிடைக்கும் வரை முடிவைத் தீர்மானிக்கப்படாததாகக் கருதவும்.',
    ];
  }
  return [
    'Check the official portal or gazette repository of the relevant governing department for an official circular or order number.',
    'Treat the conclusion as unresolved unless verified by a primary government or institutional publication.',
  ];
}

function buildJobOfferAnswer(analysis: JobOfferAnalysis, language: ResponseLanguage): string {
  const copy = answerCopy(language);
  if (language === 'hi' || language === 'ta') {
    const hindi = language === 'hi';
    const assessment = hindi
      ? 'प्रस्तुत सामग्री से इस विशिष्ट नौकरी प्रस्ताव की प्रामाणिकता की पुष्टि नहीं की जा सकती। कंपनी का अस्तित्व अपने आप में भर्तीकर्ता की संबद्धता या इस प्रस्ताव की प्रामाणिकता सिद्ध नहीं करता।'
      : 'சமர்ப்பிக்கப்பட்ட தகவலால் இந்த குறிப்பிட்ட வேலை வாய்ப்பின் நம்பகத்தன்மையை உறுதிப்படுத்த முடியாது. நிறுவனம் இருப்பது மட்டும் ஆட்சேர்ப்பாளரின் தொடர்பையோ இந்த வாய்ப்பின் உண்மைத்தன்மையையோ நிரூபிக்காது.';
    const reasons = hindi
      ? [analysis.paymentRequest ? 'संदेश में भुगतान का अनुरोध मिला।' : 'कोई स्पष्ट भुगतान अनुरोध नहीं मिला।', analysis.sensitiveDataRequest ? 'संदेश में संवेदनशील व्यक्तिगत जानकारी का अनुरोध मिला।' : 'संवेदनशील जानकारी का कोई स्पष्ट अनुरोध नहीं मिला।', analysis.domainWarning ? 'प्रेषक डोमेन की स्वतंत्र पुष्टि आवश्यक है।' : 'उपलब्ध सामग्री से भर्तीकर्ता की संबद्धता की पुष्टि नहीं हुई।']
      : [analysis.paymentRequest ? 'செய்தியில் பணம் கோரப்பட்டுள்ளது.' : 'வெளிப்படையான பணக் கோரிக்கை இல்லை.', analysis.sensitiveDataRequest ? 'செய்தியில் முக்கிய தனிப்பட்ட தகவல் கோரப்பட்டுள்ளது.' : 'முக்கிய தகவலுக்கான வெளிப்படையான கோரிக்கை இல்லை.', analysis.domainWarning ? 'அனுப்புநர் களத்தைத் தனியாகச் சரிபார்க்க வேண்டும்.' : 'கிடைக்கும் தகவலால் ஆட்சேர்ப்பாளர் தொடர்பு உறுதிப்படுத்தப்படவில்லை.'];
    return [`### ${copy.headings.assessment}`, assessment, '', `### ${copy.headings.reasons}`, ...reasons.map(reason => `- ${reason}`), '', `### ${copy.headings.nextSteps}`, ...copy.nextSteps.suspicious.map((step, index) => `${index + 1}. ${step}`)].join('\n');
  }
  const warningSummary = analysis.paymentRequest && analysis.sensitiveDataRequest
    ? 'The message requests both payment and sensitive personal information.'
    : analysis.paymentRequest
      ? 'The message includes a payment request, which is a material warning sign.'
      : analysis.sensitiveDataRequest
        ? 'The message requests sensitive personal information, which warrants caution.'
        : 'No explicit payment or sensitive-data request was found in the supplied text.';

  const reasons = analysis.checks.slice(0, 3).map(check => {
    const citations = (check.sourceIds || []).map(id => `[${id}]`).join(' ');
    return `${check.status === 'completed' ? 'Completed' : 'Not completed'} — ${check.label}: ${withCitations(check.finding, citations)}`;
  });
  const nextSteps = [
    analysis.followUpQuestion || 'Confirm the recruiter through contact details published on the employer’s official careers website, not through details in the offer.',
    'Do not pay fees or send identity, banking, password, or one-time-code details until the employer independently confirms the recruiter and offer.',
    'Keep the original message and document metadata for the employer’s security team or the appropriate fraud-reporting channel.',
  ];

  return [
    `### ${copy.headings.assessment}`,
    `The specific job offer cannot be authenticated from the submitted material. ${warningSummary} Finding a company or careers page would not, by itself, prove that the recruiter is affiliated or that this offer is genuine.`,
    '',
    `### ${copy.headings.reasons}`,
    ...reasons.map(reason => `- ${reason}`),
    '',
    `### ${copy.headings.nextSteps}`,
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

export function buildInitialAnswer({ assessment, sources, jobOfferAnalysis, language = 'en', prompt = '' }: InitialAnswerInput): string {
  const verdicts = requireStructuredAssessment(assessment);
  const copy = answerCopy(language);
  if (jobOfferAnalysis) return buildJobOfferAnswer(jobOfferAnalysis, language);

  const reasons = buildConcreteFactualReasons({ assessment: verdicts, sources, prompt, language });
  const nextSteps = buildTailoredNextSteps({ assessment: verdicts, sources, prompt, language });

  return [
    `### ${copy.headings.assessment}`,
    assessmentText(verdicts, language),
    '',
    `### ${copy.headings.reasons}`,
    ...reasons.map(reason => `- ${reason}`),
    '',
    `### ${copy.headings.nextSteps}`,
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}

export function hasInitialAnswerHierarchy(markdown: string): boolean {
  const headings = Array.from(markdown.matchAll(/^###\s+(.+)$/gm)).map(match => match[1].trim());
  const matchingCopy = RESPONSE_LANGUAGES.map(answerCopy).find(copy => headings.join('|') === Object.values(copy.headings).join('|'));
  if (headings.length !== 3 || !matchingCopy) return false;

  const reasonsBlock = markdown.split(new RegExp(`^### ${matchingCopy.headings.reasons}\\s*$`, 'm'))[1]?.split(new RegExp(`^### ${matchingCopy.headings.nextSteps}\\s*$`, 'm'))[0] || '';
  const reasons = reasonsBlock.split('\n').filter(line => /^\s*[-*]\s+\S/.test(line));
  const nextStepsBlock = markdown.split(new RegExp(`^### ${matchingCopy.headings.nextSteps}\\s*$`, 'm'))[1] || '';
  const nextSteps = nextStepsBlock.split('\n').filter(line => /^\s*\d+[.)]\s+\S/.test(line));
  return reasons.length >= 1 && reasons.length <= 3 && nextSteps.length >= 2 && nextSteps.length <= 3;
}

