import type { Metadata } from "next";
import { FlightSearchFlow } from "@/features/flights/components/flight-search-flow";

export const metadata: Metadata = { title: "Search flights" };

export default function FlightSearchPage() {
  return <FlightSearchFlow />;
}
