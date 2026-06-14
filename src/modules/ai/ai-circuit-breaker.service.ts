import { Injectable } from '@nestjs/common';

interface BreakerState {
  failures: number;
  windowStartMs: number;
  openUntilMs: number;
}

/** Stops AI auto-reply after repeated failures (per session). */
@Injectable()
export class AiCircuitBreakerService {
  private readonly states = new Map<string, BreakerState>();

  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly WINDOW_MS = 5 * 60 * 1000;
  private static readonly OPEN_MS = 15 * 60 * 1000;

  isOpen(sessionId: string): boolean {
    const state = this.states.get(sessionId);
    if (!state) return false;
    if (state.openUntilMs > Date.now()) return true;
    if (state.openUntilMs > 0 && state.openUntilMs <= Date.now()) {
      this.states.delete(sessionId);
    }
    return false;
  }

  recordSuccess(sessionId: string): void {
    this.states.delete(sessionId);
  }

  recordFailure(sessionId: string): boolean {
    const now = Date.now();
    let state = this.states.get(sessionId);
    if (!state || now - state.windowStartMs > AiCircuitBreakerService.WINDOW_MS) {
      state = { failures: 0, windowStartMs: now, openUntilMs: 0 };
    }
    state.failures += 1;
    if (state.failures >= AiCircuitBreakerService.FAILURE_THRESHOLD) {
      state.openUntilMs = now + AiCircuitBreakerService.OPEN_MS;
      this.states.set(sessionId, state);
      return true;
    }
    this.states.set(sessionId, state);
    return false;
  }
}
