export class RenderGeneration {
  private value = 0;

  next(): number { this.value += 1; return this.value; }
  isCurrent(generation: number): boolean { return generation === this.value; }
  invalidate(): number { return this.next(); }
  get current(): number { return this.value; }
}
