import { Plane } from "lucide-react";
import { cn } from "@/lib/cn";

interface FlightPathProps {
  /** Small dots on the line, one per stop. */
  stops?: readonly string[];
  className?: string;
}

/** A line with a plane flying along it towards an arrowhead: "from here to there". */
export function FlightPath({ stops = [], className }: FlightPathProps) {
  return (
    <span aria-hidden className={cn("flight-path relative flex h-5 w-full items-center", className)}>
      <span className="h-0.5 flex-1 rounded-full bg-line" />
      {stops.map((code) => (
        <span key={code} title={`Stop in ${code}`} className="relative z-10 mx-1 size-2 rounded-full border-2 border-white bg-warning" />
      ))}
      {stops.length > 0 && <span className="h-0.5 flex-1 rounded-full bg-line" />}
      <span className="size-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-accent" />
      <span className="flight-path-plane absolute inset-y-0 left-0 flex items-center text-accent">
        <Plane size={15} fill="currentColor" strokeWidth={1.5} />
      </span>
    </span>
  );
}
