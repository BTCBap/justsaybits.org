export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

export enum View {
  HOME = 'home',
  ABOUT = 'about',
  DENVER_BITDEVS = 'denver_bitdevs',
  THE_SPACE = 'the_space',
  BOOK = 'book',
  PODCAST = 'podcast',
  CONTACT = 'contact',
}

export interface Chapter {
  id: number;
  title: string;
  content: string[];
}
