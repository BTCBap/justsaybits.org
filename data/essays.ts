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
    title: "Self-Custody Is Losing Its Luster at the Worst Possible Time",
    date: "Feb 03, 2026",
    readTime: "6 min",
    excerpt: "The exact moment the world most needs sovereign, bearer-form money is the moment people stopped caring about holding it.",
    slug: "self-custody-losing-luster",
    content: `ETFs passed, institutions showed up, and your coworker who used to ask "is Bitcoin a scam?" now has some in his Fidelity account. We won, apparently.

Somewhere in that victory lap, holding your own keys quietly became the weird thing to do. The tinfoil-hat option, the thing your friend's friend still does because he "doesn't trust anyone." Everyone else moved on to buying Bitcoin the same way they buy an index fund. No seed phrases, no hardware wallets, no thinking required.

I get it. The path of least resistance showed up and people took it. That's not a criticism, that's just what people do.

But the timing is terrible.

**Everyone Relaxed**

FTX collapsed just over three years ago. Creditors are only now clawing back partial recoveries, but the lesson feels distant. Exchanges feel safe again, custodial products multiplied, and the ETF made Bitcoin feel like a stock, something that lives in your brokerage app with a ticker symbol and a fact sheet. The novelty has worn off on Wall Street, but the conversation never circled back to self-custody. It just moved on.

Holding your own keys went from "the point of Bitcoin" to a power-user feature, which is a strange thing to call the reason it exists. What started as a movement turned into a product race, and the product that won was the one that made Bitcoin work exactly like the system it was built to replace.

**What's Actually Happening Right Now**

The surveillance infrastructure around us didn't pause because Bitcoin got legitimized. It accelerated. Flock Safety cameras are installed in over 5,000 U.S. cities now. Automated license plate readers log where your car was and when. "Pattern-of-life analysis," a phrase that used to live in military intelligence briefings, is now a bullet point in municipal police software demos. Predictive policing tools decide who gets extra scrutiny based on algorithms nobody outside the vendor has audited.

AI isn't a research concept anymore. It's deployed, analyzing behavioral patterns in real time, modeling not just what you did but what you'll probably do next.

Stablecoins and CBDC pilot programs are building the infrastructure for programmable money, the kind that can be frozen or restricted. Not by a judge with a warrant, but by code. China's digital yuan already does this, the ECB's digital euro is in development, and in the U.S. the same infrastructure is arriving through private stablecoins like USDT, USDC, and PYUSD, programmable dollars already at scale.

Jeff Booth talks about technology as a deflationary force, but the same exponential curve that makes things cheaper also makes monitoring cheaper. Surveillance scales the way software scales: once the system is built, the cost of watching one more person approaches zero.

None of this is conspiratorial, or even evil. These are companies building products and governments buying them.

**Self-Custody Isn't the Paranoid Option**

Bitcoin was never about "number go up." It was that no one can take this from you or tell you what to do with it, and that required you to hold the thing.

When money becomes programmable and surveillance becomes the default, the only money that's yours is the money you hold yourself. Everything else is a promise from a third party that they'll honor your balance and not change the terms, and that promise is only as good as the political environment it exists in.

The case for holding your own keys didn't weaken because BlackRock started offering an ETF. It got stronger. The world just got distracted.

If someone had described this future to you five years ago, you would've said "this is exactly why Bitcoin matters." All of that came true, and we handed the Bitcoin to asset managers and called it progress.

**The Irony**

The exact moment the world most needs money no one else controls is the moment people stopped caring about holding it.

Exposure isn't ownership. A paper claim on Bitcoin held by Coinbase is not the same as holding your own keys. The ETF brought Bitcoin into the mainstream by stripping out the property that made it yours, so it could be regulated and behave like everything else.

It's not your BTC if BlackRock holds it.

The people who've been around long enough remember why they got here, but everyone who came in through the ETF never heard the pitch. They bought Bitcoin the same way they bought SPY, and they'll get the same financial freedom from it (which is none).

**The Window Is Open**

The world doesn't get less surveilled from here. Right now, you can still move Bitcoin off exchanges and take custody yourself. The tooling is better than it was even two years ago. You don't need to be technical, you just need to decide it matters.

But regulations are tightening and KYC requirements get more granular every year. That window won't stay open forever, and the time to take it seriously is while most people are looking the other way.

Self-custody didn't lose its relevance. Everyone else just lost the plot.`
  },
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
