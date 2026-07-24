/**
 * The pedestal a tier icon used to float above has been removed — loyalty
 * icons now levitate on their own with no podium underneath (see
 * components/loyalty-icons.tsx and components/TierIcon3D.tsx). Kept as a
 * no-op component rather than deleted, in case a podium comes back later;
 * nothing currently imports or renders this.
 */
export default function Podium() {
  return null;
}
