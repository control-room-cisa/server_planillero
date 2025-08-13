// src/domain/index.ts

// Main domain service
export { HorarioTrabajoDomain } from "./horario-trabajo-domain";

// Types and interfaces
export * from "./types";
export * from "./interfaces";

// Schedule policies
export { PoliticaH1 } from "./politicas-horario/H1";
export { PoliticaH2 } from "./politicas-horario/H2";
export { PoliticaHorarioBase } from "./politicas-horario/base";
export { FabricaPoliticas } from "./politicas-horario/fabrica-politicas";

// Time segmentation
export { SegmentadorTiempo } from "./segmentador-tiempo";
