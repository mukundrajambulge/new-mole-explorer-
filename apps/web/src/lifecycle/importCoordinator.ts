export type ImportOperation = { generation: number; signal: AbortSignal };

export class LatestImportCoordinator {
  private generation = 0;
  private controller: AbortController | null = null;

  begin(): ImportOperation {
    this.controller?.abort();
    this.controller = new AbortController();
    this.generation += 1;
    return { generation: this.generation, signal: this.controller.signal };
  }

  isCurrent(operation: ImportOperation): boolean { return operation.generation === this.generation && !operation.signal.aborted; }

  finish(operation: ImportOperation): void {
    if (this.isCurrent(operation)) this.controller = null;
  }

  cancel(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }
}
