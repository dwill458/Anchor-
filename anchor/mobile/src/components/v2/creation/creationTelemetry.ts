/**
 * Timestamp instrumentation and cross-device timing measurement for the Anchor creation flow.
 *
 * Captures wall-clock milliseconds for the 9 canonical stages:
 *  1. Distillation begins
 *  2. Distillation ends
 *  3. Kamea mapping begins
 *  4. First letter begins movement
 *  5. Final letter reaches mapped position
 *  6. First geometry stroke begins
 *  7. Final geometry stroke completes
 *  8. Final reveal begins
 *  9. Reveal completes
 *
 * Provides live log output and an in-memory subscription for debug cards / diagnostics.
 */

export type CreationTimingPhase =
  | 'distillation_begin'
  | 'distillation_end'
  | 'kamea_mapping_begin'
  | 'first_letter_movement'
  | 'final_letter_mapped'
  | 'first_geometry_stroke'
  | 'final_geometry_stroke'
  | 'final_reveal_begin'
  | 'reveal_complete';

export interface CreationTimingRecord {
  phase: CreationTimingPhase;
  stepNumber: number;
  label: string;
  timestamp: number;
  deltaMs: number;
  elapsedMs: number;
  extra?: Record<string, unknown>;
}

const PHASE_METADATA: Record<CreationTimingPhase, { stepNumber: number; label: string }> = {
  distillation_begin: { stepNumber: 1, label: 'Distillation begins' },
  distillation_end: { stepNumber: 2, label: 'Distillation ends' },
  kamea_mapping_begin: { stepNumber: 3, label: 'Kamea mapping begins' },
  first_letter_movement: { stepNumber: 4, label: 'First letter begins movement' },
  final_letter_mapped: { stepNumber: 5, label: 'Final letter reaches mapped position' },
  first_geometry_stroke: { stepNumber: 6, label: 'First geometry stroke begins' },
  final_geometry_stroke: { stepNumber: 7, label: 'Final geometry stroke completes' },
  final_reveal_begin: { stepNumber: 8, label: 'Final reveal begins' },
  reveal_complete: { stepNumber: 9, label: 'Reveal completes' },
};

class CreationTimingTracker {
  private records: CreationTimingRecord[] = [];
  private sessionStart: number = 0;
  private lastTimestamp: number = 0;
  private listeners: Set<(records: CreationTimingRecord[]) => void> = new Set();

  public reset(phase: CreationTimingPhase = 'distillation_begin'): void {
    this.records = [];
    this.sessionStart = Date.now();
    this.lastTimestamp = this.sessionStart;
    this.record(phase);
  }

  public record(phase: CreationTimingPhase, extra?: Record<string, unknown>): CreationTimingRecord {
    const now = Date.now();
    if (!this.sessionStart || phase === 'distillation_begin') {
      this.sessionStart = now;
      this.lastTimestamp = now;
      this.records = [];
    }

    const deltaMs = now - this.lastTimestamp;
    const elapsedMs = now - this.sessionStart;
    this.lastTimestamp = now;

    const meta = PHASE_METADATA[phase];
    const record: CreationTimingRecord = {
      phase,
      stepNumber: meta.stepNumber,
      label: meta.label,
      timestamp: now,
      deltaMs,
      elapsedMs,
      extra,
    };

    this.records.push(record);

    // Terminal log format for physical device verification (Metro terminal / adb logcat)
    console.log(
      `[CreationTiming] ${record.stepNumber}/9: ${record.label} | +${deltaMs}ms | total: ${elapsedMs}ms${
        extra ? ` | ${JSON.stringify(extra)}` : ''
      }`
    );

    this.notify();
    return record;
  }

  public getRecords(): CreationTimingRecord[] {
    return [...this.records];
  }

  public subscribe(listener: (records: CreationTimingRecord[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.records]);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const copy = [...this.records];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }
}

export const creationTimingTracker = new CreationTimingTracker();
