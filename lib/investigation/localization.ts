import type { ActivityStage, ResponseLanguage, StructuredAssessment } from './types';

export const RESPONSE_LANGUAGES = ['en', 'hi', 'mr', 'ta', 'bn', 'te'] as const;
export type { ResponseLanguage } from './types';

export function resolveResponseLanguage(requested: string | undefined, prompt: string): ResponseLanguage {
  const normalized = requested?.toLowerCase().split('-')[0];
  if (RESPONSE_LANGUAGES.includes(normalized as ResponseLanguage)) return normalized as ResponseLanguage;

  const explicit = prompt.match(/\b(?:answer|reply|respond|write|explain)\s+(?:to me\s+)?in\s+(hindi|english|marathi|tamil|bengali|bangla|telugu)\b/i)?.[1]?.toLowerCase();
  if (explicit) {
    const names: Record<string, ResponseLanguage> = { hindi: 'hi', english: 'en', marathi: 'mr', tamil: 'ta', bengali: 'bn', bangla: 'bn', telugu: 'te' };
    return names[explicit] || 'en';
  }
  if (/\p{Script=Tamil}/u.test(prompt)) return 'ta';
  if (/\p{Script=Bengali}/u.test(prompt)) return 'bn';
  if (/\p{Script=Telugu}/u.test(prompt)) return 'te';
  if (/\p{Script=Devanagari}/u.test(prompt)) {
    return /\bमराठी\b|\bmarathi\b/i.test(prompt) ? 'mr' : 'hi';
  }
  return 'en';
}

export interface LocalizedAnswerCopy {
  headings: { assessment: string; reasons: string; nextSteps: string };
  factual: Record<StructuredAssessment['factualCorrectness'], string>;
  authenticity: Record<StructuredAssessment['messageAuthenticity'], string>;
  scam: Record<StructuredAssessment['scamRisk'], string>;
  sufficiency: Record<StructuredAssessment['evidenceSufficiency'], string>;
  factualReason: Record<StructuredAssessment['factualCorrectness'], string>;
  authenticityReason: Record<StructuredAssessment['messageAuthenticity'], string>;
  scamReason: Record<StructuredAssessment['scamRisk'], string>;
  sufficiencyReason: Record<StructuredAssessment['evidenceSufficiency'], string>;
  nextSteps: Record<StructuredAssessment['factualCorrectness'] | 'suspicious', string[]>;
}

const EN: LocalizedAnswerCopy = {
  headings: { assessment: 'Assessment', reasons: 'Main reasons', nextSteps: 'Next steps' },
  factual: { Supported: 'The factual claim is supported by the available evidence', Contradicted: 'The factual claim is contradicted by the available evidence', Mixed: 'The factual evidence is mixed', Unverified: 'The factual claim remains unverified' },
  authenticity: { Authenticated: 'the specific sender was authenticated', 'Not authenticated': 'the specific sender was not authenticated', 'Cannot authenticate': 'the specific sender could not be authenticated', 'Not applicable': '' },
  scam: { High: 'The message contains high-risk scam warning signs.', Medium: 'The message contains warning signs that warrant caution.', Low: 'No material scam warning signs were identified in the submitted material.', 'Not applicable': '' },
  sufficiency: { Sufficient: '', Partial: 'Some material uncertainty remains because the evidence is partial.', Insufficient: 'The available evidence is too limited for a firmer conclusion.' },
  factualReason: { Supported: 'Relevant evidence directly supports the submitted claim.', Contradicted: 'Relevant evidence directly conflicts with the submitted claim.', Mixed: 'Relevant sources conflict or apply to different parts of the claim.', Unverified: 'The available evidence does not confirm or disprove the specific claim.' },
  authenticityReason: { Authenticated: 'A direct sender or domain check authenticated the submitted communication.', 'Not authenticated': 'A direct sender, domain, or document check failed.', 'Cannot authenticate': 'Public evidence cannot authenticate the specific sender or transaction.', 'Not applicable': '' },
  scamReason: { High: 'The submitted message contains high-risk scam indicators.', Medium: 'The submitted message contains warning signs that warrant caution.', Low: 'No material scam indicator was identified.', 'Not applicable': '' },
  sufficiencyReason: { Sufficient: 'The evidence directly addresses the claim.', Partial: 'The available evidence addresses only part of the claim.', Insufficient: 'The available evidence is insufficient; absence of evidence is not proof that the claim is false.' },
  nextSteps: {
    Supported: ['Review the cited source for the exact scope and date of the claim.', 'Recheck the primary source if the claim is time-sensitive.'],
    Contradicted: ['Use the cited primary source instead of relying on the contradicted claim.', 'Check whether the claim omitted a date, location, or qualifier before forwarding it.'],
    Mixed: ['Review the conflicting cited sources and compare their dates and scope.', 'Treat the conclusion as unresolved until stronger evidence is available.'],
    Unverified: ['Look for a relevant primary source that directly addresses the claim.', 'Treat the conclusion as unresolved unless stronger evidence becomes available.'],
    suspicious: ['Do not use supplied links or share passwords, PINs, OTPs, CVVs, or banking details.', 'Verify the message independently through the organisation’s official website or trusted number.', 'Keep the original message and sender details if you need to report it.'],
  },
};

