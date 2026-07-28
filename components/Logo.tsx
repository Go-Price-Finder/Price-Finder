import LogoMark from "./LogoMark";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display text-xl font-medium tracking-tight text-ivory-50 ${className}`}
    >
      <LogoMark size={32} className="shrink-0" />
      Price Finder
    </span>
  );
}
