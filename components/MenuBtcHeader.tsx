import React, { Suspense, lazy } from 'react';
import { BtcPriceLabel } from './BtcFeed';

const BtcSparkline = lazy(() => import('./BtcSparkline'));

interface MenuBtcHeaderProps {
  compact?: boolean;
  clock: React.ReactNode;
}

/**
 * Price, liveline sparkline, and clock as chrome grid cells.
 * `menu-chrome__feed` uses display:contents so the header grid sees each cell.
 * Feed state lives in App-level BtcFeedProvider so history survives screen hops.
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
      <Suspense
        fallback={
          <div
            className={`btc-spark ${compact ? 'btc-spark--compact' : ''} btc-spark--empty`}
            aria-hidden="true"
          />
        }
      >
        <BtcSparkline compact={compact} />
      </Suspense>
    </div>
    <div className="menu-chrome__clock text-right font-mono leading-tight">{clock}</div>
  </div>
);

export default MenuBtcHeader;
