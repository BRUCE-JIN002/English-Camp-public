import type { TrackerConfig } from "@en/common/tracker";
import { getFingerprint } from "@/uv";
import { reportEvent } from "@/event";
import { reportError } from "@/error";
import { reportPv, reportView } from "@/pv";
import { reportPerformance } from "@/performance";

export class Tracker {
  private config: TrackerConfig;
  private visitorId: string | null = null;
  private revision = 0;
  private registration: AbortController | null = null;

  constructor(config: TrackerConfig) {
    this.config = { ...config };
    const visitor = () => this.visitorId;
    // Install listeners only once, and resolve identity at report time.
    reportEvent(visitor, this.config);
    void reportError(visitor, this.config);
    reportPv(visitor, this.config);
    void reportPerformance(visitor, this.config);
    void this.refreshVisitor().catch(() => {});
  }

  private async refreshVisitor() {
    const revision = ++this.revision;
    this.visitorId = null;
    this.registration?.abort();
    this.registration = null;
    if (!this.config.userId) return;
    this.registration = new AbortController();
    const id = await getFingerprint({ ...this.config }, this.registration.signal);
    if (revision !== this.revision) return;
    this.visitorId = id;
    reportView(() => this.visitorId, this.config);
  }

  public async setUserId(userId?: string) {
    if (this.config.userId === userId) return;
    this.config.userId = userId;
    await this.refreshVisitor();
  }
}
