import Image from "next/image";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display text-xl font-medium tracking-tight text-ivory-50 ${className}`}
    >
      <Image
        src="/images/logo/logo-icon.png"
        alt=""
        aria-hidden
        width={256}
        height={256}
        className="h-8 w-8 shrink-0 drop-shadow-[0_2px_6px_rgba(184,147,95,0.35)]"
      />
      Price Finder
    </span>
  );
}
