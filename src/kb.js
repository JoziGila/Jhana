// Single access point for the knowledge base in kb/*.json, shared by the app, the simulations
// and the tests.

import blockers from '../kb/blockers.json' with { type: 'json' };
import symptoms from '../kb/symptoms.json' with { type: 'json' };
import seeds from '../kb/seeds.json' with { type: 'json' };

export const BLOCKERS = blockers;
export const SYMPTOMS = symptoms;
export const SEEDS = seeds;

export const blockerById = (id) => BLOCKERS.find((b) => b.id === id) ?? null;
export const seedById = (id) => SEEDS.find((s) => s.id === id) ?? null;
export const symptomById = (id) => SYMPTOMS.find((s) => s.id === id) ?? null;
