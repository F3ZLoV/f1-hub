"use client";

import { useEffect, useState } from "react";

/**
 * 클라이언트 데이터 로딩 공통 훅.
 * 정적 export(서버 없음)라 페이지 데이터는 브라우저에서 직접 가져온다.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "로드 실패");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
