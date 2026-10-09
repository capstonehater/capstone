import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type SyntheticMaterial = {
  key: string; name: string; sku: string; unitCode: string;
  reorderPoint: number; baseCost: number; expiryDays: number; isActive?: boolean;
};
export type SyntheticVariant = {
  key: string; productName: string; category: string; variantName: string;
  sku: string; basePrice: number; popularity: number; recipe: Record<string, number>;
};
export type SyntheticModifier = {
  key: string; groupKey: string; name: string; priceAdjustment: number;
  recipeAdjustments: Record<string, number>;
};

export const UNITS = [
  { code: 'g', name: 'Gram', dimension: 'MASS' as const, conversionFactor: 1 },
  { code: 'ml', name: 'Milliliter', dimension: 'VOLUME' as const, conversionFactor: 1 },
  { code: 'pcs', name: 'Piece', dimension: 'COUNT' as const, conversionFactor: 1 },
];

// Costs are estimated PHP per inventory unit. Brand/package identities are real;
// historical supplier offers and purchase prices are explicitly synthetic.
const ingredient = (
  key: string, name: string, unitCode: string, reorderPoint: number,
  baseCost: number, expiryDays: number, isActive = true,
): SyntheticMaterial => ({
  key, name, sku: `CS-RM-${key.toUpperCase().replace(/_/g, '-')}`,
  unitCode, reorderPoint, baseCost, expiryDays, isActive,
});
export const MATERIALS: SyntheticMaterial[] = [
  ingredient('coffee', 'TOP Creamery Atok Benguet Arabica Coffee Beans Premium Grade 1kg', 'g', 5000, 1.8, 180),
  ingredient('filtered_water', 'Wilkins Purified Water 6L', 'ml', 30000, .008, 365),
  ingredient('ice', 'Pure Ice Food Grade Ice 5kg', 'g', 15000, .014, 4),
  ingredient('whole_milk', 'Magnolia Fresh Milk 1L', 'ml', 12000, .12, 12),
  ingredient('oat_milk', 'Oatside Barista Blend Oat Milk 1L', 'ml', 4000, .17, 180),
  ingredient('evaporated_milk', 'Alaska Classic Evaporated Filled Milk 370ml', 'ml', 5000, .12, 365),
  ingredient('condensed_milk', 'Alaska Condensed Milk 390g', 'g', 3500, .19, 365),
  ingredient('cream', 'Nestlé All Purpose Cream 250ml', 'ml', 5000, .34, 180),
  ingredient('sugar', "Victorias Refined Sugar 1kg", 'g', 7000, .075, 730),
  ingredient('vanilla', 'MONIN French Vanilla Syrup 700ml', 'ml', 1500, 1.05, 365),
  ingredient('caramel', 'MONIN Caramel Syrup 700ml', 'ml', 1500, 1.05, 365),
  ingredient('hazelnut', 'MONIN Hazelnut Syrup 700ml', 'ml', 1200, 1.1, 365),
  ingredient('peppermint', 'MONIN Peppermint Syrup 700ml', 'ml', 800, 1.1, 365),
  ingredient('passion', 'MONIN Passion Fruit Syrup 700ml', 'ml', 1000, 1.1, 365),
  ingredient('strawberry_syrup', 'MONIN Strawberry Syrup 700ml', 'ml', 1200, 1.1, 365),
  ingredient('mango_syrup', 'MONIN Mango Syrup 700ml', 'ml', 1200, 1.1, 365),
  ingredient('black_tea', 'Lipton Yellow Label Black Tea Bags 100s', 'pcs', 200, 1.55, 730),
  ingredient('thai_tea', 'ChaTraMue Original Thai Tea Mix 400g', 'g', 1600, .52, 365),
  ingredient('chai', 'Twinings Chai Tea Bags 20s', 'pcs', 100, 8.5, 730),
  ingredient('matcha', 'TOP Creamery Milk Tea Series Matcha Powder 500g', 'g', 1500, .59, 365),
  ingredient('chocolate', 'MILO Chocolate Malt Powder 300g', 'g', 2500, .43, 365),
  ingredient('choc_syrup', "Hershey's Chocolate Syrup 623g", 'g', 1500, .56, 365),
  ingredient('white_choc', 'MONIN White Chocolate Sauce 500ml', 'ml', 1000, 1.25, 365),
  ingredient('lemon_juice', 'Real Lemon Lemon Juice 250ml', 'ml', 2500, .48, 180),
  ingredient('butterfly_pea', 'Butterfly Pea Flower Dried 100g', 'g', 300, 1.4, 365),
  ingredient('biscoff', 'Lotus Biscoff Spread 400g', 'g', 1200, .85, 365),
  ingredient('macadamia', 'Kirkland Signature Macadamia Nuts 680g', 'g', 700, 1.8, 365),
  ingredient('taho', 'Soy Taho with Arnibal 1kg', 'g', 1800, .16, 4),
  ingredient('mango', 'Fresh Philippine Mango 1kg', 'g', 3000, .18, 7),
  ingredient('strawberry', 'Fresh Strawberries 500g', 'g', 1800, .45, 5),
  ingredient('banana', 'Fresh Lakatan Banana 1kg', 'g', 1600, .12, 7),
  ingredient('peach', 'Del Monte Peach Halves 825g', 'g', 1300, .21, 365),
  ingredient('oreos', 'Oreo Original Cookies 133g', 'g', 1200, .5, 365),
  ingredient('marshmallow', 'Campfire Mini Marshmallows 300g', 'g', 700, .42, 365),
  ingredient('flour', 'Maya All Purpose Flour 2kg', 'g', 7000, .075, 365),
  ingredient('eggs', 'Bounty Fresh Large Eggs 12s', 'pcs', 120, 11, 28),
  ingredient('butter', 'Magnolia Gold Butter Salted 225g', 'g', 3000, .68, 90),
  ingredient('cheese', 'Eden Original Cheese 180g', 'g', 1800, .62, 120),
  ingredient('mozzarella', 'Arla Mozzarella Cheese 200g', 'g', 2000, .8, 120),
  ingredient('parmesan', 'Kraft Grated Parmesan Cheese 85g', 'g', 800, 1.2, 365),
  ingredient('cream_cheese', 'Magnolia Cream Cheese 225g', 'g', 900, .75, 120),
  ingredient('oil', 'Golden Fiesta Canola Oil 1L', 'ml', 5000, .16, 365),
  ingredient('salt', 'Fidel Iodized Salt 1kg', 'g', 1000, .025, 730),
  ingredient('pepper', 'McCormick Ground Black Pepper 80g', 'g', 250, 1.1, 730),
  ingredient('rice', 'Doña Maria Jasponica Rice 5kg', 'g', 8000, .085, 365),
  ingredient('pasta', 'San Remo Spaghetti Pasta 500g', 'g', 3500, .18, 730),
  ingredient('tomato', 'Del Monte Tomato Sauce 1kg', 'g', 3000, .1, 365),
  ingredient('pesto', 'Filippo Berio Basil Pesto 190g', 'g', 1000, 1.1, 365),
  ingredient('garlic', 'Fresh Garlic 1kg', 'g', 700, .16, 21),
  ingredient('onion', 'Fresh Red Onion 1kg', 'g', 1200, .14, 21),
  ingredient('lettuce', 'Fresh Iceberg Lettuce 1kg', 'g', 1200, .18, 7),
  ingredient('chicken', 'Magnolia Chicken Wings 1kg', 'g', 4000, .25, 5),
  ingredient('beef', 'Monterey Beef Sirloin 1kg', 'g', 3000, .55, 5),
  ingredient('shrimp', 'Fresh Medium Shrimp 1kg', 'g', 1800, .48, 4),
  ingredient('pork_tocino', 'Pampanga’s Best Pork Tocino 450g', 'g', 2000, .35, 60),
  ingredient('longganisa', 'Pampanga’s Best Skinless Longganisa 450g', 'g', 2000, .32, 60),
  ingredient('bangus', 'Sarangani Bay Boneless Bangus 450g', 'g', 1600, .4, 60),
  ingredient('tuna', 'Century Tuna Flakes in Oil 180g', 'g', 1400, .35, 365),
  ingredient('sardines', 'Spanish Sardines in Olive Oil 220g', 'g', 1200, .5, 365),
  ingredient('pepperoni', 'Purefoods Pepperoni 250g', 'g', 1000, .6, 90),
  ingredient('tortilla', 'Mission Soft Flour Tortillas 10s', 'pcs', 80, 16, 30),
  ingredient('tortilla_chips', 'Tostitos Restaurant Style Tortilla Chips 283g', 'g', 1500, .65, 180),
  ingredient('fries', 'Farm Frites Frozen French Fries 1kg', 'g', 3000, .19, 180),
  ingredient('pizza_dough', 'Fresh Pizza Dough 250g', 'g', 2000, .15, 4),
  ingredient('breadcrumbs', 'Maya Japanese Bread Crumbs 200g', 'g', 700, .3, 365),
  ingredient('kbbq_sauce', 'Lee Kum Kee Korean BBQ Sauce 240g', 'g', 900, .5, 365),
  ingredient('sriracha', 'Huy Fong Sriracha Hot Chili Sauce 481g', 'g', 700, .65, 365),
  ingredient('salted_egg', 'Knorr Salted Egg Powder 500g', 'g', 600, .9, 365),
  ingredient('red_chili', 'Fresh Philippine Red Chili Peppers 1kg', 'g', 600, .4, 10),
  ingredient('vinegar', 'Datu Puti Vinegar 1L', 'ml', 2000, .07, 365),
  ingredient('bottled_water', 'Wilkins Pure Bottled Water 500ml', 'pcs', 120, 18, 365),
  ingredient('cup_12', 'Greenware 12oz Double Wall Paper Cup', 'pcs', 500, 2.2, 0),
  ingredient('cup_22', 'Greenware 22oz Cold Drink Cup', 'pcs', 300, 3.4, 0),
  ingredient('lid_12', 'Greenware 12oz Sip Hole Lid', 'pcs', 500, .9, 0),
  ingredient('lid_22', 'Greenware 22oz Dome Lid', 'pcs', 300, 1.3, 0),
  ingredient('straw', 'Greenware Paper Drinking Straw 100s', 'pcs', 500, .7, 0),
  ingredient('napkin', 'TOP Creamery Pre-Cut Tissue Napkins 100pcs', 'pcs', 800, .5, 0),
  ingredient('food_box', 'Greenware Sugarcane Bagasse Bento Box', 'pcs', 160, 7.5, 0),
  ingredient('sauce_bottle', 'Food Grade PET Sauce Bottle 150ml', 'pcs', 100, 7, 0),
];

