import { Link } from 'react-router-dom'

/** Einzeiler überall dort, wo ein Feature ohne Einladungscode nicht geht. */
export function ZugangHinweis({ nachsatz, klein }: { nachsatz?: string; klein?: boolean }) {
  return (
    <span className={klein ? 'text-[11px] text-gedimmt' : undefined}>
      Kein Einladungscode –{' '}
      <Link to="/zugang" className="text-akzent underline">
        Zugang einrichten
      </Link>
      {nachsatz}
    </span>
  )
}

export const TEXT_ZUGANG_KURZ = 'Kein Einladungscode (Start → Zugang)'
