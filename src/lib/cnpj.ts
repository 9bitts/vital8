export function stripCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function isValidCnpj(cnpj: string): boolean {
  const d = stripCnpj(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;

  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base[i]!, 10) * weights[i]!;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(d.slice(0, 12), w1);
  const d2 = calc(d.slice(0, 12) + String(d1), w2);

  return d.endsWith(`${d1}${d2}`);
}
