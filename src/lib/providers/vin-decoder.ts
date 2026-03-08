import { Vehicle } from "@/lib/types";

export interface VinDecoderProvider {
  name: string;
  decode(vin: string): Promise<Partial<Vehicle>>;
}

export class MockVinDecoderProvider implements VinDecoderProvider {
  name = "mock-nhtsa-vpic";

  async decode(vin: string): Promise<Partial<Vehicle>> {
    return {
      vin,
      make: "Decoded Make",
      model: "Decoded Model",
      trim: "Decoded Trim",
      year: 2024
    };
  }
}
