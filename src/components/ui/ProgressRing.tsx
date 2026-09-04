interface ProgressRingProps {
  prozent: number // 0..100
  groesse?: number
}

export function ProgressRing({ prozent, groesse = 48 }: ProgressRingProps) {
  const radius = groesse / 2 - 4
  const umfang = 2 * Math.PI * radius
  const offset = umfang * (1 - Math.min(100, Math.max(0, prozent)) / 100)

  return (
    <svg width={groesse} height={groesse} className="-rotate-90">
      <circle
        cx={groesse / 2}
        cy={groesse / 2}
        r={radius}
        fill="none"
        stroke="#1F2733"
        strokeWidth={4}
      />
      <circle
        cx={groesse / 2}
        cy={groesse / 2}
        r={radius}
        fill="none"
        stroke={prozent >= 100 ? '#22C55E' : '#F59E0B'}
        strokeWidth={4}
        strokeDasharray={umfang}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}
