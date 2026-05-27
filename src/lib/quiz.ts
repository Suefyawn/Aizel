// ============================================================================
// Hair routine quiz — question bank + scoring engine.
//
// The quiz is pure data so we can render it from a server component (questions
// page) AND score it from a server action (results page) without duplicating
// the rules. Each answer carries a `picks` map that adds weight to one or
// more hair-care category labels; the result page sums the weights and picks
// the top category to merchandise.
//
// Why category-led (not brand-led) recommendations:
//   • A new shopper rarely brands-shops first time.
//   • Categories map directly onto our existing filter rail — no schema work.
//   • If we later layer ingredient tags ("sulphate-free", "protein-light")
//     the same answer→pick map extends to add them without rewriting.
// ============================================================================

/** Category labels MUST match leaves in TAXONS.hair[].categories (and a couple
 *  of body-care leaves where the answer crosses over — moisture seekers
 *  benefit from butters & oils too). */
export type ScoreMap = Partial<Record<string, number>>;

export interface QuizAnswer {
  id: string;          // stable token for analytics
  label: string;       // shown to the user
  picks: ScoreMap;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  /** Optional short helper line under the prompt. */
  helper?: string;
  answers: QuizAnswer[];
}

// Five questions — short enough to finish on a phone in under 60 seconds,
// long enough to differentiate. The answer-ordering puts the most-common
// pick first so most shoppers tap the first option in each row.
export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'curl',
    prompt: 'What does your hair pattern look like?',
    helper: 'Use the Type 1–4 system if you know it — pick the closest match.',
    answers: [
      { id: 'type-4',  label: 'Type 4 — tight coils, dense',
        picks: { 'Hair Treatments & Masks': 2, 'Curl & Styling Creams': 2, 'Hair Oils & Serums': 1, 'Cocoa & Shea Butter': 1 } },
      { id: 'type-3',  label: 'Type 3 — defined curls, springy',
        picks: { 'Curl & Styling Creams': 3, 'Hair Treatments & Masks': 1, 'Mousse & Hairspray': 1 } },
      { id: 'type-2',  label: 'Type 2 — wavy, soft S-bends',
        picks: { 'Mousse & Hairspray': 2, 'Curl & Styling Creams': 1, 'Shampoo': 1, 'Conditioner': 1 } },
      { id: 'unsure',  label: 'Not sure — a mix',
        picks: { 'Curl & Styling Creams': 1, 'Leave-In Conditioner': 1, 'Hair Treatments & Masks': 1 } },
    ],
  },
  {
    id: 'porosity',
    prompt: 'How does your hair respond to water?',
    helper: 'Pop a strand in a glass of water — sinks fast or floats?',
    answers: [
      { id: 'high', label: 'Soaks up fast (high porosity)',
        picks: { 'Hair Treatments & Masks': 3, 'Hair Oils & Serums': 2, 'Cocoa & Shea Butter': 1 } },
      { id: 'low',  label: 'Beads up & rolls off (low porosity)',
        // Low porosity benefits from a clarifying shampoo + lightweight
        // leave-in to avoid product build-up. Combo packs are too heavy
        // here — single-purpose Shampoo + Leave-In is the right pick.
        picks: { 'Shampoo': 2, 'Leave-In Conditioner': 1, 'Hair Oils & Serums': 1 } },
      { id: 'mid',  label: 'Somewhere in between (medium porosity)',
        picks: { 'Hair Oils & Serums': 1, 'Curl & Styling Creams': 1, 'Leave-In Conditioner': 1 } },
      { id: 'unsure', label: 'Not sure',
        picks: { 'Hair Oils & Serums': 1, 'Leave-In Conditioner': 1 } },
    ],
  },
  {
    id: 'feels',
    prompt: 'Right now my hair feels…',
    answers: [
      { id: 'dry',     label: 'Dry & brittle',
        picks: { 'Cocoa & Shea Butter': 3, 'Hair Treatments & Masks': 2, 'Hair Oils & Serums': 2 } },
      { id: 'frizzy',  label: 'Frizzy & undefined',
        picks: { 'Curl & Styling Creams': 3, 'Mousse & Hairspray': 1, 'Hair Oils & Serums': 1 } },
      { id: 'limp',    label: 'Limp & flat',
        picks: { 'Mousse & Hairspray': 3, 'Curl & Styling Creams': 1, 'Shampoo': 1 } },
      { id: 'healthy', label: 'Healthy — just maintenance',
        picks: { 'Hair Oils & Serums': 2, 'Shampoo': 1, 'Conditioner': 1 } },
    ],
  },
  {
    id: 'goal',
    prompt: 'My top goal right now is…',
    answers: [
      { id: 'moisture', label: 'Deep moisture',
        picks: { 'Hair Treatments & Masks': 3, 'Cocoa & Shea Butter': 2, 'Hair Oils & Serums': 1 } },
      { id: 'definition', label: 'Curl definition',
        picks: { 'Curl & Styling Creams': 3, 'Mousse & Hairspray': 1 } },
      { id: 'length', label: 'Length retention',
        picks: { 'Hair Oils & Serums': 3, 'Hair Treatments & Masks': 2 } },
      { id: 'edges', label: 'Laid edges & hold',
        picks: { 'Edge Control & Gels': 3, 'Mousse & Hairspray': 1 } },
    ],
  },
  {
    id: 'time',
    prompt: 'How long does your wash day take?',
    answers: [
      { id: 'quick', label: 'Quick — under 10 minutes',
        // Quick wash favours combo packs — one set instead of separate
        // shampoo + conditioner bottles to grab.
        picks: { 'Shampoo & Conditioner': 2, 'Leave-In Conditioner': 1, 'Curl & Styling Creams': 1 } },
      { id: 'mid',   label: '10–30 minutes',
        picks: { 'Curl & Styling Creams': 1, 'Hair Oils & Serums': 1, 'Leave-In Conditioner': 1 } },
      { id: 'long',  label: 'Wash day all day',
        picks: { 'Hair Treatments & Masks': 2, 'Cocoa & Shea Butter': 1, 'Hair Oils & Serums': 1 } },
    ],
  },
];

