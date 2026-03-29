// ============================================================
// Taint Tracker — Data Flow Taint Analysis
// Ported from libs/aegis-defense/src/taint/
// ============================================================

export type TaintSource =
  | 'UserInput'
  | 'DatabaseQuery'
  | 'ApiResponse'
  | 'FileUpload'
  | 'LlmOutput'
  | 'ExternalApi'
  | 'InternalService';

export type SensitivityLevel = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';

export type TaintCategory =
  | 'PersonalData'
  | 'FinancialData'
  | 'HealthData'
  | 'Credential'
  | 'IntellectualProperty';

export type TaintBoundary =
  | 'ExternalNetwork'
  | 'PublicApi'
  | 'LlmProvider'
  | 'LogSystem'
  | 'ThirdPartyService'
  | 'UserInterface';

const SENSITIVITY_VALUES: Record<SensitivityLevel, number> = {
  None: 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export interface TaintTag {
  id: string;
  source: TaintSource;
  sensitivity: SensitivityLevel;
  categories: TaintCategory[];
  description: string;
  createdAt: number;
}

export interface TaintedData {
  dataId: string;
  tags: TaintTag[];
  propagationPath: PropagationStep[];
  currentSensitivity: SensitivityLevel;
  blocked: boolean;
}

export interface PropagationStep {
  fromDataId: string;
  toDataId: string;
  operation: string;
  timestamp: number;
  sensitivityBefore: SensitivityLevel;
  sensitivityAfter: SensitivityLevel;
}

export interface BoundaryCrossingResult {
  allowed: boolean;
  dataId: string;
  boundary: TaintBoundary;
  sensitivity: SensitivityLevel;
  violations: BoundaryViolation[];
  recommendation: string;
}

export interface BoundaryViolation {
  tagId: string;
  category: TaintCategory;
  sensitivity: SensitivityLevel;
  reason: string;
}

export interface TaintAuditEntry {
  timestamp: number;
  action: 'tag' | 'propagate' | 'boundary_check' | 'sanitize';
  dataId: string;
  details: string;
  result: 'allowed' | 'blocked' | 'warning';
}

/**
 * Boundary policies: which sensitivity levels are allowed to cross each boundary.
 * Values represent the maximum sensitivity level allowed.
 */
const BOUNDARY_POLICIES: Record<TaintBoundary, number> = {
  ExternalNetwork: SENSITIVITY_VALUES.Low,
  PublicApi: SENSITIVITY_VALUES.Low,
  LlmProvider: SENSITIVITY_VALUES.Medium,
  LogSystem: SENSITIVITY_VALUES.Low,
  ThirdPartyService: SENSITIVITY_VALUES.Low,
  UserInterface: SENSITIVITY_VALUES.Medium,
};

/**
 * Category-specific boundary restrictions.
 * Some categories have stricter rules for certain boundaries.
 */
const CATEGORY_BOUNDARY_RESTRICTIONS: Array<{
  category: TaintCategory;
  boundary: TaintBoundary;
  maxSensitivity: number;
}> = [
  { category: 'Credential', boundary: 'LogSystem', maxSensitivity: SENSITIVITY_VALUES.None },
  { category: 'Credential', boundary: 'ExternalNetwork', maxSensitivity: SENSITIVITY_VALUES.None },
  { category: 'Credential', boundary: 'LlmProvider', maxSensitivity: SENSITIVITY_VALUES.None },
  { category: 'PersonalData', boundary: 'LlmProvider', maxSensitivity: SENSITIVITY_VALUES.Low },
  { category: 'PersonalData', boundary: 'ThirdPartyService', maxSensitivity: SENSITIVITY_VALUES.None },
  { category: 'HealthData', boundary: 'ExternalNetwork', maxSensitivity: SENSITIVITY_VALUES.None },
  { category: 'HealthData', boundary: 'LlmProvider', maxSensitivity: SENSITIVITY_VALUES.None },
  { category: 'FinancialData', boundary: 'LogSystem', maxSensitivity: SENSITIVITY_VALUES.None },
  { category: 'IntellectualProperty', boundary: 'ExternalNetwork', maxSensitivity: SENSITIVITY_VALUES.Low },
];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the higher sensitivity level of two.
 */
function maxSensitivity(a: SensitivityLevel, b: SensitivityLevel): SensitivityLevel {
  const levels: SensitivityLevel[] = ['None', 'Low', 'Medium', 'High', 'Critical'];
  return SENSITIVITY_VALUES[a] >= SENSITIVITY_VALUES[b] ? a : b;
}

export class TaintTracker {
  private data: Map<string, TaintedData> = new Map();
  private auditLog: TaintAuditEntry[] = [];

  /**
   * Tag a data item with taint information.
   * If the data item already exists, the new tag is added to its existing tags.
   */
  tag(
    dataId: string,
    source: TaintSource,
    sensitivity: SensitivityLevel,
    categories: TaintCategory[],
    description: string,
  ): TaintTag {
    const tag: TaintTag = {
      id: uuid(),
      source,
      sensitivity,
      categories,
      description,
      createdAt: Date.now(),
    };

    const existing = this.data.get(dataId);
    if (existing) {
      existing.tags.push(tag);
      existing.currentSensitivity = maxSensitivity(existing.currentSensitivity, sensitivity);
    } else {
      this.data.set(dataId, {
        dataId,
        tags: [tag],
        propagationPath: [],
        currentSensitivity: sensitivity,
        blocked: false,
      });
    }

    this.auditLog.push({
      timestamp: Date.now(),
      action: 'tag',
      dataId,
      details: `Tagged as ${sensitivity} from ${source}: ${description}`,
      result: 'allowed',
    });

    return tag;
  }

  /**
   * Propagate taint from one data item to another through an operation.
   * The destination inherits all tags from the source, with sensitivity
   * potentially elevated based on the operation.
   */
  propagate(
    fromDataId: string,
    toDataId: string,
    operation: string,
  ): TaintedData | null {
    const source = this.data.get(fromDataId);
    if (!source) return null;

    const existing = this.data.get(toDataId);
    const sensitivityBefore = existing?.currentSensitivity ?? 'None';

    const step: PropagationStep = {
      fromDataId,
      toDataId,
      operation,
      timestamp: Date.now(),
      sensitivityBefore,
      sensitivityAfter: source.currentSensitivity,
    };

    if (existing) {
      // Merge tags (avoid duplicates by id)
      const existingTagIds = new Set(existing.tags.map((t) => t.id));
      for (const tag of source.tags) {
        if (!existingTagIds.has(tag.id)) {
          existing.tags.push(tag);
        }
      }
      existing.currentSensitivity = maxSensitivity(
        existing.currentSensitivity,
        source.currentSensitivity,
      );
      existing.propagationPath.push(step);
      step.sensitivityAfter = existing.currentSensitivity;
    } else {
      const newData: TaintedData = {
        dataId: toDataId,
        tags: [...source.tags],
        propagationPath: [...source.propagationPath, step],
        currentSensitivity: source.currentSensitivity,
        blocked: false,
      };
      step.sensitivityAfter = newData.currentSensitivity;
      this.data.set(toDataId, newData);
    }

    this.auditLog.push({
      timestamp: Date.now(),
      action: 'propagate',
      dataId: toDataId,
      details: `Propagated from ${fromDataId} via ${operation}. Sensitivity: ${sensitivityBefore} -> ${step.sensitivityAfter}`,
      result: 'allowed',
    });

    return this.data.get(toDataId)!;
  }

  /**
   * Check whether a data item is allowed to cross a boundary.
   * Evaluates both general boundary policies and category-specific restrictions.
   */
  checkBoundaryCrossing(dataId: string, boundary: TaintBoundary): BoundaryCrossingResult {
    const tainted = this.data.get(dataId);

    if (!tainted) {
      return {
        allowed: true,
        dataId,
        boundary,
        sensitivity: 'None',
        violations: [],
        recommendation: 'No taint information found. Allowing by default.',
      };
    }

    const violations: BoundaryViolation[] = [];
    const currentSensValue = SENSITIVITY_VALUES[tainted.currentSensitivity];
    const boundaryMax = BOUNDARY_POLICIES[boundary];

    // Check general boundary policy
    if (currentSensValue > boundaryMax) {
      for (const tag of tainted.tags) {
        if (SENSITIVITY_VALUES[tag.sensitivity] > boundaryMax) {
          violations.push({
            tagId: tag.id,
            category: tag.categories[0] ?? 'PersonalData',
            sensitivity: tag.sensitivity,
            reason: `Sensitivity level ${tag.sensitivity} exceeds boundary ${boundary} maximum`,
          });
        }
      }
    }

    // Check category-specific restrictions
    for (const restriction of CATEGORY_BOUNDARY_RESTRICTIONS) {
      if (restriction.boundary !== boundary) continue;
      for (const tag of tainted.tags) {
        if (
          tag.categories.includes(restriction.category) &&
          SENSITIVITY_VALUES[tag.sensitivity] > restriction.maxSensitivity
        ) {
          const alreadyViolated = violations.some((v) => v.tagId === tag.id);
          if (!alreadyViolated) {
            violations.push({
              tagId: tag.id,
              category: restriction.category,
              sensitivity: tag.sensitivity,
              reason: `Category ${restriction.category} with sensitivity ${tag.sensitivity} cannot cross ${boundary}`,
            });
          }
        }
      }
    }

    const allowed = violations.length === 0;

    if (!allowed) {
      tainted.blocked = true;
    }

    const recommendation = allowed
      ? `Data ${dataId} is clear to cross ${boundary} boundary.`
      : `BLOCKED: ${violations.length} violation(s) found. Sanitize or redact sensitive data before crossing ${boundary}.`;

    this.auditLog.push({
      timestamp: Date.now(),
      action: 'boundary_check',
      dataId,
      details: `Boundary: ${boundary}. Violations: ${violations.length}`,
      result: allowed ? 'allowed' : 'blocked',
    });

    return {
      allowed,
      dataId,
      boundary,
      sensitivity: tainted.currentSensitivity,
      violations,
      recommendation,
    };
  }

  /**
   * Get the propagation path for a data item.
   */
  getPropagationPath(dataId: string): PropagationStep[] {
    return this.data.get(dataId)?.propagationPath ?? [];
  }

  /**
   * Get the full audit log.
   */
  getAuditLog(): TaintAuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get taint info for a specific data item.
   */
  getTaint(dataId: string): TaintedData | null {
    return this.data.get(dataId) ?? null;
  }

  /**
   * Sanitize a data item: remove all taint tags and reset sensitivity.
   */
  sanitize(dataId: string): boolean {
    const tainted = this.data.get(dataId);
    if (!tainted) return false;

    tainted.tags = [];
    tainted.currentSensitivity = 'None';
    tainted.blocked = false;

    this.auditLog.push({
      timestamp: Date.now(),
      action: 'sanitize',
      dataId,
      details: 'All taint tags removed. Sensitivity reset to None.',
      result: 'allowed',
    });

    return true;
  }

  /**
   * Total number of tracked data items.
   */
  trackedCount(): number {
    return this.data.size;
  }

  /**
   * Clear all tracking data and audit log.
   */
  reset(): void {
    this.data.clear();
    this.auditLog = [];
  }
}
