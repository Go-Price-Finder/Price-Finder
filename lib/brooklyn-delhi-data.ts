/**
 * Brooklyn Delhi is a real vendor catalog, imported from the "Brooklyn
 * Delhi" Google Sheet in Kawsar's Drive and matched against the product
 * photos in public/images/brooklyn-delhi/ (originally
 * public/images/brooklyn delhi/ on disk, with a space — renamed to
 * hyphenated per-product-slug filenames on import so every image has a
 * clean, predictable URL).
 *
 * This is deliberately a separate model from lib/data.ts's `Product` type.
 * That type assumes the site's core "compare the same item across five
 * mock retailers" shape (a `retailers` array, fabricated price history,
 * placeholder ratings) — none of which applies here. Brooklyn Delhi is one
 * real vendor with one real price and one real outbound affiliate link per
 * product, so it gets its own lightweight type instead of being forced
 * into a shape built for a different kind of data.
 *
 * Note on completeness: the import task that produced this file described
 * "40 rows." The actual sheet has 29 rows, and the image folder has
 * exactly 29 matching product-photo groups — the two independently agree,
 * so 29 is treated as the real, complete count rather than an error to
 * paper over.
 *
 * Note on the deep links: every product uses an Awin affiliate-tracking
 * URL (awinmid=125500, awinaffid=3002879) that redirects to the matching
 * brooklyndelhi.com product page — except "Brooklyn Delhi Magnet Trio",
 * whose row in the sheet only had a bare brooklyndelhi.com link with no
 * Awin wrapper. That's carried through as-is (it still resolves and works
 * as a purchase link), but it won't earn affiliate commission the way the
 * other 28 do — worth flagging back to whoever maintains the sheet.
 */

export type BrooklynDelhiRating = {
  stars: number;
  count: number;
};

export type BrooklynDelhiProduct = {
  slug: string;
  name: string;
  description: string;
  /** Current price in USD. */
  price: number;
  /** Present only for the one item currently on sale (Celebrations Gift
   * Box: $63, was $95). */
  originalPrice?: number;
  /** Outbound purchase link — see the file-level note above on the one
   * product missing its Awin wrapper. */
  deepLink: string;
  /** Path under /public — e.g. "/images/brooklyn-delhi/tikka-masala.webp". */
  image: string;
  category: "Food" | "Cook Book" | "Clothing" | "Bag" | "Accessories";
  badge?: string;
  rating?: BrooklynDelhiRating;
};

