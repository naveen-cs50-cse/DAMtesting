export interface ManipulationVector {
  id: 'urgency' | 'authority' | 'fear' | 'greed' | 'contagion';
  name: string;
  score: number; // 0 to 100
  level: 'None' | 'Low' | 'Medium' | 'High' | 'Severe';
  detectedTriggers: string[];
  explanation: string;
}

export interface ManipulationAudit {
  overallIndex: number; // 0 to 100
  threatLevel: 'Low' | 'Moderate' | 'Severe' | 'Critical';
  summary: string;
  vectors: ManipulationVector[];
  counterMeasure: string;
}

interface PatternRule {
  id: 'urgency' | 'authority' | 'fear' | 'greed' | 'contagion';
  name: string;
  keywords: string[];
  explanation: string;
}

const MANIPULATION_PATTERNS: PatternRule[] = [
  {
    id: 'urgency',
    name: 'False Urgency Vector',
    keywords: [
      'urgent', 'urgently', 'immediately', 'tonight', '9:30 pm', '9.30 pm', 'within 2 hours',
      'within 24 hours', 'within 1 hour', 'today itself', 'before midnight', 'last chance',
      'expires today', 'action required now', 'immediate disconnect', 'without delay', 'hurry'
    ],
    explanation: 'Imposes synthetic artificial deadlines to bypass deliberate cognitive evaluation and induce panic compliance.'
  },
  {
    id: 'authority',
    name: 'Authority Impersonation',
    keywords: [
      'supreme court', 'cbi', 'customs', 'trai', 'rbi', 'governor', 'police', 'mumbai police',
      'delhi police', 'cyber crime cell', 'electricity board', 'discom', 'power department',
      'incometax', 'income tax', 'modi government', 'pm kisan', 'yojana', 'dot', 'telecom department'
    ],
    explanation: 'Weaponizes statutory authority, official heraldry, or government offices to trigger subconscious obedience.'
  },
  {
    id: 'fear',
    name: 'Fear & Coercion Vector',
    keywords: [
      'arrest', 'digital arrest', 'warrant', 'fir', 'legal action', 'court summons', 'prosecution',
      'electricity will be disconnected', 'power disconnect', 'sim will be blocked', 'sim block',
      'account frozen', 'bank freeze', 'jail', 'penalty of rs', 'fine of rs', 'non-bailable'
    ],
    explanation: 'Leverages acute emotional dread of sudden power loss, asset seizure, or criminal arrest to paralyze skepticism.'
  },
  {
    id: 'greed',
    name: 'Financial Bait & Greed Hook',
    keywords: [
      'lottery', 'won rs', 'cash prize', 'cashback', 'reward points', 'points expiring',
      'free recharge', 'part time job', 'earn 3000', 'daily income', 'bonus credited',
      'crypto payout', 'subsidy amount', 'guaranteed return'
    ],
    explanation: 'Dangles unearned monetary windfalls or artificial loss-aversion triggers to extract banking credentials or OTPs.'
  },
  {
    id: 'contagion',
    name: 'Viral Contagion / Herd Pressure',
    keywords: [
      'forward to all', 'share with 10', 'forward to 5 groups', 'share to activate',
      'forward to every group', 'spread this message', 'urgent notice to all citizens',
      'every indian must share', 'dont delete without forwarding'
    ],
    explanation: 'Exploits civic responsibility and peer network trust to weaponize citizens into unpaid disinformation relays.'
  }
];

export function analyzeManipulationVectors(
  prompt: string = '',
  extractedText: string = ''
): ManipulationAudit {
  const combined = `${prompt} ${extractedText}`.toLowerCase();

  const vectors: ManipulationVector[] = MANIPULATION_PATTERNS.map(pattern => {
    const matchedTriggers: string[] = [];
    let matchCount = 0;

    for (const kw of pattern.keywords) {
      if (combined.includes(kw)) {
        matchedTriggers.push(kw);
        matchCount++;
      }
    }

    // Score calculation based on match density and weight
    let score = 0;
    if (matchCount === 1) score = 40;
    else if (matchCount === 2) score = 70;
    else if (matchCount >= 3) score = Math.min(100, 70 + (matchCount - 2) * 12);

    let level: 'None' | 'Low' | 'Medium' | 'High' | 'Severe' = 'None';
    if (score >= 80) level = 'Severe';
    else if (score >= 60) level = 'High';
    else if (score >= 35) level = 'Medium';
    else if (score > 0) level = 'Low';

    return {
      id: pattern.id,
      name: pattern.name,
      score,
      level,
      detectedTriggers: Array.from(new Set(matchedTriggers)),
      explanation: pattern.explanation
    };
  });

  // Calculate weighted overall index
  const activeVectors = vectors.filter(v => v.score > 0);
  const maxScore = Math.max(...vectors.map(v => v.score), 0);
  const avgScore = activeVectors.length > 0
    ? activeVectors.reduce((acc, v) => acc + v.score, 0) / activeVectors.length
    : 0;

  // Composite PMI (heavily influenced by highest peak trigger)
  const rawIndex = activeVectors.length > 0 ? (maxScore * 0.7 + avgScore * 0.3) : 0;
  const overallIndex = Math.min(100, Math.round(rawIndex));

  let threatLevel: 'Low' | 'Moderate' | 'Severe' | 'Critical' = 'Low';
  if (overallIndex >= 75) threatLevel = 'Critical';
  else if (overallIndex >= 50) threatLevel = 'Severe';
  else if (overallIndex >= 25) threatLevel = 'Moderate';

  let summary = 'No distinct psychological coercion patterns detected in the communication.';
  if (threatLevel === 'Critical') {
    summary = 'Acute psychological exploitation detected. The message employs synchronized panic, authority coercion, and strict deadlines to suppress critical thought.';
  } else if (threatLevel === 'Severe') {
    summary = 'Significant social engineering vectors identified. Coercive framing is being used to induce rapid, unverified compliance.';
  } else if (threatLevel === 'Moderate') {
    summary = 'Subtle persuasive or urgency triggers observed. Verify facts before taking irreversible actions.';
  }

  const counterMeasure = overallIndex >= 50
    ? 'Tactical Cognitive Pause: Scammers rely on forced haste. Disconnecting communication and pausing for 15 minutes neutralizes over 95% of social engineering traps.'
    : 'Standard Verification: Cross-reference unverified notices with primary institutional registries before forwarding or replying.';

  return {
    overallIndex,
    threatLevel,
    summary,
    vectors,
    counterMeasure
  };
}