const coldPack = { cup_12: 1, lid_12: 1, straw: 1, napkin: 1 };
const hotPack = { cup_12: 1, lid_12: 1, napkin: 1 };
const bigPack = { cup_22: 1, lid_22: 1, straw: 1, napkin: 1 };
const foodPack = { food_box: 1, napkin: 1 };
const season = { salt: 1, pepper: .3, oil: 8 };
const bat = { flour: 65, eggs: .3, whole_milk: 45, butter: 12, sugar: 10, salt: .5 };

const slug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const menu: SyntheticVariant[] = [];
function add(category: string, productName: string, variantName: string, price: number, popularity: number, recipe: Record<string, number>) {
  const key = slug(`${category}_${productName}_${variantName}`);
  menu.push({ key, productName, category, variantName, sku: `CS-${key.toUpperCase()}`, basePrice: price, popularity, recipe });
}
function coffee(name: string, price: number, extras: Record<string, number>, popularity = 4) {
  add('Coffee', name, 'Hot 12oz', price, popularity, { coffee: 18, filtered_water: 55, whole_milk: 145, ...extras, ...hotPack });
  add('Coffee', name, 'Iced 22oz', price + 35, popularity + 1, { coffee: 22, filtered_water: 70, whole_milk: 220, ice: 180, ...extras, ...bigPack });
}
add('Coffee', 'Cubano (Espresso Shot)', 'Single', 90, 3, { coffee: 18, filtered_water: 40, ...hotPack });
add('Coffee', 'Cafe Americano', 'Hot 12oz', 115, 7, { coffee: 18, filtered_water: 240, ...hotPack });
add('Coffee', 'Cafe Americano', 'Iced 22oz', 145, 7, { coffee: 22, filtered_water: 260, ice: 180, ...bigPack });
coffee('Cappuccino', 145, {}, 5);
coffee('Latte', 150, {}, 6);
coffee('Spanish Latte', 170, { condensed_milk: 25 }, 12);
coffee('Mocha', 180, { chocolate: 18, choc_syrup: 12 }, 6);
add('Coffee', 'Cold Brew', 'Iced 22oz', 165, 4, { coffee: 26, filtered_water: 320, ice: 160, ...bigPack });
coffee('Caramel Macchiato', 185, { caramel: 20 }, 7);
coffee('Hazelnut Macchiato', 185, { hazelnut: 20 }, 5);
coffee('Matcha Espresso Latte', 195, { matcha: 12 }, 5);
coffee('Cold Foam Espresso', 190, { cream: 45, vanilla: 12 }, 4);
coffee('Taho Kape Latte', 205, { taho: 70, sugar: 10 }, 6);
coffee('Blackadamia', 210, { macadamia: 18, choc_syrup: 12 }, 8);
coffee('Crème-Bru Latte', 205, { caramel: 18, vanilla: 10, sugar: 6 }, 6);
coffee('Biscoff Coffee Latte', 210, { biscoff: 28 }, 8);
function coldDrink(name: string, price: number, popularity: number, ingredients: Record<string, number>) {
  add('Non-Coffee', name, 'Iced 22oz', price, popularity, { filtered_water: 70, ice: 180, ...ingredients, ...bigPack });
}
coldDrink('Dark Chocolate', 175, 5, { chocolate: 35, whole_milk: 220, choc_syrup: 15 });
coldDrink('Matcha Latte', 185, 6, { matcha: 18, whole_milk: 220, sugar: 12 });
coldDrink('Houseblend Iced Tea', 135, 4, { black_tea: 2, lemon_juice: 15, sugar: 18, filtered_water: 250 });
coldDrink('Thai Milktea', 165, 5, { thai_tea: 24, evaporated_milk: 50, condensed_milk: 25, whole_milk: 120 });
coldDrink('Strawberry Taho Latte', 190, 5, { taho: 100, strawberry: 55, whole_milk: 150, strawberry_syrup: 15 });
coldDrink('Mango Shake', 175, 5, { mango: 170, whole_milk: 100, sugar: 15 });
coldDrink('Chai Tea Latte', 180, 3, { chai: 2, whole_milk: 190, sugar: 12 });
function lemonade(name: string, price: number, extras: Record<string, number>) {
  add('Lemonade', name, 'Iced 22oz', price, 3, { lemon_juice: 45, filtered_water: 260, ice: 180, sugar: 20, ...extras, ...bigPack });
}
lemonade('Classic Lemon', 145, {});
lemonade('Passion Fruit', 165, { passion: 22 });
lemonade('Strawberiri', 165, { strawberry_syrup: 22 });
lemonade('Mango Trail', 165, { mango_syrup: 22 });
lemonade('Butterfly Pea (Violet Drink)', 175, { butterfly_pea: 2 });
function blended(name: string, price: number, extras: Record<string, number>, hasCoffee = false) {
  add('Ice-Blended', name, '22oz', price, 3, { whole_milk: 180, ice: 230, sugar: 10, ...(hasCoffee ? { coffee: 18, filtered_water: 45 } : {}), ...extras, ...bigPack });
}
blended('Mocha Chip', 210, { chocolate: 25, choc_syrup: 20 }, true);
blended('White Caramel Mocha', 215, { white_choc: 25, caramel: 18 }, true);
blended('Peppermint Mocha', 215, { peppermint: 18, chocolate: 20 }, true);
blended('Vanilla Bean Strawberry', 205, { vanilla: 18, strawberry: 65 });
blended('Double Choco Chip', 210, { chocolate: 35, choc_syrup: 20 });
blended('Oreo Cookie Crumble', 210, { oreos: 45, choc_syrup: 12 });
blended('Matcha Choco Drizzle', 215, { matcha: 18, choc_syrup: 20 });
blended('Peach Milk', 205, { peach: 70, cream: 30 });
function crepe(name: string, price: number, extras: Record<string, number>) {
  add('Crepes', name, 'Single', price, 3, { ...bat, ...extras, ...foodPack });
}
crepe('Butter Sugar Crepe', 145, { butter: 10, sugar: 15 });
crepe('Death by Chocolate Crepe', 185, { chocolate: 25, choc_syrup: 25, cream: 20 });
crepe('Strawberries & Cream Crepe', 195, { strawberry: 75, cream: 55 });
crepe('Monkey Madness Crepe', 190, { banana: 85, chocolate: 20, cream: 30 });
crepe('Mango Dream Crepe', 195, { mango: 85, cream: 45 });
function waffle(name: string, price: number, extras: Record<string, number>) {
  add('Waffles', name, 'Single', price, 3, { ...bat, flour: 90, butter: 18, ...extras, ...foodPack });
}
waffle('Original Waffles', 155, { butter: 25, sugar: 18 });
waffle('Strawberry Mallow Waffles', 195, { strawberry: 65, marshmallow: 35, cream: 25 });
waffle('Choco Cream Waffles', 195, { chocolate: 25, choc_syrup: 20, cream: 40 });
waffle('Caramel Mocha Waffles', 205, { caramel: 20, coffee: 6, chocolate: 15 });
waffle('Nutty Mango Waffles', 210, { mango: 75, macadamia: 20 });
const wings = { chicken: 450, flour: 25, breadcrumbs: 35, garlic: 6, ...season, ...foodPack };
add('Ala Carte', 'Chicken Wings 8 pcs', 'Garlic Parmesan', 320, 5, { ...wings, parmesan: 28, butter: 15 });
add('Ala Carte', 'Chicken Wings 8 pcs', 'KBBQ', 320, 4, { ...wings, kbbq_sauce: 50 });
add('Ala Carte', 'Chicken Wings 8 pcs', 'Sriracha', 320, 3, { ...wings, sriracha: 35 });
add('Ala Carte', 'Chicken Wings 8 pcs', 'Salted Egg', 370, 4, { ...wings, salted_egg: 35 });
add('Ala Carte', 'Soft Tacos 2 pcs', 'Beef', 235, 4, { tortilla: 2, beef: 80, lettuce: 30, tomato: 20, onion: 12, cheese: 15, ...season, ...foodPack });
add('Ala Carte', 'Soft Tacos 2 pcs', 'Shrimp', 255, 3, { tortilla: 2, shrimp: 80, lettuce: 30, tomato: 20, onion: 12, cheese: 15, ...season, ...foodPack });
add('Ala Carte', 'Cheese Nachos', 'Regular', 195, 4, { tortilla_chips: 65, cheese: 25, tomato: 20, onion: 12, sriracha: 5, ...foodPack });
add('Ala Carte', 'Beef Nachos', 'Regular', 245, 4, { tortilla_chips: 65, cheese: 25, beef: 45, tomato: 25, onion: 12, ...season, ...foodPack });
add('Ala Carte', 'French Fries', 'Regular', 125, 5, { fries: 180, oil: 15, salt: 2, ...foodPack });
const pizza = { pizza_dough: 220, tomato: 65, mozzarella: 80, garlic: 4, oil: 8, salt: 2, ...foodPack };
add('Pizza', 'Margherita', 'Regular', 320, 4, { ...pizza });
add('Pizza', 'Four Cheese', 'Regular', 365, 4, { ...pizza, cheese: 30, parmesan: 10, cream_cheese: 20 });
add('Pizza', 'Pepperoni', 'Non Spicy', 360, 5, { ...pizza, pepperoni: 60 });
add('Pizza', 'Pepperoni', 'Spicy', 365, 4, { ...pizza, pepperoni: 60, sriracha: 12 });
add('Pizza', 'Pesto Tapa', 'Regular', 385, 4, { ...pizza, pesto: 25, beef: 75 });
add('Extras', 'Egg', 'Single', 25, 3, { eggs: 1, oil: 3, salt: .4, napkin: 1 });
add('Extras', 'Rice', 'Single', 35, 3, { rice: 100, filtered_water: 120, salt: .3, ...foodPack });
add('Extras', 'Bottled Water', '500ml', 35, 4, { bottled_water: 1 });
add('Extras', 'Homemade Hot Sauce (150ml)', '150ml', 125, 2, { red_chili: 45, vinegar: 65, garlic: 7, salt: 2, sauce_bottle: 1 });
add('Extras', 'Spicy Suka (150ml)', '150ml', 110, 2, { vinegar: 130, red_chili: 8, garlic: 5, pepper: 2, sauce_bottle: 1 });
function pastaDish(name: string, price: number, extras: Record<string, number>) {
  const base = { pasta: 125, cream: 65, garlic: 8, onion: 15, parmesan: 18, ...season, ...extras, ...foodPack };
  add('Pasta', name, 'Solo', price, 4, base);
  const family = Object.fromEntries(Object.entries(base).map(([key, quantity]) => [key, key === 'food_box' || key === 'napkin' ? 2 : quantity * 3]));
  add('Pasta', name, 'Family', price * 2.6, 2, family);
}
pastaDish('Creamy Tuna Pesto', 245, { tuna: 85, pesto: 28 });
pastaDish('Chicken Carbonara', 255, { chicken: 95, cheese: 30 });
pastaDish('Spanish Sardines', 265, { sardines: 95, tomato: 35 });
pastaDish('Beef Lasagna', 275, { beef: 110, tomato: 80, mozzarella: 55 });
const breakfast = { rice: 110, filtered_water: 130, eggs: 1, oil: 12, garlic: 5, salt: 2, pepper: .5, ...foodPack };
add('All Day Breakfast', 'Pork Tocino', 'Plate', 225, 5, { ...breakfast, pork_tocino: 170 });
add('All Day Breakfast', 'Beef Tapa', 'Plate', 255, 5, { ...breakfast, beef: 160, vinegar: 12 });
add('All Day Breakfast', 'Crispy Naked Longganisa', 'Plate', 235, 4, { ...breakfast, longganisa: 180 });
add('All Day Breakfast', 'Pan-Fried Baby Bangus', 'Plate', 255, 4, { ...breakfast, bangus: 200 });
// This checked-in CSV mirrors the provided menu's names, sizes and prices.
// It is used as data input so future menu corrections do not require editing
// every recipe definition. An unmatched row fails fast before database reset.
const referenceRows = readFileSync(join(__dirname, 'menu-reference.csv'), 'utf8')
  .trim().split(/\r?\n/).slice(1).map((line) => {
    const cells = line.split(',');
    return {
      productName: cells[1].trim(),
      category: cells[2].trim(),
      variantName: cells[4].trim(),
      price: Number(cells[5]),
      sku: cells[6].trim(),
    };
  });
