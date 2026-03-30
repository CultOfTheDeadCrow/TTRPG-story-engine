import { app } from 'electron'
import { join } from 'path'

export function getDatabasePath(): string {
  if (!app.isPackaged) {
    // D-07: Dev mode uses ./dev-data/campaign.db relative to project root
    // Easy to inspect, delete (rm -rf dev-data/), and reset
    return join(process.cwd(), 'dev-data', 'campaign.db')
  }
  // D-08: Production uses userData path
  return join(app.getPath('userData'), 'campaign.db')
}
