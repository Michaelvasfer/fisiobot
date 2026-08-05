'use client'

import { KpiCards } from './kpi-cards'
import { DashboardCharts } from './dashboard-charts'
import { ActivityFeed } from './activity-feed'
import { SlotManager } from './slot-manager'

export function DashboardView() {
  return (
    <div className="space-y-4">
      <KpiCards />
      {/* Quick Slot Manager — always accessible from dashboard */}
      <SlotManager />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <DashboardCharts />
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
