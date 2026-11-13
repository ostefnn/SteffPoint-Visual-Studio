/**
 * Gentle reminders to keep a copy of a project. Projects live only in this browser: a JSON file
 * (or a ZIP that includes project.json) is the backup. After a few exports without one, the
 * editor suggests it once, at a moment the project clearly has value.
 * Counters are per browser, in localStorage; when storage is blocked, no reminder is shown.
 */
const KEY = 'svs-exports-since-backup';
/** Exports without a backup before the reminder. */
export const BACKUP_REMINDER_AFTER = 3;

function read(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function write(v: Record<string, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // Not remembered: no reminder.
  }
}

/** The project was saved as JSON (alone or inside a ZIP). */
export function noteBackup(projectId: string): void {
  const v = read();
  delete v[projectId];
  write(v);
}

/** An export without a backup. Returns true when it is time to suggest one (then starts counting again). */
export function noteExportWithoutBackup(projectId: string): boolean {
  const v = read();
  const n = (v[projectId] ?? 0) + 1;
  v[projectId] = n >= BACKUP_REMINDER_AFTER ? 0 : n;
  write(v);
  return n >= BACKUP_REMINDER_AFTER;
}
