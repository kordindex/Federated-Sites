/**
 * COHERENCE DIAGNOSTIC — SCORING ENGINE v1
 * The Coherence Co.
 *
 * Input:  answers[] — array of 20 strings, each 'A' | 'B' | 'C' | 'D'
 *         name      — string (participant first + last name)
 *         email     — string (participant email)
 *
 * Output: structured JSON result object
 *
 * Scoring:
 *   A = +2  (strong pressure signal)
 *   B = +1  (moderate pressure signal)
 *   C =  0  (coherent / neutral)
 *   D = -1  (deliberate coherence — actively rewarded)
 *
 * Pattern clusters:
 *   Interpretation Drift  — Q1–Q7   (index 0–6)
 *   Velocity Strain       — Q8–Q14  (index 7–13)
 *   Signal Suppression    — Q15–Q20 (index 14–19)
 *
 * Pressure levels (sum of ALL positive scores only):
 *   0–6   = Early Signals
 *   7–12  = Structural Pressure
 *   13+   = Systemic Strain
 *
 * Validity flag:
 *   14 or more D answers = likely_gamed flag set to true
 */

// ── Score map ────────────────────────────────────────────────────────────────
const SCORE_MAP = { A: 2, B: 1, C: 0, D: -1 };

// ── Pattern cluster definitions ──────────────────────────────────────────────
const CLUSTERS = {
  'Interpretation Drift': { start: 0, end: 6 },   // Q1–Q7
  'Velocity Strain':      { start: 7, end: 13 },  // Q8–Q14
  'Signal Suppression':   { start: 14, end: 19 }, // Q15–Q20
};

// ── Pressure level thresholds ────────────────────────────────────────────────
const PRESSURE_LEVELS = [
  { label: 'Systemic Strain',    min: 13 },
  { label: 'Structural Pressure', min: 7 },
  { label: 'Early Signals',       min: 0 },
];

// ── Validity flag threshold ──────────────────────────────────────────────────
const VALIDITY_THRESHOLD = 14;

// ── Report ID generator ──────────────────────────────────────────────────────
function generateReportId(primary) {
  const prefix = {
    'Interpretation Drift': 'ID',
    'Velocity Strain':      'VS',
    'Signal Suppression':   'SS',
  }[primary] || 'CD';
  const timestamp = Date.now().toString(36).toUpperCase();
  return 'CD-' + prefix + '-' + timestamp;
}

// ── Tie breaker ──────────────────────────────────────────────────────────────
// Priority order if scores are equal: Velocity Strain → Interpretation Drift → Signal Suppression
const TIE_PRIORITY = ['Velocity Strain', 'Interpretation Drift', 'Signal Suppression'];

function breakTie(patternNames) {
  return patternNames.sort((a, b) => TIE_PRIORITY.indexOf(a) - TIE_PRIORITY.indexOf(b));
}

