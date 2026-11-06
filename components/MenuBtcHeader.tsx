import React from 'react';
import { BtcPriceLabel } from './BtcFeed';
import BtcSparkline from './BtcSparkline';

interface MenuBtcHeaderProps {
  compact?: boolean;
  clock: React.ReactNode;
}

/**
 * Price, liveline sparkline, and clock as chrome grid cells.
 * `menu-chrome__feed` uses display:contents so the header grid sees each cell.
 * Feed state lives in App-level BtcFeedProvider so history survives screen hops.
 *
 * Sparkline is eager (not lazy): a Suspense empty fallback was the blank beat
 * between chrome skeleton and the first Liveline paint.
 */
const MenuBtcHeader: React.FC<MenuBtcHeaderProps> = ({
  compact = false,
  clock,
}) => (
  <div className="menu-chrome__feed">
    <div className="menu-chrome__price">
      <BtcPriceLabel compact={compact} />
    </div>
    <div className="menu-chrome__chart">
      <BtcSparkline compact={compact} />
    </div>
    <div className="menu-chrome__clock text-right font-mono leading-tight">{clock}</div>
  </div>
);

export default MenuBtcHeader;
