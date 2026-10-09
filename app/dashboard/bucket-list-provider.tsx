"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type BucketItem = {
    generation_id: string;
    status: "want_to_go" | "been_there";
    created_at: string;
    generation: { id: string; title: string; prompt: string; content: string } | null;
};

type BucketContext = {
    items: BucketItem[];
    loading: boolean;
    error: string;
    busyIds: Set<string>;
    reload: () => void;
    change: (id: string, method: "POST" | "PATCH" | "DELETE", status?: BucketItem["status"]) => Promise<void>;
};
const Context = createContext<BucketContext | null>(null);

export default function BucketListProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<BucketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyIds, setBusyIds] = useState(new Set<string>());
    const [version, setVersion] = useState(0);
    const inFlight = useRef(new Set<string>());

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            try {
                const response = await fetch("/api/bucket-list", { cache: "no-store", signal: controller.signal });
                const data = await response.json();
                if (!response.ok || !Array.isArray(data.items)) throw new Error(data.error || "Could not load your bucket list.");
                if (!controller.signal.aborted) setItems(data.items);
            } catch (error) {
                if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Please try again.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [version]);

    const reload = useCallback(() => {
        if (inFlight.current.size) return;
        setLoading(true);
        setError("");
        setVersion(value => value + 1);
    }, []);

    const change = useCallback(async (id: string, method: "POST" | "PATCH" | "DELETE", status?: BucketItem["status"]) => {
        if (inFlight.current.has(id)) return;
        inFlight.current.add(id);
        setBusyIds(new Set(inFlight.current));
        try {
            const response = await fetch("/api/bucket-list", {
                method, headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generationId: id, status }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not update your bucket list.");
            if (method !== "DELETE" && (!data.item || data.item.generation_id !== id)) throw new Error("Could not confirm your saved pick. Please refresh.");
            setItems(current => method === "DELETE"
                ? current.filter(item => item.generation_id !== id)
                : [data.item, ...current.filter(item => item.generation_id !== id)]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } finally {
            inFlight.current.delete(id);
            setBusyIds(new Set(inFlight.current));
        }
    }, []);

    return <Context.Provider value={{ items, loading, error, busyIds, reload, change }}>{children}</Context.Provider>;
}

export function useBucketList() {
    const context = useContext(Context);
    if (!context) throw new Error("Bucket list must be inside its provider.");
    return context;
}
