export type TissProcedureLine = {
  tussCode: string;
  term: string;
  quantity: number;
  unitValueCents: number;
  totalValueCents: number;
  executionDate: string;
};

export type TissValidationError = {
  field: string;
  message: string;
};

export type TissGuidePayload = {
  registroANS: string;
  numeroGuiaPrestador: string;
  numeroGuiaOperadora?: string;
  dadosBeneficiario: {
    numeroCarteira: string;
    validadeCarteira?: string;
    nomeBeneficiario: string;
  };
  dadosContratadoExecutante: {
    codigoCNES?: string;
    cnpjContratado?: string;
    cpfContratado?: string;
    conselhoProfissional?: string;
    numeroConselho?: string;
    ufConselho?: string;
  };
  profissionalExecutante: {
    nomeProfissional: string;
    conselhoProfissional?: string;
    numeroConselho?: string;
    ufConselho?: string;
  };
  indicacaoAcidente: string;
  caraterAtendimento: string;
  tipoConsulta?: string;
  procedimentos: TissProcedureLine[];
  cid10?: string;
  dataAtendimento: string;
  horaAtendimento: string;
  senhaAutorizacao?: string;
};

export type TissBatchGuideRef = {
  guideId: string;
  guideNumber: number;
  totalValueCents: number;
};

export type BatchXmlInput = {
  tissVersion: string;
  ansRegistration: string;
  providerDocument: string;
  providerCodeAtInsurer?: string | null;
  providerCnes?: string | null;
  organizationName?: string | null;
  batchNumber: number;
  competence: string;
  guides: Array<{ guideType: string; payload: TissGuidePayload }>;
};

export type BatchXmlResult = {
  xml: string;
  hash: string;
};