export const BROOKLYN_DELHI_PRODUCTS: BrooklynDelhiProduct[] = [
  {
    slug: "tomato-achaar-1-5-oz-packet-1",
    name: "Tomato Achaar 1.5 Oz Packet",
    description:
      "Now you can enjoy Tomato Achaar in 1.5 oz packets perfect for travel or to keep in your bag for when meals need a little more flavor;) Tomato Achaar is a staple Indian condiment made with tomatoes, tamarind, a mix of Indian spices, red chili powder, unrefined cane sugar and sesame oil. It has a savory, spicy and tangy flavor that is addictive and delicious however you consume it.",
    price: 2,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Ftomato-achaar-1-5-oz-packet-1",
    image: "/images/brooklyn-delhi/tomato-achaar-1-5-oz-packet-1.webp",
    category: "Food",
    badge: "New",
  },
  {
    slug: "date-tamarind-chutney-1-5-oz-packet",
    name: "Date Tamarind Chutney 1.5 Oz Packet",
    description:
      "Now you can enjoy our date tamarind chutney in 1.5 oz packets perfect for travel or to keep in your bag for when meals need a little more flavor;) This chutney combines sweet dates and tamarind for a divinely sweet and tangy condiment perfect for samosas and curry but also versatile enough to be right at home in a grilled cheese or charcuterie board.",
    price: 2,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fdate-tamarind-chutney-1-5-oz-packet",
    image: "/images/brooklyn-delhi/date-tamarind-chutney-1-5-oz-packet.webp",
    category: "Food",
    badge: "New",
  },
  {
    slug: "tomato-achaar",
    name: "Tomato Achaar",
    description:
      "Tomato Achaar is a staple Indian condiment made with tomatoes, tamarind, a mix of Indian spices, red chili powder, unrefined cane sugar and sesame oil. It has a savory, spicy and tangy flavor that is addictive and delicious however you consume it.",
    price: 12,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Ftomato-achaar",
    image: "/images/brooklyn-delhi/tomato-achaar.webp",
    category: "Food",
    badge: "Best Seller",
    rating: { stars: 5, count: 40 },
  },
  {
    slug: "date-tamarind-chutney",
    name: "Date Tamarind Chutney",
    description:
      "Our date tamarind chutney mixes sweet dates and tamarind for a divinely sweet and tangy condiment perfect for samosas and curry but also versatile enough to be right at home in a grilled cheese or charcuterie board.",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fdate-tamarind-chutney",
    image: "/images/brooklyn-delhi/date-tamarind-chutney.webp",
    category: "Food",
    badge: "New",
  },
  {
    slug: "mango-curry",
    name: "Mango Curry",
    description:
      "This Mango Curry will take you on a tropical South Indian adventure as you savor sweet ripe mangoes mingling with luscious coconut cream, aromatic spices and a touch of chili.",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fmango-curry",
    image: "/images/brooklyn-delhi/mango-curry.webp",
    category: "Food",
    badge: "New",
    rating: { stars: 5, count: 4 },
  },
  {
    slug: "chickpea-tikka-masala",
    name: "Chickpea Tikka Masala",
    description:
      "A fresh take on the popular curry house classic Chicken Tikka Masala but made vegan with chickpeas and a delicious tomato sauce flavored with onions, ginger, garlic, 12 hand-blended spices and coconut cream.",
    price: 7,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fchickpea-tikka-masala",
    image: "/images/brooklyn-delhi/chickpea-tikka-masala.webp",
    category: "Food",
    badge: "New",
    rating: { stars: 5, count: 1 },
  },
  {
    slug: "sweet-potato-coconut-dal",
    name: "Sweet Potato Coconut Dal",
    description:
      "Dal is Indian comfort food at its best. Ours is made with red lentils and tender sweet potato simmered with coconut cream, turmeric, cumin and lemon.",
    price: 7,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fsweet-potato-coconut-dal",
    image: "/images/brooklyn-delhi/sweet-potato-coconut-dal.webp",
    category: "Food",
    badge: "New",
    rating: { stars: 5, count: 2 },
  },
  {
    slug: "red-bean-rajma-masala",
    name: "Red Bean Rajma Masala",
    description:
      "Quintessential North Indian comfort food inspired by my father's recipe: tender kidney beans slow cooked with tomato, onion, ginger, garlic and warming spices. Traditionally served with rice to make \"rajma chawal\" and topped with sliced onions, cilantro and green chilies or achaar. Also delicious in tacos and on nachos!",
    price: 7,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fred-bean-rajma-masala",
    image: "/images/brooklyn-delhi/red-bean-rajma-masala.webp",
    category: "Food",
    badge: "New",
    rating: { stars: 4.5, count: 3 },
  },
  {
    slug: "black-bean-butter-masala",
    name: "Black Bean Butter Masala",
    description:
      "Black beans cooked until tender in a plant-based butter chicken sauce made creamy with coconut cream and cashew butter instead of butter and cream.",
    price: 7,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fblack-bean-butter-masala",
    image: "/images/brooklyn-delhi/black-bean-butter-masala.webp",
    category: "Food",
    badge: "New",
    rating: { stars: 5, count: 1 },
  },
  {
    slug: "roasted-garlic-achaar",
    name: "Roasted Garlic Achaar",
    description:
      "Often imitated, never duplicated. Our Roasted Garlic Achaar is an award winner, and with good reason. An Indian-spiced chili sauce made with roasted garlic; it has a spicy, sweet, bright, & savory flavor that will leave you wanting more.",
    price: 12,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Froasted-garlic-achaar",
    image: "/images/brooklyn-delhi/roasted-garlic-achaar.webp",
    category: "Food",
    badge: "New",
    rating: { stars: 4.9, count: 31 },
  },
  {
    slug: "sweet-mango-chutney",
    name: "Sweet Mango Chutney",
    description:
      "Our Sweet Mango Chutney features ripe mangoes and golden raisins, fresh ginger for heat, a little garam masala for warmth, and a touch of lemon juice for a bit of brightness. By using ripe mangoes, we're able to use 60% less sugar than leading brands.",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fsweet-mango-chutney",
    image: "/images/brooklyn-delhi/sweet-mango-chutney.webp",
    category: "Food",
    rating: { stars: 5, count: 7 },
  },
  {
    slug: "spicy-mango-chutney",
    name: "Spicy Mango Chutney",
    description:
      "A one-of-a-kind Spicy Mango Chutney featuring ripe mangoes, fresh ginger and heirloom Kashmiri chili peppers grown on a family farm in Pampore, Kashmir and sourced by our friends at Burlap & Barrel. 60% less sugar than leading brands!",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fspicy-mango-chutney",
    image: "/images/brooklyn-delhi/spicy-mango-chutney.webp",
    category: "Food",
    rating: { stars: 5, count: 7 },
  },
  {
    slug: "tikka-masala",
    name: "Tikka Masala",
    description:
      "Our Tikka Masala is the first vegan version on the market. Layered with luscious coconut cream instead of butter and cream, we've taken a widely loved recipe, and made it accessible to all! Tangy tomatoes, caramelized onions, fresh garlic and ginger, and an aromatic blend of warming Indian spices bring it all home.",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Ftikka-masala",
    image: "/images/brooklyn-delhi/tikka-masala.webp",
    category: "Food",
    rating: { stars: 5, count: 63 },
  },
  {
    slug: "cashew-butter-masala",
    name: "Cashew Butter Masala",
    description:
      "Butter Chicken Sauce, a traditionally rich and mildly-spiced sauce, has been reimagined for a fully plant-based version of the recipe using organic coconut cream and cashew butter in place of the dairy so everyone can enjoy it.",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fcashew-butter-masala",
    image: "/images/brooklyn-delhi/cashew-butter-masala.webp",
    category: "Food",
    rating: { stars: 4.9, count: 13 },
  },
  {
    slug: "golden-coconut-curry",
    name: "Golden Coconut Curry",
    description:
      "One part Indian and one part Thai; this is the curry dreams are made of. A wonderfully versatile sauce that is luscious, lemony, savory, and a little sweet and spicy all at once.",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fgolden-coconut-curry",
    image: "/images/brooklyn-delhi/golden-coconut-curry.webp",
    category: "Food",
    rating: { stars: 5, count: 20 },
  },
  {
    slug: "coconut-cashew-korma",
    name: "Coconut Cashew Korma",
    description:
      "Chitra put her own spin on this curry house comfort staple by replacing the dairy in the original recipe with organic coconut cream, pure cashew butter, and a bit of shredded coconut. The result is a delicate, yet luxurious, sauce with a hint of cardamom and black pepper.",
    price: 11,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fcoconut-cashew-korma",
    image: "/images/brooklyn-delhi/coconut-cashew-korma.webp",
    category: "Food",
    rating: { stars: 5, count: 10 },
  },
  {
    slug: "chutney-trio-gift-set",
    name: "Chutney Trio Gift Set",
    description:
      "This gift set is for those that appreciate a good chutney. We collaborated with Delhi-based artist Anjali Mehta on the design for our first ever gift box inspired by Indian truck art. The sturdy and beautiful box includes our spiciest condiments, a must-have Indian condiment trifecta for chutney lovers: Date Tamarind Chutney 9 oz, Sweet Mango Chutney 9 oz, and Spicy Mango Chutney 9 oz. Gift set also includes a designed postcard about Anjali and her inspiration behind the box.",
    price: 40,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fchutney-trio-gift-set",
    image: "/images/brooklyn-delhi/chutney-trio-gift-set.webp",
    category: "Food",
    badge: "New",
  },
  {
    slug: "best-of-brooklyn-delhi-gift-box",
    name: "Best of Brooklyn Delhi Gift Box",
    description:
      "A festive box featuring Brooklyn Delhi's greatest hits and illustrations by Delhi-based artist Anjali Mehta. A gorgeous gift for any occasion, including: Tomato Achaar 9 oz, Roasted Garlic Achaar 9 oz, Sweet Mango Chutney 9 oz, Tikka Masala, Golden Coconut Curry, Coconut Cashew Korma, and Cashew Butter Masala. Gift set also includes an insert that can be used as a decoration and a designed postcard about Anjali and her inspiration behind the box.",
    price: 95,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fbest-of-brooklyn-delhi-gift-box",
    image: "/images/brooklyn-delhi/best-of-brooklyn-delhi-gift-box.jpg",
    category: "Food",
    badge: "Best Seller",
    rating: { stars: 5, count: 3 },
  },
  {
    slug: "celebrations-gift-box",
    name: "Celebrations Gift Box",
    description:
      "The perfect gift for a friend with a kid: rainbow stainless steel compartment plates (thalis) perfect for kids' meals, paired with our best-selling condiments — Tomato Achaar 9 oz, Roasted Garlic Achaar 9 oz, and Sweet Mango Chutney 9 oz. Gift set also includes an insert that can be used as a decoration and a designed postcard about Anjali and her inspiration behind the box.",
    price: 63,
    originalPrice: 95,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fcelebrations-gift-box",
    image: "/images/brooklyn-delhi/celebrations-gift-box.jpg",
    category: "Food",
    badge: "Limited Stock",
    rating: { stars: 5, count: 1 },
  },
  {
    slug: "cookbook-gift-set",
    name: "Cookbook Gift Set",
    description:
      "Brooklyn Delhi founder Chitra Agrawal's cookbook, Vibrant India (published by Penguin Random House), paired with the Spicy & Sweet Trio Gift Box designed by Delhi-based artist Anjali Mehta, featuring the three best-selling condiments: Tomato Achaar 9 oz, Roasted Garlic Achaar 9 oz, and Sweet Mango Chutney 9 oz. Gift set also includes a designed postcard about Anjali and her inspiration behind the box.",
    price: 70,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fcookbook-gift-set",
    image: "/images/brooklyn-delhi/cookbook-gift-set.webp",
    category: "Cook Book",
    badge: "Online Only",
  },
  {
    slug: "spicy-sweet-trio-gift-set",
    name: "Sweet & Spicy Trio Gift Set",
    description:
      "A gift box inspired by Indian truck art, designed with Delhi-based artist Anjali Mehta. Includes our best-selling condiments: Tomato Achaar 9 oz, Roasted Garlic Achaar 9 oz, and Sweet Mango Chutney 9 oz. Gift set also includes a designed postcard about Anjali and her inspiration behind the box.",
    price: 40,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fspicy-sweet-trio-gift-set",
    image: "/images/brooklyn-delhi/spicy-sweet-trio-gift-set.webp",
    category: "Food",
    badge: "Best Seller",
    rating: { stars: 5, count: 3 },
  },
  {
    slug: "spicy-trio-gift-box",
    name: "Hot & Spicy Trio Gift Set",
    description:
      "For those that like it spicy. A gift box inspired by Indian truck art, designed with Delhi-based artist Anjali Mehta, including our spiciest condiments: Tomato Achaar 9 oz, Roasted Garlic Achaar 9 oz, and Spicy Mango Chutney 9 oz. Gift set also includes a designed postcard about Anjali and her inspiration behind the box.",
    price: 40,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fspicy-trio-gift-box",
    image: "/images/brooklyn-delhi/spicy-trio-gift-box.webp",
    category: "Food",
    badge: "Online Only",
    rating: { stars: 5, count: 1 },
  },
  {
    slug: "vibrant-india-cookbook",
    name: "Vibrant India Cookbook",
    description:
      "Brooklyn Delhi founder Chitra Agrawal writes about her family's vegetarian recipes from Bangalore, adapted for the home cook: 80+ recipes ranging from easy stir-fries to classics like dosa, each labeled vegan, gluten-free, and by season. Sections include Breakfast & Light Meals, Salads & Yogurts, Stir-Fries and Curries, Rice and Bread, Soups, Stews and Lentils, Festive Bites and Snacks, Sweets and Drinks, and Chutneys and Pickles, plus an introduction to Indian ingredients and techniques. Original Madhubani drawings by Chitra's Auntie Karen Vasudev; photography by Erin Scott. Published by Penguin Random House, 224 pages.",
    price: 30,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fvibrant-india-cookbook",
    image: "/images/brooklyn-delhi/vibrant-india-cookbook.webp",
    category: "Cook Book",
    badge: "Online Only",
  },
  {
    slug: "brooklyn-delhi-market-t-shirt",
    name: "Brooklyn Delhi Market T-Shirt",
    description:
      "Our Market T-Shirt brings together our two worlds — Brooklyn & Delhi — in one bodega. Illustrated by Delhi-based artist Anjali Mehta. Color: White. Sizes: S, M, L, XL (unisex). Fabric: 100% Cotton. Shirt feels and fits best after washing.",
    price: 20,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fbrooklyn-delhi-market-t-shirt",
    image: "/images/brooklyn-delhi/brooklyn-delhi-market-t-shirt.webp",
    category: "Clothing",
    badge: "New",
  },
  {
    slug: "achaar-short-sleeve-unisex-t-shirt",
    name: "Achaar in Hindi T-Shirt",
    description:
      "Show your love for Achaar with our custom designed and screen printed T-shirt (includes Hindi text for Achaar). Color: Black. Sizes: XS-XXXL (unisex). Fabric: 60% Cotton / 40% Polyester. Shirt feels and fits best after washing.",
    price: 20,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fachaar-short-sleeve-unisex-t-shirt",
    image: "/images/brooklyn-delhi/achaar-short-sleeve-unisex-t-shirt.webp",
    category: "Clothing",
    rating: { stars: 5, count: 1 },
  },
  {
    slug: "tomato-achaar-short-sleeve-unisex-t-shirt",
    name: "Tomato Achaar T-shirt",
    description:
      "Show your love for Tomato Achaar with our custom designed and screen printed T-shirt (includes Hindi text for Tomato Achaar). Color: Black. Sizes: S-XL (unisex). Fabric: 60% Cotton / 40% Polyester.",
    price: 20,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Ftomato-achaar-short-sleeve-unisex-t-shirt",
    image: "/images/brooklyn-delhi/tomato-achaar-short-sleeve-unisex-t-shirt.webp",
    category: "Clothing",
  },
  {
    slug: "market-tote-bag",
    name: "Illustrated Market Tote Bag",
    description:
      "Show your love for Brooklyn Delhi with our custom designed and screen printed cotton canvas tote bag, illustrated by Delhi-based artist Anjali Mehta. Lightweight and the perfect size for everyday use. Color: Off White. 14\"W x 15\"H. 100% Heavy Cotton Canvas Woven.",
    price: 20,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Fmarket-tote-bag",
    image: "/images/brooklyn-delhi/market-tote-bag.webp",
    category: "Bag",
  },
  {
    slug: "tomato-achaar-tote-bag",
    name: "Tomato Achaar Tote Bag",
    description:
      "Show your love for Tomato Achaar with our custom designed and screen printed cotton canvas tote bag (includes Hindi text for Tomato Achaar). Lightweight and the perfect size for everyday use. Color: Navy. 14\"W x 16\"H. 100% Heavy Cotton Canvas Woven.",
    price: 20,
    deepLink:
      "https://www.awin1.com/cread.php?awinmid=125500&awinaffid=3002879&ued=https%3A%2F%2Fbrooklyndelhi.com%2Fproducts%2Ftomato-achaar-tote-bag",
    image: "/images/brooklyn-delhi/tomato-achaar-tote-bag.webp",
    category: "Bag",
  },
  {
    slug: "brooklyn-delhi-magnet-trio",
    name: "Brooklyn Delhi Magnet Trio",
    description:
      "Add a touch of Brooklyn Delhi flair to your fridge, filing cabinet, or wherever you like to magnet! Our very first magnet set is perfect for showing off your favorite Achaar flavor in style. 1.5\" diameter. Features 3 magnets.",
    price: 3,
    // No Awin affiliate wrapper on this one in the source sheet — see the
    // file-level note above.
    deepLink: "https://brooklyndelhi.com/products/brooklyn-delhi-magnet-trio",
    image: "/images/brooklyn-delhi/brooklyn-delhi-magnet-trio.webp",
    category: "Accessories",
  },
];

/** Category display order — first-appearance order from the source sheet. */
export const BROOKLYN_DELHI_CATEGORIES: BrooklynDelhiProduct["category"][] = [
  "Food",
  "Cook Book",
  "Clothing",
  "Bag",
  "Accessories",
];

export function formatBrooklynDelhiPrice(dollars: number): string {
  return `$${dollars.toLocaleString()}`;
}
