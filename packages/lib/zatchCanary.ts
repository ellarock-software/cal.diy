export function zatchCanaryAdd(a: number, b: number): number {
  // BUG: subtracts instead of adding.
  return a - b;
}
