export function calculateBmi(weightKg: number, heightCm: number): number {
  return weightKg / (heightCm / 100) ** 2
}