function referenceTemplate(productName: string, variantName: string): SyntheticVariant {
  const normalized = productName.toLowerCase();
  const name = normalized === 'cappucino' ? 'Cappuccino'
    : normalized === 'cubano (espresso shot)' ? 'Cubano (Espresso Shot)'
      : productName.startsWith('Soft tacos 2 pcs') ? 'Soft Tacos 2 pcs' : productName;
  const choices = menu.filter((entry) => entry.productName === name);
  if (choices.length === 0) throw new Error(`No recipe template for menu product ${productName}.`);
  if (productName.startsWith('Soft tacos 2 pcs')) {
    return choices.find((entry) => entry.variantName.toLowerCase() === (normalized.includes('shrimp') ? 'shrimp' : 'beef'))!;
  }
  if (variantName.startsWith('Hot')) return choices.find((entry) => entry.variantName.startsWith('Hot')) ?? choices[0];
  if (variantName.startsWith('Iced')) return choices.find((entry) => entry.variantName.startsWith('Iced')) ?? choices[0];
  return choices.find((entry) => entry.variantName === variantName) ?? choices[0];
}
export const VARIANTS: SyntheticVariant[] = referenceRows.flatMap((row) => {
  const category = row.category === 'Coffee Based' ? 'Ice-Blended Coffee'
    : row.category === 'Non-Coffee Based' ? 'Ice-Blended Non-Coffee' : row.category;
  if (row.productName === 'Chicken Wings 8 pcs') {
    return menu.filter((entry) => entry.productName === row.productName).map((entry) => ({
      ...entry, category, basePrice: row.price + (entry.variantName === 'Salted Egg' ? 50 : 0),
    }));
  }
  const template = referenceTemplate(row.productName, row.variantName);
  const productName = row.productName === 'Cappucino' ? 'Cappuccino'
    : row.productName === 'Cubano (espresso shot)' ? 'Cubano (Espresso Shot)'
      : row.productName.startsWith('Soft tacos 2 pcs') ? 'Soft Tacos 2 pcs' : row.productName;
  const variantName = row.productName.startsWith('Soft tacos 2 pcs')
    ? template.variantName : row.variantName;
  let recipe = { ...template.recipe };
  if (row.variantName.startsWith('Hot') && template.variantName.startsWith('Iced')) {
    const { ice, cup_22, lid_22, straw, ...rest } = recipe;
    recipe = { ...rest, ...hotPack };
  }
  return [{
    ...template,
    key: slug(`${category}_${productName}_${variantName}`),
    productName, category, variantName, sku: row.sku,
    basePrice: row.price, recipe,
  }];
});

