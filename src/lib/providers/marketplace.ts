import { PartListing } from "@/lib/types";

export interface MarketplaceProvider {
  name: string;
  search(query: string): Promise<PartListing[]>;
}

export class MockMarketplaceProvider implements MarketplaceProvider {
  name = "mock-amazon";

  async search(_query: string): Promise<PartListing[]> {
    return [];
  }
}
