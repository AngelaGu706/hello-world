import LoginButton from "./login-button";

export default function Home() {
    return (
        <main className="login-page">
            <div className="login-card">
                <div className="login-emoji">🥐</div>

                <p className="login-label">NYC FOOD SPOTS</p>

                <h1>Save your favorites.</h1>

                <LoginButton />
            </div>
        </main>
    );
}