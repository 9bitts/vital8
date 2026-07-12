import type { CepLookupAdapter, ViaCepAddress } from "./types";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  erro?: boolean;
};

export class ViaCepAdapter implements CepLookupAdapter {
  async lookup(cep: string): Promise<ViaCepAddress | null> {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return null;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        next: { revalidate: 86400 },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as ViaCepResponse;
      if (data.erro) return null;

      return {
        cep: data.cep ?? digits,
        street: data.logradouro ?? "",
        complement: data.complemento ?? "",
        neighborhood: data.bairro ?? "",
        city: data.localidade ?? "",
        state: data.uf ?? "",
        ibge: data.ibge,
      };
    } catch {
      return null;
    }
  }
}
