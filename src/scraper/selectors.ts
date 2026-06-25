export const FEED = 'div[role="feed"]';
export const LISTING_LINKS = 'div[role="feed"] a[href*="/maps/place/"]';

export const COOKIE_BUTTONS = [
  'button[aria-label="Aceptar todo"]',
  'button[aria-label="Accept all"]',
  'form[action*="consent"] button',
];

export const END_OF_LIST_TEXTS = [
  'Se han llegado al final de la lista',
  'Llegaste al final de la lista',
  "You've reached the end of the list",
];

export const SELECTORS = {
  name: ['h1.DUwDvf', 'h1'],
  category: ['button.DkEaL', '[jsaction*="category"]'],
  address: ['[data-item-id="address"] .Io6YTe'],
  phone: ['[data-item-id^="phone:tel"] .Io6YTe'],
  websiteText: ['[data-item-id="authority"] .Io6YTe'],
  websiteHref: ['a[data-item-id="authority"]'],
  rating: ['div.F7nice > span[aria-hidden="true"]'],
  reviews: ['div.F7nice > span > span > span[aria-label]'],
} as const;
