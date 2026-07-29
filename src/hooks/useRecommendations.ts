import { useCallback, useEffect, useState } from 'react';
import { db, type Recommendation } from '../db/database';

export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const refresh = useCallback(async () => {
    const all = await db.recommendations.orderBy('createdAt').reverse().toArray();
    setRecommendations(all);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addRecommendation = useCallback(
    async (rec: Omit<Recommendation, 'id'>) => {
      const id = await db.recommendations.add(rec as Recommendation);
      await refresh();
      return id;
    },
    [refresh]
  );

  const acknowledgeRecommendation = useCallback(
    async (id: number) => {
      await db.recommendations.update(id, { acknowledged: true });
      await refresh();
    },
    [refresh]
  );

  return { recommendations, refresh, addRecommendation, acknowledgeRecommendation };
}
