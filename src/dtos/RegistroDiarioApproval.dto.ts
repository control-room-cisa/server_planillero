// src/dtos/RegistroDiarioApprovalDtos.ts
export type SupervisorApprovalDto = {
  aprobacionSupervisor: boolean;
  codigoSupervisor?: string;
  comentarioSupervisor?: string;
};

export type RrhhApprovalDto = {
  aprobacionRrhh: boolean;
  codigoRrhh?: string;
  comentarioRrhh?: string;
};
