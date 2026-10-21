// Skill library the GTMBots draw from, based on the twelve core GTM-engineering skills.

export interface Skill {
  id: string;
  name: string;
  what: string;
}

export const SKILLS: Skill[] = [
  { id: "stack", name: "Tech stack evaluation", what: "Pick and compare enrichment, CRM and sequencing tools for a job." },
  { id: "workflow", name: "Workflow design", what: "Design the steps, triggers and hand-offs between tools and people." },
  { id: "tam", name: "TAM mapping", what: "Build and maintain the target account list from many sources." },
  { id: "signals", name: "Signal tracking", what: "Watch first-, second- and third-party signals and date every one." },
  { id: "enrichment", name: "Data enrichment", what: "Waterfall company and contact data, find domains, roles and funding." },
  { id: "outbound", name: "Automated outbound", what: "ICP to list to enrichment to scoring to sequences, with Tier 1 kept manual." },
  { id: "inbound", name: "Inbound orchestration", what: "Qualify, route, approve, enrich and sync inbound leads to the CRM." },
  { id: "agentops", name: "Agent operations", what: "Run agents with skills, rules, hooks and versioned instructions." },
  { id: "ads", name: "Ads audiences", what: "Turn segments into scheduled ad audiences." },
  { id: "crm", name: "CRM operations", what: "Keep the system of record clean across the customer lifecycle." },
  { id: "awareness", name: "Awareness scoring", what: "Score accounts from identified to selecting, and by fit tier." },
  { id: "content", name: "Content engineering", what: "Write first touches, briefs and posts from real examples." },
];

export const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name || id;
