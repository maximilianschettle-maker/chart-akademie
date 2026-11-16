import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Einstellungen des Git-Syncs und des Geräte-Syncs — bewusst getrennt vom Nutzerstand, damit das Token nie in Export oder Repo landet. */
export interface SyncEinstellungen {
  /** Geräte-Sync über den Worker (Journal + Lernfortschritt je Einladungscode), Standard an */
  cloud: boolean
  /** owner/name des GitHub-Repositories */
  repo: string
  /** Ordner im Repo, leer = Wurzel */
  ordner: string
  token: string
  journal: boolean
  fortschritt: boolean
  letzterSync: { art: 'geholt' | 'gepusht'; am: number } | null
}

interface SyncState extends SyncEinstellungen {
  setzen: (neu: Partial<SyncEinstellungen>) => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      cloud: true,
      repo: '',
      ordner: 'chartakademie',
      token: '',
      journal: true,
      fortschritt: true,
      letzterSync: null,
      setzen: (neu) => set(neu),
    }),
    { name: 'chartakademie-sync' },
  ),
)
