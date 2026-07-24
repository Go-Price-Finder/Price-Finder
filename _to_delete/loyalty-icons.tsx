/**
 * The four loyalty tier icons — flat "face" artwork only. Rotation,
 * levitation, and the podium beneath each one live in TierIcon3D.tsx,
 * which wraps these in a 3D-transformed, tumbling shell. Every icon is
 * drawn on a centered, symmetrical composition since that shell rotates
 * on multiple axes — an off-center design would wobble visibly.
 */

type IconProps = { className?: string };

export function BronzeCoinIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bronze-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e3a876" />
          <stop offset="55%" stopColor="#b06f3f" />
          <stop offset="100%" stopColor="#8a5230" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#bronze-face)" stroke="#6f3f22" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#f0c39a" strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="2.5 3.5" />
      <path
        d="M32 18l3.6 8.2 8.9.9-6.7 6 1.9 8.8L32 37.6l-7.7 4.3 1.9-8.8-6.7-6 8.9-.9L32 18z"
        fill="#f4d9bb"
        stroke="#7a4826"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SilverBadgeIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="silver-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2f4f6" />
          <stop offset="50%" stopColor="#c3cad1" />
          <stop offset="100%" stopColor="#8f98a3" />
        </linearGradient>
      </defs>
      <path
        d="M32 4l17 6v14c0 13-7.4 21.7-17 26-9.6-4.3-17-13-17-26V10l17-6z"
        fill="url(#silver-face)"
        stroke="#6b7480"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 10l11.5 4v10.4c0 9.3-5 15.6-11.5 18.7-6.5-3.1-11.5-9.4-11.5-18.7V14l11.5-4z"
        fill="none"
        stroke="#eef1f4"
        strokeOpacity="0.8"
        strokeWidth="1.2"
      />
      <path
        d="M32 16.5l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3-5.6-3.1-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6 2.6-5.9z"
        fill="#fbfcfd"
        stroke="#7a828c"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GoldCrownIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gold-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde4a6" />
          <stop offset="50%" stopColor="#eab635" />
          <stop offset="100%" stopColor="#b9821c" />
        </linearGradient>
      </defs>
      <path
        d="M10 27l7.5 6.5L23 20l9 12 9-12 5.5 13.5L54 27l-4 20H14l-4-20z"
        fill="url(#gold-face)"
        stroke="#8f5e14"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="12" y="47" width="40" height="6" rx="1.5" fill="url(#gold-face)" stroke="#8f5e14" strokeWidth="1.5" />
      <circle cx="32" cy="30" r="3.2" fill="#fff3d6" stroke="#8f5e14" strokeWidth="1" />
      <circle cx="19" cy="33" r="2.2" fill="#fff3d6" stroke="#8f5e14" strokeWidth="0.8" />
      <circle cx="45" cy="33" r="2.2" fill="#fff3d6" stroke="#8f5e14" strokeWidth="0.8" />
    </svg>
  );
}

export function DiamondStatueIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="diamond-gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eaf7ff" />
          <stop offset="55%" stopColor="#b9e4f5" />
          <stop offset="100%" stopColor="#7fc3e0" />
        </linearGradient>
        <linearGradient id="diamond-gown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9edf2" />
          <stop offset="100%" stopColor="#c3cdd9" />
        </linearGradient>
      </defs>

      {/* pedestal */}
      <rect x="20" y="55" width="24" height="5" rx="1.5" fill="#aeb7c2" stroke="#7d8592" strokeWidth="1" />

      {/* raised arm, holding the gem up */}
      <path
        d="M38 28c3.5-1 6-4 6.5-8"
        fill="none"
        stroke="#c3cdd9"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M44.5 20l3.2-3.2 3.2 3.2-3.2 3.2z"
        fill="url(#diamond-gem)"
        stroke="#5c9cbd"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* head */}
      <circle cx="32" cy="16" r="5.5" fill="#f1e6da" stroke="#a8927c" strokeWidth="1" />

      {/* flowing elegant gown, tapering to the pedestal */}
      <path
        d="M32 21.5c-4 0-7 2-8.5 5.5C21 32 19 42 18 55h28c-1-13-3-23-5.5-28-1.5-3.5-4.5-5.5-8.5-5.5z"
        fill="url(#diamond-gown)"
        stroke="#8891a0"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M32 21.5v33.5M25 30c-1.6 8-2.6 16.7-3 25M39 30c1.6 8 2.6 16.7 3 25"
        fill="none"
        stroke="#9aa4b1"
        strokeOpacity="0.6"
        strokeWidth="1"
      />

      {/* other arm, resting at her side, pointing toward the viewer */}
      <path
        d="M25 29c-2.5 1.8-4 4.6-4.3 8"
        fill="none"
        stroke="#c3cdd9"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="38" r="1.6" fill="#f1e6da" stroke="#a8927c" strokeWidth="0.8" />
    </svg>
  );
}
