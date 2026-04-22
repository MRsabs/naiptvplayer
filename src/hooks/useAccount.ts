import { useEffect, useState } from "react";
import { getAccount } from "../store";
import type { Account } from "../types";

export function useAccount(id: string | undefined) {
  const [account, setAccount] = useState<Account | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    getAccount(id)
      .then(setAccount)
      .finally(() => setLoading(false));
  }, [id]);

  return { account, loading };
}
