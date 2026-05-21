import cron from "node-cron";
import { FlotaUsuarioSyncService } from "../services/FlotaUsuarioSyncService";

const CRON_EXPRESSION = "0 2 * * *";

export function startFlotaUsuarioSyncCron(): void {
  if (process.env.FLOTA_SYNC_CRON_ENABLED === "false") {
    console.log("[FlotaSync] Cron deshabilitado (FLOTA_SYNC_CRON_ENABLED=false)");
    return;
  }

  cron.schedule(CRON_EXPRESSION, () => {
    console.log("[FlotaSync] Iniciando sincronización programada (02:00 hora local del servidor)");
    void FlotaUsuarioSyncService.syncAllInBatches();
  });

  console.log("[FlotaSync] Cron registrado: 02:00 diario (hora local del servidor)");
}