const HI: LocalizedAnswerCopy = {
  headings: { assessment: 'आकलन', reasons: 'मुख्य कारण', nextSteps: 'अगले कदम' },
  factual: { Supported: 'उपलब्ध साक्ष्य तथ्यात्मक दावे का समर्थन करते हैं', Contradicted: 'उपलब्ध साक्ष्य तथ्यात्मक दावे का खंडन करते हैं', Mixed: 'तथ्यात्मक साक्ष्य परस्पर विरोधी हैं', Unverified: 'तथ्यात्मक दावा अभी अप्रमाणित है' },
  authenticity: { Authenticated: 'विशिष्ट प्रेषक की पुष्टि हुई है', 'Not authenticated': 'विशिष्ट प्रेषक प्रमाणित नहीं हुआ', 'Cannot authenticate': 'विशिष्ट प्रेषक की पुष्टि नहीं की जा सकी', 'Not applicable': '' },
  scam: { High: 'संदेश में धोखाधड़ी के गंभीर चेतावनी संकेत हैं।', Medium: 'संदेश में सावधानी बरतने योग्य चेतावनी संकेत हैं।', Low: 'प्रस्तुत सामग्री में कोई महत्वपूर्ण धोखाधड़ी संकेत नहीं मिला।', 'Not applicable': '' },
  sufficiency: { Sufficient: '', Partial: 'साक्ष्य आंशिक होने के कारण कुछ महत्वपूर्ण अनिश्चितता बनी हुई है।', Insufficient: 'अधिक ठोस निष्कर्ष के लिए उपलब्ध साक्ष्य अपर्याप्त हैं।' },
  factualReason: { Supported: 'प्रासंगिक साक्ष्य प्रस्तुत दावे का सीधे समर्थन करते हैं।', Contradicted: 'प्रासंगिक साक्ष्य प्रस्तुत दावे से सीधे टकराते हैं।', Mixed: 'प्रासंगिक स्रोत असहमत हैं या दावे के अलग-अलग हिस्सों पर लागू होते हैं।', Unverified: 'उपलब्ध साक्ष्य इस विशिष्ट दावे की पुष्टि या खंडन नहीं करते।' },
  authenticityReason: { Authenticated: 'प्रत्यक्ष प्रेषक या डोमेन जाँच ने संचार की पुष्टि की।', 'Not authenticated': 'प्रत्यक्ष प्रेषक, डोमेन या दस्तावेज़ जाँच विफल रही।', 'Cannot authenticate': 'सार्वजनिक साक्ष्य विशिष्ट प्रेषक या लेनदेन की पुष्टि नहीं कर सकते।', 'Not applicable': '' },
  scamReason: { High: 'प्रस्तुत संदेश में धोखाधड़ी के गंभीर संकेत हैं।', Medium: 'प्रस्तुत संदेश में सावधानी बरतने योग्य संकेत हैं।', Low: 'कोई महत्वपूर्ण धोखाधड़ी संकेत नहीं मिला।', 'Not applicable': '' },
  sufficiencyReason: { Sufficient: 'साक्ष्य दावे को सीधे संबोधित करते हैं।', Partial: 'उपलब्ध साक्ष्य दावे के केवल एक हिस्से को संबोधित करते हैं।', Insufficient: 'उपलब्ध साक्ष्य अपर्याप्त हैं; साक्ष्य का अभाव दावे के गलत होने का प्रमाण नहीं है।' },
  nextSteps: {
    Supported: ['दावे की सही सीमा और तारीख के लिए उद्धृत स्रोत देखें।', 'दावा समय-संवेदी हो तो प्राथमिक स्रोत दोबारा जाँचें।'],
    Contradicted: ['खंडित दावे के बजाय उद्धृत प्राथमिक स्रोत पर भरोसा करें।', 'आगे भेजने से पहले देखें कि कोई तारीख, स्थान या शर्त छूटी तो नहीं है।'],
    Mixed: ['परस्पर विरोधी उद्धृत स्रोतों की तारीख और दायरा तुलना करें।', 'मजबूत साक्ष्य मिलने तक निष्कर्ष को अनिर्णीत मानें।'],
    Unverified: ['ऐसा प्रासंगिक प्राथमिक स्रोत खोजें जो दावे को सीधे संबोधित करता हो।', 'मजबूत साक्ष्य मिलने तक निष्कर्ष को अनिर्णीत मानें।'],
    suspicious: ['दिए गए लिंक न खोलें और पासवर्ड, PIN, OTP, CVV या बैंक विवरण साझा न करें।', 'संगठन की आधिकारिक वेबसाइट या विश्वसनीय नंबर से स्वतंत्र रूप से पुष्टि करें।', 'रिपोर्ट करने की आवश्यकता हो तो मूल संदेश और प्रेषक विवरण सुरक्षित रखें।'],
  },
};

