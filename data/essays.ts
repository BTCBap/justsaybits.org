import { WritingItem } from '../types';

/**
 * Essay data for the site.
 * To add a new essay:
 * 1. Add a new object to the ESSAYS array below
 * 2. Follow the WritingItem type structure
 * 3. Ensure the slug is unique and URL-friendly
 * 4. Estimate readTime based on ~200-250 words per minute
 */

export const ESSAYS: WritingItem[] = [
  {
    title: "Volatility as Information",
    date: "Dec 01, 2025",
    readTime: "3 min",
    excerpt: "People say bitcoin is too volatile to be useful. But I think they're looking at it wrong.",
    slug: "volatility-as-information",
    content: `People say bitcoin is too volatile to be useful. But I think they're looking at it wrong.

Traditional markets are managed for stability. "Stable Prices and Maximum Employment" might as well be tattooed on central bankers' forearms - they work hard to keep things smooth at all costs.

That "smooth at all costs" assurance sounds good until you realize what that "stability" actually does cost: the people closest to the money printer get rich while everyone else's savings slowly dissolve. This is the Cantillon effect in action as new money flows first to banks, governments, and connected corporations to let them bid up assets (and benefit from it) before prices rise for the general population.

Bitcoin works differently. There is no money printer or privileged access. The price you see is simply what the active market participants believe it's worth at that time (which is a small subset of total owners.)

That's in part why Bitcoin's volatility isn't a bug or a problem. It's just the free market working as intended actually. The price is raw information and sometimes that information changes fast.

Think about what causes the swings anyway. Partly it's the world still figuring out what Bitcoin actually is, which is decades-long process. Partly it's the macro environment shifting: when fiat feels unreliable and long-term planning gets harder, capital rushes in or out of asset classes quickly. The volatility just reflects the uncertainty of living and investing in today's world.

The real question isn't "will Bitcoin keep bouncing around?" - of course it will. The real question is: do you prefer an asset that can swing wildly but can't be secretly debased, or one that's "stable" because someone quietly steals 2–10% of its value every year?

Inflation is slow-motion theft. With Bitcoin, you can see (and feel 😅) the risk right in front of you, instead of waking up 20 years later with 1/10th the purchasing power.

And sure, there are plenty of problems with Bitcoin left to solve. But the protocol offers a consistent measuring stick that fiat money never will. Your time and work are finite and they shouldn't be priced in units that can be printed without limit.

The volatility is simply the price of that freedom from debasement. Still seems like a fair trade to me.`
  },
  {
    title: "The Tao of the Twenty-First Century",
    date: "Nov 30, 2025",
    readTime: "4 min",
    excerpt: "The scary part isn't that we're making powerful things. It's that the gap between what we can build and what we understand is widening.",
    slug: "tao-21st-century",
    content: `We're living through something unprecedented. Not just the pace of change but the specific combination of what's changing. We can edit genes, talk to machines that seem intelligent, and we're close to making energy too cheap to meter. At the same time, we're building things we don't fully understand.

The scary part isn't that we're making powerful things. It's that the gap between what we can build and what we understand is widening. A programmer in 1970 could explain exactly how their code worked. Now we train neural networks that solve problems in ways their creators can't articulate. We're like mechanics who can make the car go faster without knowing why the engine works.

But here's what people miss: this has always been true. The farmers who domesticated wheat didn't understand genetics. The merchants who developed double-entry bookkeeping didn't have a theory of information. We've always been building on top of things we don't fully grasp.

What's different now is we're conscious of it. And that consciousness might be the thing that saves us. Every powerful technology eventually becomes mundane. Electricity seemed magical and dangerous. Now it's boring. The question isn't whether we'll survive our own cleverness—we always have. It's whether we're brave enough to keep building things we don't yet understand, knowing that understanding follows use, not the other way around.

What if the fear is just a part of growing pains?`
  },
];
