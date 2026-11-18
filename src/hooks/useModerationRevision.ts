import { useEffect, useState } from 'react';
import { subscribeModerationChanges } from '../services/moderationService';

export const useModerationRevision = (): number => {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeModerationChanges(() => setRevision((value) => value + 1)), []);
  return revision;
};
