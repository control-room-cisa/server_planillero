import cron from "node-cron";
import { FlotaUsuarioSyncService } from "../services/FlotaUsuarioSyncService";

const CRON_EXPRESSION = "0 2 * * *";
const DEFAULT_TZ = "America/Tegucigalpa";

export function startFlotaUsuarioSyncCron(): void {
  if (process.env.FLOTA_SYNC_CRON_ENABLED === "false") {
    console.log("[FlotaSync] Cron deshabilitado (FLOTA_SYNC_CRON_ENABLED=false)");
    return;
  }

  const timezone = process.env.FLOTA_SYNC_CRON_TZ?.trim() || DEFAULT_TZ;

  cron.schedule(
    CRON_EXPRESSION,
    () => {
      console.log(`[FlotaSync] Iniciando sincronización programada (${timezone})`);
      void FlotaUsuarioSyncService.syncAllInBatches();
    },
    { timezone }
  );

  console.log(`[FlotaSync] Cron registrado: 02:00 diario (${timezone})`);
}
