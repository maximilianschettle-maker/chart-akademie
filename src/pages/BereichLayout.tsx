import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { SegmentLeiste } from '../components/ui/SegmentLeiste'
import type { NavZiel } from '../navigation'

// Rahmen eines Hauptbereichs: Segment-Leiste oben (optional mit Zusatz rechts, z.B. Trader/Investor),
// darunter die jeweilige Seite. Die Seiten behalten ihre eigenen Container (max-w, px), deshalb hier
// nur ein schmaler Rahmen für die Leiste; der Simulator ist breiter als die anderen Seiten und soll das bleiben.

export function BereichLayout({ tabs, label, rechts }: { tabs: NavZiel[]; label: string; rechts?: ReactNode }) {
  return (
    <>
      <div className="px-4">
        <SegmentLeiste tabs={tabs} label={label} rechts={rechts} />
      </div>
      <Outlet />
    </>
  )
}
