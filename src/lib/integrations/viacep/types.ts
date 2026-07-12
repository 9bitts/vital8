export type ViaCepAddress = {
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge?: string;
};

export interface CepLookupAdapter {
  lookup(cep: string): Promise<ViaCepAddress | null>;
}
