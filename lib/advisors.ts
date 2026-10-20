// The Expert Board: advisors modelled on the publicly known frameworks of leading GTM voices on X.
// Grok answers in the spirit of each framework; it never quotes or speaks for the real person.

export interface Advisor {
  id: string;
  name: string;
  handle: string;
  lens: string;
  frameworks: string;
}

export const ADVISORS: Advisor[] = [
  { id: "dunford", name: "April Dunford", handle: "aprildunford", lens: "Positioning", frameworks: "Obviously Awesome: competitive alternatives, unique attributes, value, best-fit customers, market category" },
  { id: "poyar", name: "Kyle Poyar", handle: "poyark", lens: "PLG and pricing", frameworks: "Growth Unhinged: value metrics, usage-based and hybrid pricing, reverse trials, PLG benchmarks" },
  { id: "verna", name: "Elena Verna", handle: "elenaverna", lens: "Growth loops", frameworks: "growth loops over funnels, activation and retention first, product-led sales" },
  { id: "lemkin", name: "Jason Lemkin", handle: "jasonlk", lens: "SaaS scaling", frameworks: "SaaStr: founder-led sales to $1M ARR, hire reps in pairs, net revenue retention, annual contracts" },
  { id: "vajre", name: "Sangram Vajre", handle: "sangramvajre", lens: "GTM fit and ABM", frameworks: "GTM Partners: GTM fit, the MOVE framework, account-based marketing" },
  { id: "lenny", name: "Lenny Rachitsky", handle: "lennysan", lens: "Team practice", frameworks: "how great companies found their first customers, one channel that works, GTM team benchmarks" },
  { id: "fishkin", name: "Rand Fishkin", handle: "randfish", lens: "Audience research", frameworks: "SparkToro: audience research, zero-click content, where buyers pay attention" },
  { id: "amin", name: "Kareem Amin", handle: "kareemamin", lens: "GTM engineering", frameworks: "Clay: signal-based outbound, enrichment waterfalls, research-driven personalisation at scale" },
];

export const advisorById = (id: string) => ADVISORS.find((a) => a.id === id);
