/**
 * King Koil is a real vendor catalog, imported via
 * scripts/import-partner.mjs from _king-koil-feed-fresh.csv on
 * 2026-08-02. 29 products across
 * 1 categories.
 *
 * Follows the same lightweight per-partner model as every other partner
 * data file (see lib/brooklyn-delhi-data.ts): one real vendor, one real
 * price (with a real originalPrice only when the source feed's own price
 * fields showed an actual markdown — never fabricated), and one real
 * outbound affiliate/purchase link per product.
 *
 * Images: resized to fit within 1600x1600 and converted to WebP by the
 * import script, saved to public/images/king-koil/.
 */

export type KingKoilProductCategory =
  | "Mattresses";

export type KingKoilProduct = {
  slug: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  deepLink: string;
  image: string;
  images: string[];
  category: KingKoilProductCategory;
};

export const KING_KOIL_CATEGORIES: KingKoilProductCategory[] = [
  "Mattresses",
];

export const KING_KOIL_PRODUCTS: KingKoilProduct[
] = [
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Twin, 13\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 99.95,
    deepLink: "https://www.awin1.com/pclick.php?p=43487196554&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-2",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Twin, 16\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 109.95,
    deepLink: "https://www.awin1.com/pclick.php?p=43487196555&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-2.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-2.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-3",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Twin, 20\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 119.95,
    deepLink: "https://www.awin1.com/pclick.php?p=43317328560&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-3.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-3.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-4",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Queen, 13\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 129.95,
    deepLink: "https://www.awin1.com/pclick.php?p=43317328561&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-4.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-4.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-6",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Queen, 20\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 139.95,
    deepLink: "https://www.awin1.com/pclick.php?p=42912979431&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-6.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-6.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-7",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — California King, 20\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 179.95,
    deepLink: "https://www.awin1.com/pclick.php?p=42890768720&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-7.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-7.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-8",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — California King, 16\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 169.95,
    deepLink: "https://www.awin1.com/pclick.php?p=43487196557&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-8.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-8.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-9",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Full, 20\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 139.95,
    deepLink: "https://www.awin1.com/pclick.php?p=43317328563&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-9.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-9.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-10",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Full, 16\", Beige",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 129.95,
    deepLink: "https://www.awin1.com/pclick.php?p=41333549307&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-10.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-10.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-11",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Twin, 20\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 119.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217627&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-11.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-11.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-12",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Twin, 20\", Blue",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 119.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217628&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-12.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-12.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-13",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Twin, 16\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 119.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217629&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-13.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-13.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-15",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Full, 20\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 139.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217632&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-15.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-15.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-16",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Full, 20\", Blue",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 139.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217633&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-16.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-16.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-17",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Full, 16\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 129.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217634&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-17.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-17.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-18",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Full, 16\", Blue",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 129.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217635&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-18.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-18.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-19",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Full, 13\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 119.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217636&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-19.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-19.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-20",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Queen, 20\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 149.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217637&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-20.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-20.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-21",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Queen, 20\", Blue",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 149.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217638&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-21.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-21.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-23",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Queen, 13\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 129.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217641&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-23.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-23.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-24",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — California King, 20\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 179.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217642&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-24.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-24.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-25",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — California King, 20\", Blue",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 179.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217643&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-25.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-25.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-26",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — California King, 16\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 169.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217644&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-26.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-26.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-27",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — California King, 16\", Blue",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 169.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217645&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-27.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-27.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-28",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Kids, 13\", Black",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 79.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217646&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-28.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-28.webp"],
    category: "Mattresses",
  },
  {
    slug: "king-koil-luxury-air-mattress-with-high-speed-built-in-pump-29",
    name: "King Koil Luxury Air Mattress with High Speed Built-in Pump — Kids, 13\", Blue",
    description: "Coil Beam - King Koil Airbeds were designed with you in mind. Enhanced Coil Technology provides the support you and your guests need for a sound night's sleep. Air filled coils and internal layering naturally support the body, keeping the spine aligned as you sleep. The state-of-the-art coils also maintain the inflatable bed's shape and firmness over time.. Layers - Utilizing high-quality, puncture resistant material prevents normal wear and tear that can sink an average air mattress. The durable PVC combined with soft flocked top create a waterproof, extremely durable airbed, meant to withstand the test of time.. Built-In Pump - With our proprietary built-in high-speed pump, you can easily maintain and adjust the blow up beds firmness level. Featuring separate inflation and deflation valves, the built-in high speed pump will do the work for you, and get you resting faster. Fully inflate or deflate the queen size air mattress in just 90 seconds. That's twice as fast as the average competing bed! Pump specs: 120V/210W",
    price: 79.95,
    deepLink: "https://www.awin1.com/pclick.php?p=45409217647&a=3002879&m=115216",
    image: "/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-29.webp",
    images: ["/images/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump-29.webp"],
    category: "Mattresses",
  },
];