export interface ScoredResult {
  /** Top hair-care category that earned the highest cumulative weight. */
  topCategory: string;
  /** Up to three runner-up categories, used to colour the result page rail. */
  alsoConsider: string[];
  /** Plain-English summary line composed from the user's selections — surfaces
   *  on the result page so the recommendation feels narrated, not arbitrary. */
  summary: string;
  /** Echo of the chosen answers (id pairs) for analytics / linkable recap. */
  selections: Array<{ questionId: string; answerId: string }>;
}

/**
 * Score a set of answers (one per question, indexed by question id) into a
 * recommendation. Unknown / missing answers are tolerated — the engine just
 * picks the strongest category from whatever it was given.
 */
export function scoreAnswers(answers: Record<string, string>): ScoredResult {
  const totals: Record<string, number> = {};
  const selections: ScoredResult['selections'] = [];
  const chosenLabels: string[] = [];

  for (const q of QUESTIONS) {
    const choice = answers[q.id];
    if (!choice) continue;
    const ans = q.answers.find(a => a.id === choice);
    if (!ans) continue;
    selections.push({ questionId: q.id, answerId: ans.id });
    chosenLabels.push(ans.label.toLowerCase());
    for (const [cat, weight] of Object.entries(ans.picks)) {
      totals[cat] = (totals[cat] ?? 0) + (weight ?? 0);
    }
  }

  // Sort categories by total weight desc; tie-break alphabetically so the
  // result is deterministic across re-renders.
  const ranked = Object.entries(totals)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([cat]) => cat);

  const topCategory = ranked[0] ?? 'Curl & Styling Creams';
  const alsoConsider = ranked.slice(1, 4);

  // Compose a short narrative ("For your tight coils & high porosity, deep
  // moisture is the priority") so the result feels personal.
  const curlText = answers.curl === 'type-4' ? 'tight coils'
    : answers.curl === 'type-3'  ? 'defined curls'
    : answers.curl === 'type-2'  ? 'soft waves'
    : 'mixed-texture hair';
  const porosityText = answers.porosity === 'high' ? 'high-porosity strands'
    : answers.porosity === 'low' ? 'low-porosity strands'
    : 'medium-porosity strands';
  const goalText = answers.goal === 'moisture' ? 'deep moisture is the priority'
    : answers.goal === 'definition' ? 'definition is the priority'
    : answers.goal === 'length' ? 'length retention is the priority'
    : answers.goal === 'edges' ? 'laid edges are the priority'
    : 'a balanced routine works best';

  const summary = `For your ${curlText} & ${porosityText}, ${goalText}.`;

  return { topCategory, alsoConsider, summary, selections };
}
