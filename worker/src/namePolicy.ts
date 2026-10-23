export const normalizeNamePolicyValue = (name: string): string => name
  .normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

export const isClearlyInappropriateName = (name: string): boolean => {
  // Exact matching avoids rejecting ordinary names that merely contain a short word.
  const normalized = normalizeNamePolicyValue(name);
  return /^(?:死ね|しね|殺す|ころす|fuck(?:you)?|nigger)$/.test(normalized);
};