const specialtyMaterials = new Set(['coffee', 'matcha', 'cup_12', 'cup_22', 'lid_12', 'lid_22', 'straw', 'food_box', 'sauce_bottle']);
const groceryMaterials = MATERIALS.filter(m => !specialtyMaterials.has(m.key)).map(m => m.key);
export const SUPPLIERS = [
  { key: 'puregold', name: 'Puregold Jr - Dasmariñas Cavite', address: 'Don Placido Campos Avenue, Dasmariñas, Cavite 4114, Philippines', latitude: 14.328393, longitude: 120.93378, contactInfo: 'https://puregold.com.ph', materials: groceryMaterials },
  { key: 'sm_city', name: 'SM Supermarket - SM City Dasmariñas', address: 'Governor’s Drive, Brgy. Sampaloc 1, Dasmariñas, Cavite 4114, Philippines', latitude: 14.3015, longitude: 120.95696, contactInfo: 'SM Markets: https://smmarkets.ph', materials: groceryMaterials },
  { key: 'waltermart', name: 'WalterMart Dasmariñas', address: 'KM 30 Emilio Aguinaldo Highway, Brgy. Burol, Dasmariñas, Cavite 4114, Philippines', latitude: 14.324969, longitude: 120.941027, contactInfo: '0920 928 1386 | wms.operations.dasmarinas@waltermart.com.ph', materials: groceryMaterials },
  { key: 'robinsons', name: 'Robinsons Supermarket - Robinsons Place Dasmariñas', address: 'Emilio Aguinaldo Highway corner Governor’s Drive, Dasmariñas, Cavite 4114, Philippines', latitude: 14.300478, longitude: 120.953975, contactInfo: 'Robinsons Malls: https://robinsonsmalls.com', materials: groceryMaterials },
  { key: 'top_creamery', name: 'TOP Creamery Food Manufacturing Corporation', address: '100 Marcos-Alvarez Avenue, Talon Uno, Las Piñas City, Metro Manila 1747, Philippines', latitude: 14.43304, longitude: 121.00482, contactInfo: '+63 917 187 0978 | support@topcreamery.com', materials: ['coffee', 'matcha'] },
  { key: 'greenware', name: 'Greenware by JEGRO Corp.', address: 'Unit 7, 2F RB Building, #1 Don Jesus Boulevard, Brgy. Cupang, Muntinlupa City, Metro Manila, Philippines', latitude: 14.434894, longitude: 121.03296, contactInfo: '+63 2 8732 1659 | https://greenware.ph', materials: ['cup_12', 'cup_22', 'lid_12', 'lid_22', 'straw', 'food_box', 'sauce_bottle'] },
];
export const MODIFIER_GROUPS = [
  { key: 'milk-choice', name: 'Milk Choice', selectionMode: 'SINGLE' as const, defaultMinSelect: 0, defaultMaxSelect: 1 },
  { key: 'espresso-extra', name: 'Espresso Extras', selectionMode: 'MULTIPLE' as const, defaultMinSelect: 0, defaultMaxSelect: 1 },
];
export const MODIFIERS: SyntheticModifier[] = [
  { key: 'oat-milk-swap', groupKey: 'milk-choice', name: 'Oatside Barista Blend', priceAdjustment: 35, recipeAdjustments: { whole_milk: -145, oat_milk: 145 } },
  { key: 'extra-shot', groupKey: 'espresso-extra', name: 'Extra Espresso Shot', priceAdjustment: 30, recipeAdjustments: { coffee: 18, filtered_water: 40 } },
];
