export const BASE_40_FLOOR = 40;
export const BASE_40_SPAN = 60;

export type GradeAssessment = {
  id: string;
  title: string;
  totalScore: number;
  componentId: string;
};

export type GradeComponent = {
  id: string;
  name: string;
  weight: number;
};

export type StudentGradeScore = {
  assessmentId: string;
  score: number | null;
  resultStatus?: string | null;
};

export type ComponentGradeBreakdown = {
  componentId: string;
  name: string;
  weight: number;
  earned: number;
  possible: number;
  percentage: number;
  componentGrade: number;
  contribution: number;
};

export type TermGradeCalculation = {
  complete: boolean;
  missingAssessmentIds: string[];
  rawPercentage: number | null;
  termGrade: number | null;
  components: ComponentGradeBreakdown[];
};

function boundedPercentage(value: number) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

export function base40Grade(rawPercentage: number) {
  const bounded = boundedPercentage(rawPercentage);
  return BASE_40_FLOOR + (bounded / 100) * BASE_40_SPAN;
}

/**
 * Mirrors the spreadsheet formula exactly:
 * (((earned / possible) * 60) + 40) * weight
 *
 * `weight` is expressed as a whole percentage (for example 40 for 40%).
 * Intermediate values intentionally remain unrounded. Rounding belongs only
 * at the final display/release boundary so component contributions reconcile
 * cleanly with the released term grade.
 */
export function calculateBase40Component(earned: number, possible: number, weight: number) {
  const safeEarned = Number.isFinite(Number(earned)) ? Number(earned) : 0;
  const safePossible = Number.isFinite(Number(possible)) ? Number(possible) : 0;
  const safeWeight = Number.isFinite(Number(weight)) ? Number(weight) : 0;

  const percentage = safePossible > 0
    ? boundedPercentage((safeEarned / safePossible) * 100)
    : 0;
  const componentGrade = base40Grade(percentage);
  const contribution = componentGrade * (safeWeight / 100);

  return { percentage, componentGrade, contribution };
}

export function roundGrade(value: number, digits: number) {
  const safeDigits = Math.min(2, Math.max(0, Math.trunc(digits || 0)));
  const factor = 10 ** safeDigits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateTermGrade(args: {
  components: GradeComponent[];
  assessments: GradeAssessment[];
  scores: StudentGradeScore[];
  roundingDigits?: number;
}): TermGradeCalculation {
  const scoreMap = new Map(args.scores.map((row) => [row.assessmentId, row]));
  const missing = args.assessments
    .filter((assessment) => {
      const row = scoreMap.get(assessment.id);
      return !row || row.score === null || row.score === undefined || row.resultStatus === "absent";
    })
    .map((assessment) => assessment.id);

  const componentRows: ComponentGradeBreakdown[] = args.components.map((component) => {
    const assigned = args.assessments.filter((assessment) => assessment.componentId === component.id);
    let earned = 0;
    let possible = 0;

    for (const assessment of assigned) {
      possible += Number(assessment.totalScore) || 0;
      const row = scoreMap.get(assessment.id);
      if (row && row.score !== null && row.score !== undefined && row.resultStatus !== "absent") {
        earned += Number(row.score) || 0;
      }
    }

    const { percentage, componentGrade, contribution } = calculateBase40Component(
      earned,
      possible,
      component.weight,
    );

    return {
      componentId: component.id,
      name: component.name,
      weight: component.weight,
      earned,
      possible,
      percentage,
      componentGrade,
      contribution,
    };
  });

  const invalidComponent = componentRows.some((row) => row.possible <= 0);
  if (missing.length || invalidComponent || !args.assessments.length) {
    return {
      complete: false,
      missingAssessmentIds: missing,
      rawPercentage: null,
      termGrade: null,
      components: componentRows,
    };
  }

  // Kept as a useful raw-performance reference only. The released academic
  // grade is the sum of the Base-40 weighted component contributions below.
  const rawPercentage = Math.min(
    100,
    Math.max(0, componentRows.reduce((sum, row) => sum + row.percentage * (row.weight / 100), 0)),
  );

  // This is the exact spreadsheet flow:
  // Σ [ (((earned / possible) * 60) + 40) * componentWeight ]
  // Do not round individual components before summing them.
  const exactTermGrade = componentRows.reduce((sum, row) => sum + row.contribution, 0);
  const termGrade = roundGrade(exactTermGrade, args.roundingDigits ?? 0);

  return {
    complete: true,
    missingAssessmentIds: [],
    rawPercentage,
    termGrade,
    components: componentRows,
  };
}
