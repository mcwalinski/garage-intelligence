import { ValuationPoint } from "@/lib/types";

export interface ValuationProvider {
  name: string;
  fetchHistory(vehicleId: string): Promise<ValuationPoint[]>;
}

export class MockValuationProvider implements ValuationProvider {
  name = "mock-marketcheck";

  async fetchHistory(_vehicleId: string): Promise<ValuationPoint[]> {
    return [];
  }
}