const TA: LocalizedAnswerCopy = {
  headings: { assessment: 'மதிப்பீடு', reasons: 'முக்கிய காரணங்கள்', nextSteps: 'அடுத்த படிகள்' },
  factual: { Supported: 'கிடைக்கும் ஆதாரங்கள் உண்மைத் தகவல் கூற்றை ஆதரிக்கின்றன', Contradicted: 'கிடைக்கும் ஆதாரங்கள் உண்மைத் தகவல் கூற்றை மறுக்கின்றன', Mixed: 'உண்மைத் தகவல் ஆதாரங்கள் முரண்படுகின்றன', Unverified: 'உண்மைத் தகவல் கூற்று இன்னும் சரிபார்க்கப்படவில்லை' },
  authenticity: { Authenticated: 'குறிப்பிட்ட அனுப்புநர் உறுதிப்படுத்தப்பட்டார்', 'Not authenticated': 'குறிப்பிட்ட அனுப்புநர் உறுதிப்படுத்தப்படவில்லை', 'Cannot authenticate': 'குறிப்பிட்ட அனுப்புநரை உறுதிப்படுத்த முடியவில்லை', 'Not applicable': '' },
  scam: { High: 'செய்தியில் அதிக ஆபத்துள்ள மோசடி எச்சரிக்கை அறிகுறிகள் உள்ளன.', Medium: 'செய்தியில் எச்சரிக்கையுடன் இருக்க வேண்டிய அறிகுறிகள் உள்ளன.', Low: 'சமர்ப்பிக்கப்பட்ட தகவலில் முக்கிய மோசடி அறிகுறிகள் இல்லை.', 'Not applicable': '' },
  sufficiency: { Sufficient: '', Partial: 'ஆதாரம் பகுதியளவாக இருப்பதால் முக்கிய நிச்சயமின்மை உள்ளது.', Insufficient: 'உறுதியான முடிவுக்கு கிடைக்கும் ஆதாரம் போதவில்லை.' },
  factualReason: { Supported: 'தொடர்புடைய ஆதாரம் சமர்ப்பிக்கப்பட்ட கூற்றை நேரடியாக ஆதரிக்கிறது.', Contradicted: 'தொடர்புடைய ஆதாரம் சமர்ப்பிக்கப்பட்ட கூற்றுடன் நேரடியாக முரண்படுகிறது.', Mixed: 'தொடர்புடைய ஆதாரங்கள் ஒன்றுக்கொன்று முரண்படுகின்றன.', Unverified: 'கிடைக்கும் ஆதாரம் குறிப்பிட்ட கூற்றை உறுதிப்படுத்தவோ மறுக்கவோ இல்லை.' },
  authenticityReason: { Authenticated: 'நேரடி அனுப்புநர் அல்லது களச் சோதனை தகவலை உறுதிப்படுத்தியது.', 'Not authenticated': 'நேரடி அனுப்புநர், களம் அல்லது ஆவணச் சோதனை தோல்வியடைந்தது.', 'Cannot authenticate': 'பொது ஆதாரங்களால் குறிப்பிட்ட அனுப்புநர் அல்லது பரிவர்த்தனையை உறுதிப்படுத்த முடியாது.', 'Not applicable': '' },
  scamReason: { High: 'சமர்ப்பிக்கப்பட்ட செய்தியில் அதிக ஆபத்துள்ள மோசடி அறிகுறிகள் உள்ளன.', Medium: 'சமர்ப்பிக்கப்பட்ட செய்தியில் எச்சரிக்கை அறிகுறிகள் உள்ளன.', Low: 'முக்கிய மோசடி அறிகுறி இல்லை.', 'Not applicable': '' },
  sufficiencyReason: { Sufficient: 'ஆதாரம் கூற்றை நேரடியாகக் குறிப்பிடுகிறது.', Partial: 'கிடைக்கும் ஆதாரம் கூற்றின் ஒரு பகுதியை மட்டுமே குறிப்பிடுகிறது.', Insufficient: 'கிடைக்கும் ஆதாரம் போதவில்லை; ஆதாரம் இல்லாதது கூற்று தவறு என்பதற்கான சான்றல்ல.' },
  nextSteps: {
    Supported: ['கூற்றின் சரியான வரம்பும் தேதியும் அறிய மேற்கோள் ஆதாரத்தைப் பார்க்கவும்.', 'கூற்று கால உணர்வுடையதானால் முதன்மை ஆதாரத்தை மீண்டும் சரிபார்க்கவும்.'],
    Contradicted: ['மறுக்கப்பட்ட கூற்றுக்குப் பதிலாக மேற்கோள் காட்டப்பட்ட முதன்மை ஆதாரத்தைப் பயன்படுத்தவும்.', 'பகிர்வதற்கு முன் தேதி, இடம் அல்லது நிபந்தனை விடுபட்டதா எனச் சரிபார்க்கவும்.'],
    Mixed: ['முரண்படும் மேற்கோள் ஆதாரங்களின் தேதியையும் வரம்பையும் ஒப்பிடவும்.', 'வலுவான ஆதாரம் கிடைக்கும் வரை முடிவைத் தீர்மானிக்கப்படாததாகக் கருதவும்.'],
    Unverified: ['கூற்றை நேரடியாகக் குறிப்பிடும் பொருத்தமான முதன்மை ஆதாரத்தைத் தேடவும்.', 'வலுவான ஆதாரம் கிடைக்கும் வரை முடிவைத் தீர்மானிக்கப்படாததாகக் கருதவும்.'],
    suspicious: ['கொடுக்கப்பட்ட இணைப்புகளைப் பயன்படுத்தாதீர்கள்; கடவுச்சொல், PIN, OTP, CVV அல்லது வங்கி விவரங்களைப் பகிராதீர்கள்.', 'அமைப்பின் அதிகாரப்பூர்வ இணையதளம் அல்லது நம்பகமான எண்ணின் மூலம் தனியாகச் சரிபார்க்கவும்.', 'புகார் அளிக்க வேண்டுமானால் அசல் செய்தியையும் அனுப்புநர் விவரங்களையும் பாதுகாக்கவும்.'],
  },
};

