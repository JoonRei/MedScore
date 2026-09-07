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
  parentComponentId?: string | null;
};

export type StudentGradeScore = {
  assessmentId: string;
  score: number | null;
  resultStatus?: string | null;
};

export type SubcomponentGradeBreakdown = {
  componentId: string;
  name: string;
  weight: number;
  earned: number;
  possible: number;
  percentage: number;
  rawShare: number;
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
  subcomponents?: SubcomponentGradeBreakdown[];
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
 * Mirrors the MedScores Base-40 spreadsheet flow:
 * (((earned / possible) * 60) + 40) * weight
 *
 * Weight is a whole percentage (40 means 40%). Intermediate values remain
 * unrounded; rounding is applied only at the released grade boundary.
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

function aggregateAssigned(args: {
  componentId: string;
  assessments: GradeAssessment[];
  scoreMap: Map<string, StudentGradeScore>;
}) {
  const assigned = args.assessments.filter((assessment) => assessment.componentId === args.componentId);
  let earned = 0;
  let possible = 0;
  const missing: string[] = [];

  for (const assessment of assigned) {
    possible += Number(assessment.totalScore) || 0;
    const row = args.scoreMap.get(assessment.id);
    if (!row || row.score === null || row.score === undefined || row.resultStatus === "absent") {
      missing.push(assessment.id);
      continue;
    }
    earned += Number(row.score) || 0;
  }

  const percentage = possible > 0 ? boundedPercentage((earned / possible) * 100) : 0;
  return { assigned, earned, possible, percentage, missing };
}

/**
 * Supports both ordinary components and one optional nested subcomponent level.
 *
 * Ordinary component:
 *   pooled raw % -> Base-40 -> top-level component weight
 *
 * Component with subcomponents:
 *   each child's pooled raw % -> child relative weight -> parent raw %
 *   -> Base-40 -> parent top-level weight
 *
 * Child weights are relative inside their parent and must total 100%.
 */
export function calculateTermGrade(args: {
  components: GradeComponent[];
  assessments: GradeAssessment[];
  scores: StudentGradeScore[];
  roundingDigits?: number;
}): TermGradeCalculation {
  const scoreMap = new Map(args.scores.map((row) => [row.assessmentId, row]));
  const topLevel = args.components.filter((component) => !component.parentComponentId);
  const missingAssessmentIds = new Set<string>();
  let invalidConfiguration = topLevel.length === 0;

  const componentRows: ComponentGradeBreakdown[] = topLevel.map((component) => {
    const children = args.components.filter((row) => row.parentComponentId === component.id);

    if (!children.length) {
      const aggregate = aggregateAssigned({ componentId: component.id, assessments: args.assessments, scoreMap });
      aggregate.missing.forEach((id) => missingAssessmentIds.add(id));
      if (!aggregate.assigned.length || aggregate.possible <= 0) invalidConfiguration = true;

      const { componentGrade, contribution } = calculateBase40Component(
        aggregate.earned,
        aggregate.possible,
        component.weight,
      );

      return {
        componentId: component.id,
        name: component.name,
        weight: component.weight,
        earned: aggregate.earned,
        possible: aggregate.possible,
        percentage: aggregate.percentage,
        componentGrade,
        contribution,
      };
    }

    const childWeightTotal = children.reduce((sum, child) => sum + (Number(child.weight) || 0), 0);
    if (Math.abs(childWeightTotal - 100) > 0.001) invalidConfiguration = true;

    let earned = 0;
    let possible = 0;
    let parentRawPercentage = 0;

    const subcomponents: SubcomponentGradeBreakdown[] = children.map((child) => {
      const aggregate = aggregateAssigned({ componentId: child.id, assessments: args.assessments, scoreMap });
      aggregate.missing.forEach((id) => missingAssessmentIds.add(id));
      if (!aggregate.assigned.length || aggregate.possible <= 0) invalidConfiguration = true;

      earned += aggregate.earned;
      possible += aggregate.possible;
      const rawShare = aggregate.percentage * ((Number(child.weight) || 0) / 100);
      parentRawPercentage += rawShare;

      return {
        componentId: child.id,
        name: child.name,
        weight: child.weight,
        earned: aggregate.earned,
        possible: aggregate.possible,
        percentage: aggregate.percentage,
        rawShare,
      };
    });

    const percentage = boundedPercentage(parentRawPercentage);
    const componentGrade = base40Grade(percentage);
    const contribution = componentGrade * ((Number(component.weight) || 0) / 100);

    return {
      componentId: component.id,
      name: component.name,
      weight: component.weight,
      earned,
      possible,
      percentage,
      componentGrade,
      contribution,
      subcomponents,
    };
  });

  const missing = Array.from(missingAssessmentIds);
  // A missing/unrecorded assessment remains in the denominator and contributes
  // zero earned points. It should lower the student's grade, not block it.
  // Keep the missing IDs for an audit note in the UI.
  if (invalidConfiguration || !args.assessments.length) {
    return {
      complete: false,
      missingAssessmentIds: missing,
      rawPercentage: null,
      termGrade: null,
      components: componentRows,
    };
  }

  const rawPercentage = boundedPercentage(
    componentRows.reduce((sum, row) => sum + row.percentage * (row.weight / 100), 0),
  );
  const exactTermGrade = componentRows.reduce((sum, row) => sum + row.contribution, 0);
  const termGrade = roundGrade(exactTermGrade, args.roundingDigits ?? 0);

  return {
    complete: true,
    missingAssessmentIds: missing,
    rawPercentage,
    termGrade,
    components: componentRows,
  };
}

export type WeightedGradePart = {
  key: string;
  name: string;
  weight: number;
  complete: boolean;
  rawPercentage: number | null;
  termGrade: number | null;
};

export type WeightedTermGradeCalculation = {
  complete: boolean;
  weightTotal: number;
  rawPercentage: number | null;
  termGrade: number | null;
};

/**
 * Combines independently calculated grade types into one subject grade.
 *
 * Example:
 *   Lecture 85 × 70% + Laboratory 90 × 30% = 86.5
 *
 * Each grade type keeps its own 100%-based component structure. The weights
 * supplied here describe only how much that finished grade type contributes
 * to the final subject grade.
 */
export function calculateWeightedTermGrade(args: {
  grades: WeightedGradePart[];
  roundingDigits?: number;
}): WeightedTermGradeCalculation {
  const weightTotal = args.grades.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const validWeights = args.grades.length > 0
    && args.grades.every((row) => Number.isFinite(Number(row.weight)) && Number(row.weight) > 0)
    && Math.abs(weightTotal - 100) < 0.001;
  const complete = validWeights
    && args.grades.every((row) => row.complete && row.termGrade != null && row.rawPercentage != null);

  if (!complete) {
    return {
      complete: false,
      weightTotal,
      rawPercentage: null,
      termGrade: null,
    };
  }

  const rawPercentage = boundedPercentage(args.grades.reduce(
    (sum, row) => sum + Number(row.rawPercentage) * (Number(row.weight) / 100),
    0,
  ));
  const exactGrade = args.grades.reduce(
    (sum, row) => sum + Number(row.termGrade) * (Number(row.weight) / 100),
    0,
  );

  return {
    complete: true,
    weightTotal,
    rawPercentage,
    termGrade: roundGrade(exactGrade, args.roundingDigits ?? 0),
  };
}

