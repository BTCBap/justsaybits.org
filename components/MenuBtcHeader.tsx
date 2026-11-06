import React, { Suspense, lazy } from 'react';
import { BtcFeedProvider, BtcPriceLabel } from './BtcFeed';

const BtcSparkline = lazy(() => import('./BtcSparkline'));

interface MenuBtcHeaderProps {
  compact?: boolean;
  paused?: boolean;
  clock: React.ReactNode;
}

/**
 * Price, liveline sparkline, and clock as chrome grid cells.
 * `menu-chrome__feed` uses display:contents so the header grid sees each cell.
 */
const MenuBtcHeader: React.FC<MenuBtcHeaderProps> = ({
  compact = false,
  paused = false,
  clock,
}) => (
  <BtcFeedProvider paused={paused}>
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
  </BtcFeedProvider>
);

export default MenuBtcHeader;
