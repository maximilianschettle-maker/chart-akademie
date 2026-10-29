import { Outlet } from 'react-router-dom'
import { SegmentLeiste } from '../components/ui/SegmentLeiste'
import type { NavZiel } from '../navigation'

// Rahmen eines Hauptbereichs: Segment-Leiste oben, darunter die jeweilige Seite.
// Die Seiten behalten ihre eigenen Container (max-w, px), deshalb hier nur ein schmaler Rahmen
// für die Leiste; der Simulator ist breiter als die anderen Seiten und soll das bleiben.

export function BereichLayout({ tabs, label }: { tabs: NavZiel[]; label: string }) {
  return (
    <>
      <div className="px-4">
        <SegmentLeiste tabs={tabs} label={label} />
      </div>
      <Outlet />
    </>
  )
}
