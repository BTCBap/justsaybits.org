/**
 * One dynamic import per essay body. Vite emits a separate chunk for each, so
 * opening the Essays tab no longer downloads every essay's full text.
 */
export const loadEssayContent = (slug: string): Promise<string> => {
  switch (slug) {
    case "self-custody-losing-luster":
      return import('./essay-content/self-custody-losing-luster').then((m) => m.default);
    case "volatility-as-information":
      return import('./essay-content/volatility-as-information').then((m) => m.default);
    case "tao-21st-century":
      return import('./essay-content/tao-21st-century').then((m) => m.default);
    case "bitcoin-law-announcement":
      return import('./essay-content/bitcoin-law-announcement').then((m) => m.default);
    case "the-bitcoin-passport":
      return import('./essay-content/the-bitcoin-passport').then((m) => m.default);
    case "turning-6s-to-9s":
      return import('./essay-content/turning-6s-to-9s').then((m) => m.default);
    case "cheer-up-my-brother":
      return import('./essay-content/cheer-up-my-brother').then((m) => m.default);
    case "doge-elon-and-the-bitcoin-crash":
      return import('./essay-content/doge-elon-and-the-bitcoin-crash').then((m) => m.default);
    case "the-mooooon-":
      return import('./essay-content/the-mooooon-').then((m) => m.default);
    case "inertia":
      return import('./essay-content/inertia').then((m) => m.default);
    case "yes-bitcoin-yes":
      return import('./essay-content/yes-bitcoin-yes').then((m) => m.default);
    case "stop-the-games":
      return import('./essay-content/stop-the-games').then((m) => m.default);
    case "motivations-pt1":
      return import('./essay-content/motivations-pt1').then((m) => m.default);
    case "will-elon-musk-and-tsla-buy-btc":
      return import('./essay-content/will-elon-musk-and-tsla-buy-btc').then((m) => m.default);
    case "my-3-favorite-words":
      return import('./essay-content/my-3-favorite-words').then((m) => m.default);
    default:
      return Promise.reject(new Error(`Unknown essay: ${slug}`));
  }
};
