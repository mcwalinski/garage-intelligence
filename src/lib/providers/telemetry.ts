import { TelemetrySnapshot } from "@/lib/types";

export interface TelemetryProvider {
  name: string;
  fetchLatest(vehicleId: string): Promise<TelemetrySnapshot | null>;
}

export class MockTelemetryProvider implements TelemetryProvider {
  name = "mock-smartcar";

  async fetchLatest(_vehicleId: string): Promise<TelemetrySnapshot | null> {
    return null;
  }
}