const BASIC_HEADINGS: Record<Exclude<ResponseLanguage, 'en' | 'hi' | 'ta'>, LocalizedAnswerCopy['headings']> = {
  mr: { assessment: 'मूल्यांकन', reasons: 'मुख्य कारणे', nextSteps: 'पुढील पावले' },
  bn: { assessment: 'মূল্যায়ন', reasons: 'প্রধান কারণ', nextSteps: 'পরবর্তী পদক্ষেপ' },
  te: { assessment: 'మూల్యాంకనం', reasons: 'ప్రధాన కారణాలు', nextSteps: 'తదుపరి చర్యలు' },
};

export function answerCopy(language: ResponseLanguage): LocalizedAnswerCopy {
  if (language === 'hi') return HI;
  if (language === 'ta') return TA;
  if (language === 'en') return EN;
  return { ...EN, headings: BASIC_HEADINGS[language] };
}

export function localizeAssessmentForDisplay(assessment: StructuredAssessment, language: ResponseLanguage): StructuredAssessment {
  const copy = answerCopy(language);
  const sourceImpacts = (assessment.explanation?.sourceImpacts || []).map(impact => ({
    ...impact,
    explanation: impact.impactRole === 'primary_support'
      ? copy.factualReason.Supported
      : impact.impactRole === 'primary_contradiction'
        ? copy.factualReason.Contradicted
        : impact.impactRole === 'insufficient_relevance'
          ? copy.sufficiencyReason.Insufficient
          : copy.sufficiencyReason.Partial,
  }));
  return {
    ...assessment,
    explanation: {
      summary: [copy.factual[assessment.factualCorrectness], copy.authenticity[assessment.messageAuthenticity], copy.scam[assessment.scamRisk], copy.sufficiency[assessment.evidenceSufficiency]].filter(Boolean).join('. '),
      factualRationale: copy.factualReason[assessment.factualCorrectness],
      authenticityRationale: copy.authenticityReason[assessment.messageAuthenticity],
      scamRationale: copy.scamReason[assessment.scamRisk],
      sufficiencyRationale: copy.sufficiencyReason[assessment.evidenceSufficiency],
      sourceImpacts,
    },
  };
}

