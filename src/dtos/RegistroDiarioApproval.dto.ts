// src/dtos/RegistroDiarioApprovalDtos.ts
export type SupervisorApprovalDto = {
  aprobacionSupervisor: boolean;
  correccionHecha?: boolean;
  codigoSupervisor?: string;
  comentarioSupervisor?: string;
};

export type RrhhApprovalDto = {
  aprobacionRrhh: boolean;
  correccionHecha?: boolean;
  codigoRrhh?: string;
  comentarioRrhh?: string;
};