// ── Main scoring function ────────────────────────────────────────────────────
function scorediagnostic(answers, name, email) {

  // ── Input validation ──
  if (!Array.isArray(answers) || answers.length !== 20) {
    throw new Error('answers must be an array of exactly 20 items');
  }
  const validAnswers = ['A', 'B', 'C', 'D'];
  answers.forEach(function(a, i) {
    if (!validAnswers.includes(a)) {
      throw new Error('Invalid answer "' + a + '" at index ' + i + '. Must be A, B, C, or D.');
    }
  });

  // ── Score each answer ──
  const scored = answers.map(function(a) { return SCORE_MAP[a]; });

  // ── Pattern scores ──
  const patternScores = {};
  Object.keys(CLUSTERS).forEach(function(pattern) {
    const cluster = CLUSTERS[pattern];
    let total = 0;
    for (let i = cluster.start; i <= cluster.end; i++) {
      total += scored[i];
    }
    patternScores[pattern] = total;
  });

  // ── Sort patterns by score (descending), apply tie breaker ──
  const sortedPatterns = Object.keys(patternScores).sort(function(a, b) {
    if (patternScores[b] !== patternScores[a]) {
      return patternScores[b] - patternScores[a];
    }
    return TIE_PRIORITY.indexOf(a) - TIE_PRIORITY.indexOf(b);
  });

  const primaryPattern   = sortedPatterns[0];
  const secondaryPattern = sortedPatterns[1];

  // ── Pressure level (sum of positive scores only) ──
  const positiveTotal = scored.reduce(function(sum, s) {
    return sum + (s > 0 ? s : 0);
  }, 0);

  const pressureLevel = PRESSURE_LEVELS.find(function(p) {
    return positiveTotal >= p.min;
  }).label;

  // ── D answer count and validity flag ──
  const dCount     = answers.filter(function(a) { return a === 'D'; }).length;
  const likelyGamed = dCount >= VALIDITY_THRESHOLD;

  // ── Raw answer breakdown per cluster (for Christine's lead notification) ──
  const answerBreakdown = {};
  Object.keys(CLUSTERS).forEach(function(pattern) {
    const cluster = CLUSTERS[pattern];
    const clusterAnswers = answers.slice(cluster.start, cluster.end + 1);
    answerBreakdown[pattern] = {
      answers: clusterAnswers,
      score:   patternScores[pattern],
      counts: {
        A: clusterAnswers.filter(function(a) { return a === 'A'; }).length,
        B: clusterAnswers.filter(function(a) { return a === 'B'; }).length,
        C: clusterAnswers.filter(function(a) { return a === 'C'; }).length,
        D: clusterAnswers.filter(function(a) { return a === 'D'; }).length,
      }
    };
  });

  // ── Gap type ──
  const primaryScore   = patternScores[primaryPattern];
  const secondaryScore = patternScores[secondaryPattern];
  const gap            = primaryScore - secondaryScore;

  let gapType;
  if (gap <= 2)       gapType = 'Interdependent Pattern';
  else if (gap >= 6)  gapType = 'Dominant Instability';
  else                gapType = 'Primary Drift';

  // ── Report ID ──
  const reportId = generateReportId(primaryPattern);

  // ── Timestamp ──
  const now = new Date();
  const dateISO = now.toISOString().split('T')[0];
  const dateDisplay = now.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // ── Build result object ──
  return {
    // Identity
    report_id:    reportId,
    date_iso:     dateISO,
    date_display: dateDisplay,
    participant: {
      name:  name,
      email: email,
    },

    // Pattern results
    patterns: {
      primary:   primaryPattern,
      secondary: secondaryPattern,
      tertiary:  sortedPatterns[2],
      scores:    patternScores,
      gap_type:  gapType,
    },

    // Pressure
    pressure: {
      level:          pressureLevel,
      positive_total: positiveTotal,
    },

    // Validity
    validity: {
      d_count:      dCount,
      likely_gamed: likelyGamed,
      flag_message: likelyGamed
        ? 'High D response rate (' + dCount + '/20). Results may not reflect actual conditions.'
        : null,
    },

    // Full answer breakdown (for Christine)
    answer_breakdown: answerBreakdown,

    // Raw answers (for Christine)
    raw_answers: answers,

    // Scored answers
    scored_answers: scored,
  };
}


// ────────────────────────────────────────────────────────────────────────────
// TEST SUITE — run in browser console or Node to verify engine
// ────────────────────────────────────────────────────────────────────────────

