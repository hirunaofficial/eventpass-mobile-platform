import * as FileSystem from "expo-file-system/legacy";
import type { TicketWithEvent } from "@eventpass/shared";

/**
 * A small on-device store of exported ticket images.
 *
 * Saving the ticket to the system photo library is the preferred route,
 * but Expo Go on Android cannot write to the photo library at all, which
 * breaks the one-device demo: the staff scanner cannot photograph a QR
 * code displayed on its own screen, so it needs an image file to read.
 *
 * Keeping our own copy of every exported ticket removes that dependency.
 * The scanner can always offer a saved ticket image whether or not the OS
 * gallery accepted the save, and the check-in path itself is unchanged -
 * it is still "decode a QR out of a PNG", only the file lives somewhere
 * the app is always allowed to write.
 */

const DIR = `${FileSystem.documentDirectory}ticket-images/`;
const MANIFEST = `${DIR}index.json`;

export interface SavedTicketImage {
  ticketId: string;
  title: string;
  venue: string;
  savedAt: string; // ISO 8601
  uri: string;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

async function readManifest(): Promise<SavedTicketImage[]> {
  try {
    const parsed: unknown = JSON.parse(await FileSystem.readAsStringAsync(MANIFEST));
    return Array.isArray(parsed) ? (parsed as SavedTicketImage[]) : [];
  } catch {
    // Missing on first run, and a half-written file should not break
    // check-in. An empty list is the correct answer to both.
    return [];
  }
}

async function writeManifest(entries: SavedTicketImage[]) {
  await ensureDir();
  await FileSystem.writeAsStringAsync(MANIFEST, JSON.stringify(entries));
}

/** Copies a captured ticket PNG into the app's own storage. */
export async function storeTicketImage(
  capturedUri: string,
  ticket: TicketWithEvent
): Promise<SavedTicketImage> {
  await ensureDir();
  const uri = `${DIR}${ticket.id}.png`;

  // captureRef writes into the cache directory, which the OS may reclaim
  // at any time; copy into the document directory so the image is still
  // there when the scanner asks for it.
  await FileSystem.deleteAsync(uri, { idempotent: true });
  await FileSystem.copyAsync({ from: capturedUri, to: uri });

  const entry: SavedTicketImage = {
    ticketId: ticket.id,
    title: ticket.event.title,
    venue: ticket.event.venue.name,
    savedAt: new Date().toISOString(),
    uri,
  };

  // Re-exporting the same ticket replaces its row instead of adding a
  // duplicate to the scanner's picker.
  const rest = (await readManifest()).filter((e) => e.ticketId !== ticket.id);
  await writeManifest([entry, ...rest]);
  return entry;
}

/** Saved ticket images, newest first, excluding any whose file is gone. */
export async function listTicketImages(): Promise<SavedTicketImage[]> {
  const entries = await readManifest();
  const checked = await Promise.all(
    entries.map(async (e) => ((await FileSystem.getInfoAsync(e.uri)).exists ? e : null))
  );
  const live = checked.filter((e): e is SavedTicketImage => e !== null);
  // Prune lazily: clearing app data deletes the files but not necessarily
  // the manifest, and the picker must never offer an unreadable image.
  if (live.length !== entries.length) await writeManifest(live);
  return live;
}
