export type Plan = 'free' | 'starter' | 'pro' | 'business';

export interface PlanLimits {
  label: string;
  priceEur: number;
  clients: number;        // Infinity for unlimited
  teamMembers: number;
  storageMb: number;
  whiteLabel: boolean;
  invoices: boolean;
  customDomain: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free:     { label: 'Free',     priceEur: 0,   clients: 1,        teamMembers: 1,        storageMb: 500,    whiteLabel: false, invoices: false, customDomain: false },
  starter:  { label: 'Starter',  priceEur: 39,  clients: Infinity, teamMembers: 3,        storageMb: 10_000, whiteLabel: true,  invoices: true,  customDomain: true },
  pro:      { label: 'Pro',      priceEur: 79,  clients: Infinity, teamMembers: 10,       storageMb: 50_000, whiteLabel: true,  invoices: true,  customDomain: true },
  business: { label: 'Business', priceEur: 149, clients: Infinity, teamMembers: Infinity, storageMb: 200_000, whiteLabel: true, invoices: true,  customDomain: true },
};

export const PLAN_ORDER: Plan[] = ['free', 'starter', 'pro', 'business'];

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan as Plan) ?? 'free'] ?? PLAN_LIMITS.free;
}

export function planAllows(plan: string | null | undefined, feature: 'whiteLabel' | 'invoices' | 'customDomain'): boolean {
  return getPlanLimits(plan)[feature];
}

/** Throw a user-readable error if the plan lacks a boolean feature. */
export function assertPlanFeature(plan: string | null | undefined, feature: 'whiteLabel' | 'invoices' | 'customDomain'): void {
  if (!planAllows(plan, feature)) {
    throw new Error('Dieses Feature ist in deinem Tarif nicht enthalten — bitte upgraden.');
  }
}