function runTests() {
  console.log('=== COHERENCE SCORING ENGINE — TEST SUITE ===\n');

  // Test 1: Strong Velocity Strain
  const test1 = scorediagnostic(
    ['A','A','A','A','A','A','A',  // Q1-7:  ID all A = +14
     'A','A','A','A','A','A','A',  // Q8-14: VS all A = +14 (tie with ID — VS wins by priority)
     'C','C','C','C','C','C'],     // Q15-20: SS all C = 0
    'Test User', 'test@test.com'
  );
  console.log('TEST 1 — Tied high pressure (VS should win tie):');
  console.log('  Primary:   ', test1.patterns.primary,   '(expected: Velocity Strain)');
  console.log('  Secondary: ', test1.patterns.secondary, '(expected: Interpretation Drift)');
  console.log('  Pressure:  ', test1.pressure.level,     '(expected: Systemic Strain)');
  console.log('  Gap type:  ', test1.patterns.gap_type,  '(expected: Interdependent Pattern)');
  console.log('  Report ID: ', test1.report_id);
  console.log();

  // Test 2: Strong Signal Suppression, moderate others
  const test2 = scorediagnostic(
    ['B','C','C','C','C','C','C',  // Q1-7:  ID = +1
     'B','B','C','C','C','C','C',  // Q8-14: VS = +2
     'A','A','A','B','B','A'],     // Q15-20: SS = +10
    'Sarah Chen', 'sarah@org.com'
  );
  console.log('TEST 2 — Clear Signal Suppression dominant:');
  console.log('  Primary:   ', test2.patterns.primary,   '(expected: Signal Suppression)');
  console.log('  Secondary: ', test2.patterns.secondary, '(expected: Velocity Strain)');
  console.log('  Pressure:  ', test2.pressure.level,     '(expected: Structural Pressure)');
  console.log('  Gap type:  ', test2.patterns.gap_type,  '(expected: Dominant Instability)');
  console.log();

  // Test 3: All D — deliberate coherence, validity flag
  const test3 = scorediagnostic(
    ['D','D','D','D','D','D','D',
     'D','D','D','D','D','D','D',
     'D','D','D','D','D','D'],
    'Likely Gamer', 'gamer@test.com'
  );
  console.log('TEST 3 — All D (validity flag should trigger):');
  console.log('  D count:      ', test3.validity.d_count,      '(expected: 20)');
  console.log('  Likely gamed: ', test3.validity.likely_gamed, '(expected: true)');
  console.log('  Flag message: ', test3.validity.flag_message);
  console.log('  All scores:   ', test3.patterns.scores,       '(expected: all -7 or -6)');
  console.log();

  // Test 4: Mixed realistic profile
  const test4 = scorediagnostic(
    ['A','B','A','C','B','A','B',  // Q1-7:  ID = +9
     'B','C','B','C','B','C','D',  // Q8-14: VS = +3
     'C','B','C','D','C','B'],     // Q15-20: SS = +2
    'James Wilson', 'jwilson@company.com'
  );
  console.log('TEST 4 — Realistic mixed profile:');
  console.log('  Primary:        ', test4.patterns.primary,          '(expected: Interpretation Drift)');
  console.log('  Secondary:      ', test4.patterns.secondary,        '(expected: Velocity Strain)');
  console.log('  Pressure total: ', test4.pressure.positive_total);
  console.log('  Pressure level: ', test4.pressure.level);
  console.log('  Gap type:       ', test4.patterns.gap_type);
  console.log('  Likely gamed:   ', test4.validity.likely_gamed,     '(expected: false)');
  console.log();

  // Test 5: Early signals — mostly C with a few B
  const test5 = scorediagnostic(
    ['C','C','B','C','C','C','C',  // Q1-7:  ID = +1
     'C','B','C','C','C','C','C',  // Q8-14: VS = +1
     'C','C','C','B','C','C'],     // Q15-20: SS = +1
    'Low Pressure', 'low@org.com'
  );
  console.log('TEST 5 — Early signals, low pressure:');
  console.log('  Pressure level: ', test5.pressure.level,   '(expected: Early Signals)');
  console.log('  Positive total: ', test5.pressure.positive_total, '(expected: 3)');
  console.log();

  // Test 6: Validation — bad input
  console.log('TEST 6 — Input validation (should throw):');
  try {
    scorediagnostic(['A','B'], 'Bad Input', 'bad@test.com');
    console.log('  ERROR: Should have thrown but did not');
  } catch(e) {
    console.log('  Correctly threw:', e.message);
  }

  console.log('\n=== ALL TESTS COMPLETE ===');
}

// Run tests if in Node environment
if (typeof module !== 'undefined') {
  module.exports = { scorediagnostic };
  runTests();
}

// Run tests if called directly in browser console
// To test: paste this file into console, then call runTests()