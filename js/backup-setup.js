import { gsBackup } from "./helpers/gsBackup.js";
import { gsStorage } from "./helpers/gsStorage.js";

document.getElementById("enableBackup").addEventListener("click", async () => {
  const frequency = document.getElementById("backupFrequency").value;
  await gsStorage.setOptionAndSync(gsStorage.BACKUP_FREQUENCY, frequency);
  await gsBackup.enable(frequency);
  window.close();
});

document.getElementById("dismissNotice").addEventListener("click", () => window.close());