const STAGE_TITLES: Record<string, Partial<Record<ResponseLanguage, string>>> = {
  'Secure Web Ingestion & Link Forensics': { hi: 'सुरक्षित वेब सामग्री और लिंक जाँच', ta: 'பாதுகாப்பான இணைய உள்ளடக்கம் மற்றும் இணைப்பு ஆய்வு' },
  'Consulting Cyber Defense & Regulatory Knowledge': { hi: 'साइबर सुरक्षा और नियामक जानकारी की जाँच', ta: 'இணைய பாதுகாப்பு மற்றும் ஒழுங்குமுறை தகவல் ஆய்வு' },
  'Analysing Request & Scope': { hi: 'अनुरोध और दायरे का विश्लेषण', ta: 'கோரிக்கையும் வரம்பும் பகுப்பாய்வு' },
  'Searching Relevant Sources': { hi: 'प्रासंगिक स्रोतों की खोज', ta: 'தொடர்புடைய ஆதாரங்களைத் தேடுகிறது' },
  'Extracting & Cross-Referencing Evidence': { hi: 'साक्ष्य निकालना और मिलान करना', ta: 'ஆதாரத்தைப் பிரித்து ஒப்பிடுகிறது' },
  'Adversarial Challenger Verification': { hi: 'विरोधी परिकल्पना जाँच', ta: 'எதிர் கருதுகோள் சரிபார்ப்பு' },
  'Synthesizing Intelligence Briefing': { hi: 'साक्ष्य-आधारित उत्तर तैयार करना', ta: 'ஆதார அடிப்படையிலான பதிலை உருவாக்குகிறது' },
};

export function localizeActivityStage(stage: ActivityStage, language: ResponseLanguage): ActivityStage {
  if (language === 'en') return stage;
  const title = STAGE_TITLES[stage.title]?.[language] || stage.title;
  const summary = language === 'hi'
    ? (stage.status === 'running' ? `${title} जारी है…` : `${title} पूरा हुआ।`)
    : language === 'ta'
      ? (stage.status === 'running' ? `${title} நடைபெறுகிறது…` : `${title} முடிந்தது.`)
      : title;
  return { ...stage, title, summary };
}

