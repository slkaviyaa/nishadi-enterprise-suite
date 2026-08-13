// Central branch configuration.
// Keep branch IDs in one place so Main/Parallel logic does not drift across components.
export const BRANCHES = {
  MAIN: '11111111-1111-1111-1111-111111111111',
  PARALLEL: '22222222-2222-2222-2222-222222222222',
}

export const BRANCH_LABELS = {
  [BRANCHES.MAIN]: 'Main',
  [BRANCHES.PARALLEL]: 'Parallel',
}

export const DEFAULT_BRANCH_ID = BRANCHES.MAIN

export function getBranchLabel(branchId) {
  return BRANCH_LABELS[branchId] || branchId || 'Unknown'
}
