import {
  CircleHelp,
  MessagesSquare,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
} from 'lucide-react';

/** Resolves the icon keys used in the help content data to Lucide icons. */
const HELP_ICONS = {
  rocket: Rocket,
  search: Search,
  store: Store,
  messages: MessagesSquare,
  truck: Truck,
  wallet: Wallet,
  scale: Scale,
  shield: ShieldCheck,
};

export const helpIcon = (key) => HELP_ICONS[key] || CircleHelp;
