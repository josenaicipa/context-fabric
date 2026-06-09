/**
 * End-to-end fabric pipeline: route -> sanitize -> budget.
 *
 * This is the primary entry point for the SDK.
 */
import { Budgeter } from "./budgeter.js";
import { Router } from "./router.js";
import { Sanitizer } from "./sanitizer.js";
import type {
  ContextBundle,
  ContextChunk,
  ContextRequest,
  FabricConfig,
} from "./schemas.js";

export class Fabric {
  private readonly router: Router;
  private readonly sanitizer: Sanitizer;
  private readonly budgeter: Budgeter;

  constructor(config: FabricConfig = {}) {
    this.router = new Router(config.routing ?? []);
    this.sanitizer = new Sanitizer(config.sanitization ?? []);
    this.budgeter = new Budgeter(config.budget ?? { maxTokens: 8000 });
  }

  assemble(request: ContextRequest, chunks: ContextChunk[]): ContextBundle {
    const routed = this.router.route(request, chunks);

    const sanitized: ContextChunk[] = [];
    let redactions = 0;
    for (const chunk of routed) {
      const result = this.sanitizer.sanitizeChunk(chunk);
      sanitized.push(result.chunk);
      redactions += result.redactions;
    }

    const { kept, dropped, totalTokens } = this.budgeter.fit(sanitized);

    return {
      request,
      chunks: kept,
      totalTokens,
      droppedChunkIds: dropped,
      redactions,
    };
  }
}