export function processingFailureMessage(language: ResponseLanguage): string {
  const copy = answerCopy(language);
  const body = language === 'hi'
    ? ['प्रसंस्करण विफल होने के कारण जाँचा हुआ आकलन तैयार नहीं हो सका।', 'आवश्यक संरचित परिणाम पूरा न होने के कारण कोई निष्कर्ष नहीं दिया गया।', 'जाँच दोबारा चलाएँ।', 'समस्या बनी रहे तो उपयुक्त प्राथमिक स्रोत से दावे की पुष्टि करें।']
    : language === 'ta'
      ? ['செயலாக்கம் தோல்வியடைந்ததால் சரிபார்க்கப்பட்ட மதிப்பீட்டை உருவாக்க முடியவில்லை.', 'தேவையான கட்டமைக்கப்பட்ட முடிவு நிறைவடையாததால் தீர்மானம் வழங்கப்படவில்லை.', 'ஆய்வை மீண்டும் முயற்சிக்கவும்.', 'சிக்கல் தொடர்ந்தால் பொருத்தமான முதன்மை ஆதாரத்தில் கூற்றைச் சரிபார்க்கவும்.']
      : ['The investigation could not produce a validated assessment because processing failed.', 'No conclusion was assigned because the required structured result was not completed.', 'Retry the investigation.', 'If the problem continues, verify the claim through an appropriate primary source.'];
  return `### ${copy.headings.assessment}\n${body[0]}\n\n### ${copy.headings.reasons}\n- ${body[1]}\n\n### ${copy.headings.nextSteps}\n1. ${body[2]}\n2. ${body[3]}`;
}

export function localizedSuggestions(assessment: StructuredAssessment, language: ResponseLanguage): string[] {
  const copy = answerCopy(language);
  const steps = assessment.scamRisk === 'High' || assessment.scamRisk === 'Medium'
    ? copy.nextSteps.suspicious
    : copy.nextSteps[assessment.factualCorrectness];
  return steps.slice(0, 3);
}

export function localizedChallengerAudit(assessment: StructuredAssessment, original: string[], language: ResponseLanguage): string[] {
  if (language === 'en') return original;
  if (language === 'hi') return [
    assessment.factualCorrectness === 'Supported' ? 'वैकल्पिक व्याख्याओं की तुलना उपलब्ध साक्ष्य से की गई।' : 'समर्थन और खंडन करने वाले वैकल्पिक साक्ष्य की जाँच की गई।',
    assessment.evidenceSufficiency === 'Sufficient' ? 'निष्कर्ष उद्धृत साक्ष्य की सीमा तक सीमित रखा गया।' : 'साक्ष्य की कमी को दावे के गलत होने का प्रमाण नहीं माना गया।',
  ];
  if (language === 'ta') return [
    assessment.factualCorrectness === 'Supported' ? 'மாற்று விளக்கங்கள் கிடைக்கும் ஆதாரத்துடன் ஒப்பிடப்பட்டன.' : 'ஆதரிக்கும் மற்றும் மறுக்கும் மாற்று ஆதாரங்கள் பரிசீலிக்கப்பட்டன.',
    assessment.evidenceSufficiency === 'Sufficient' ? 'முடிவு மேற்கோள் ஆதாரத்தின் வரம்புக்குள் வைக்கப்பட்டது.' : 'ஆதாரம் இல்லாதது கூற்று தவறு என்பதற்கான சான்றாகக் கருதப்படவில்லை.',
  ];
  return original;
}

export function localizedVerdictLabel(value: string, language: ResponseLanguage): string {
  if (language === 'hi') return ({ supports: 'समर्थन', contradicts: 'खंडन', context: 'संदर्भ', Supported: 'समर्थित', Contradicted: 'खंडित', Mixed: 'मिश्रित', Unverified: 'अप्रमाणित' } as Record<string, string>)[value] || value;
  if (language === 'ta') return ({ supports: 'ஆதரிக்கிறது', contradicts: 'மறுக்கிறது', context: 'சூழல்', Supported: 'ஆதரிக்கப்பட்டது', Contradicted: 'மறுக்கப்பட்டது', Mixed: 'கலப்பு', Unverified: 'சரிபார்க்கப்படவில்லை' } as Record<string, string>)[value] || value;
  return value;
}
