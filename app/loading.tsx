import { LoaderCircle, Utensils } from "lucide-react";

export default function Loading() {
    return <main className="login-page">
        <div className="auth-loading" role="status">
            <p className="community-wordmark"><Utensils size={22} aria-hidden="true" />NYC FOOD SPOTS</p>
            <p><LoaderCircle size={18} className="is-spinning" aria-hidden="true" />Getting things ready…</p>
        </div>
    </main>;
}
