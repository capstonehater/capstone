import { DiscountOption, Product } from "./types";

export const PRODUCTS: Product[] = [
  {
    id: "coffee-001",
    sku: "CF-ESP-001",
    name: "Espresso",
    category: "Coffee",
    basePrice: 90,
    bestseller: true,
    variants: {
      size: [
        { label: "12oz", priceModifier: 0 },
        { label: "16oz", priceModifier: 20 },
        { label: "22oz", priceModifier: 40 },
      ],
      temp: [
        { label: "Hot", priceModifier: 0 },
        { label: "Iced", priceModifier: 10 },
        { label: "Cold", priceModifier: 15 },
      ],
      addons: [
        { label: "Extra Shot", price: 20 },
        { label: "Oat Milk", price: 25 },
        { label: "Vanilla Syrup", price: 15 },
      ],
    },
  },
  {
    id: "coffee-002",
    sku: "CF-LAT-002",
    name: "Cafe Latte",
    category: "Coffee",
    basePrice: 145,
    bestseller: true,
    variants: {
      size: [
        { label: "12oz", priceModifier: 0 },
        { label: "16oz", priceModifier: 25 },
        { label: "22oz", priceModifier: 45 },
      ],
      temp: [
        { label: "Hot", priceModifier: 0 },
        { label: "Iced", priceModifier: 10 },
        { label: "Cold", priceModifier: 15 },
      ],
      addons: [
        { label: "Extra Shot", price: 20 },
        { label: "Soy Milk", price: 25 },
        { label: "Caramel Syrup", price: 15 },
      ],
    },
  },
  {
    id: "coffee-003",
    sku: "CF-MOC-003",
    name: "Mocha",
    category: "Coffee",
    basePrice: 165,
    bestseller: false,
    variants: {
      size: [
        { label: "12oz", priceModifier: 0 },
        { label: "16oz", priceModifier: 25 },
        { label: "22oz", priceModifier: 50 },
      ],
      temp: [
        { label: "Hot", priceModifier: 0 },
        { label: "Iced", priceModifier: 10 },
        { label: "Cold", priceModifier: 15 },
      ],
      addons: [
        { label: "Whipped Cream", price: 20 },
        { label: "Extra Shot", price: 20 },
        { label: "Hazelnut Syrup", price: 15 },
      ],
    },
  },
  {
    id: "pastry-001",
    sku: "PS-CRS-001",
    name: "Butter Croissant",
    category: "Pastries",
    basePrice: 95,
    bestseller: true,
    variants: {
      size: [{ label: "Regular", priceModifier: 0 }],
      temp: [{ label: "Fresh", priceModifier: 0 }],
      addons: [
        { label: "Jam", price: 10 },
        { label: "Butter", price: 10 },
      ],
    },
  },
  {
    id: "pastry-002",
    sku: "PS-MFN-002",
    name: "Blueberry Muffin",
    category: "Pastries",
    basePrice: 85,
    bestseller: false,
    variants: {
      size: [{ label: "Regular", priceModifier: 0 }],
      temp: [{ label: "Fresh", priceModifier: 0 }],
      addons: [{ label: "Butter", price: 10 }],
    },
  },
  {
    id: "snack-001",
    sku: "SN-CHP-001",
    name: "Potato Chips",
    category: "Snacks",
    basePrice: 60,
    bestseller: false,
    variants: {
      size: [{ label: "Regular", priceModifier: 0 }],
      temp: [{ label: "Room Temp", priceModifier: 0 }],
      addons: [],
    },
  },
];

export const TAX_RATE = 0.12;

export const DISCOUNT_OPTIONS: DiscountOption[] = [
  { label: "None", value: "none", rate: 0 },
  { label: "PWD", value: "pwd", rate: 0.2 },
  { label: "Senior Citizen", value: "senior", rate: 0.2 },
];

export const POS_CATEGORIES = ["All", "Coffee", "Pastries", "Snacks"] as const;
