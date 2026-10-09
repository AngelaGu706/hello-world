"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Upload, UserRound, Utensils } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ProfilePage() {
    const router = useRouter();
    const [supabase] = useState(() => createClient());
    const [userId, setUserId] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState<"error" | "success">("error");
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [loadVersion, setLoadVersion] = useState(0);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const busyRef = useRef(false);
    const busy = loading || saving || uploading;

    useEffect(() => {
        let active = true;
        async function loadProfile() {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) throw new Error("Sign in to edit your profile.");
                const { data, error } = await supabase.from("profiles")
                    .select("first_name, last_name, avatar_url").eq("id", user.id).single();
                if (error) throw error;
                if (!active) return;
                setUserId(user.id);
                setFirstName(data.first_name ?? "");
                setLastName(data.last_name ?? "");
                setAvatarUrl(data.avatar_url ?? "");
                setAvatarFailed(false);
            } catch (error) {
                console.error(error);
                if (active) {
                    setLoadFailed(true);
                    setMessageType("error");
                    setMessage("Couldn’t load your profile. Try again or sign in.");
                }
            } finally {
                if (active) setLoading(false);
            }
        }
        void loadProfile();
        return () => { active = false; };
    }, [supabase, loadVersion]);

    async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busyRef.current || busy || !userId || loadFailed) return;
        busyRef.current = true;
        setSaving(true);
        setMessage("");
        try {
            const { error } = await supabase.from("profiles").update({
                first_name: firstName,
                last_name: lastName,
            }).eq("id", userId);
            if (error) throw error;
            setMessageType("success");
            setMessage("Saved. Returning home…");
            router.push("/dashboard");
        } catch (error) {
            console.error(error);
            setMessageType("error");
            setMessage("Couldn’t save. Your edits are still here. Try again.");
            setSaving(false);
            busyRef.current = false;
        }
    }

    async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !userId || busy || busyRef.current || loadFailed) return;
        if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
            setMessageType("error");
            setMessage("Choose an image up to 5 MB.");
            return;
        }
        busyRef.current = true;
        setUploading(true);
        setMessage("");
        try {
            const fileExt = file.name.split(".").pop();
            const filePath = `${userId}/avatar.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from("avatars")
                .upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
            const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
            const { error: updateError } = await supabase.from("profiles")
                .update({ avatar_url: publicUrl }).eq("id", userId);
            if (updateError) throw updateError;
            setAvatarUrl(publicUrl);
            setAvatarFailed(false);
            setMessageType("success");
            setMessage("Photo saved.");
        } catch (error) {
            console.error(error);
            setMessageType("error");
            setMessage("Couldn’t save your photo. Try again.");
        } finally {
            setUploading(false);
            busyRef.current = false;
        }
    }

    return (
        <main className="profile-page">
            <Link href="/dashboard" className="profile-wordmark community-wordmark">
                <Utensils size={22} aria-hidden="true" />NYC FOOD SPOTS
            </Link>
            <section className="profile-card" aria-labelledby="profile-title">
                <Link href="/dashboard" className="profile-back"><ArrowLeft size={16} aria-hidden="true" />Back to home</Link>
                <header className="profile-heading">
                    <h1 id="profile-title">Your profile</h1>
                    <p>Update your name and photo.</p>
                </header>
                <form onSubmit={saveProfile} aria-busy={busy}>
                    <fieldset disabled={busy || loadFailed || !userId} className="profile-fields">
                        <legend className="sr-only">Edit your profile</legend>
                        <div className="profile-photo-row">
                            <div className="profile-avatar-wrap">
                                {avatarUrl && !avatarFailed ? (
                                    <Image src={avatarUrl} alt="Your profile photo" width={80} height={80} unoptimized
                                        className="profile-avatar" onError={() => setAvatarFailed(true)} />
                                ) : <div className="profile-avatar profile-avatar-placeholder" aria-label="Profile photo placeholder">
                                    {firstName || lastName ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() : <UserRound size={30} aria-hidden="true" />}
                                </div>}
                            </div>
                            <div className="profile-photo-actions">
                                <label htmlFor="profile-photo" className="profile-upload-button">
                                    {uploading ? <LoaderCircle size={16} className="is-spinning" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                                    {uploading ? "Uploading…" : "Change photo"}
                                </label>
                                <input id="profile-photo" className="sr-only" type="file" accept="image/*" onChange={uploadAvatar} aria-describedby="photo-help" />
                                <p id="photo-help">Up to 5 MB. Saved automatically.</p>
                            </div>
                        </div>
                        <div className="profile-name-grid">
                            <div className="profile-field">
                                <label htmlFor="first-name">First name</label>
                                <input id="first-name" name="firstName" autoComplete="given-name" value={firstName}
                                    placeholder="First name" onChange={event => setFirstName(event.target.value)} />
                            </div>
                            <div className="profile-field">
                                <label htmlFor="last-name">Last name</label>
                                <input id="last-name" name="lastName" autoComplete="family-name" value={lastName}
                                    placeholder="Last name" onChange={event => setLastName(event.target.value)} />
                            </div>
                        </div>
                        <button type="submit" className="save-profile-button">
                            {loading || saving ? <LoaderCircle size={18} className="is-spinning" aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
                            {loading ? "Loading…" : saving ? "Saving…" : "Save changes"}
                            {!loading && !saving && <ArrowRight size={17} aria-hidden="true" />}
                        </button>
                    </fieldset>
                    <div aria-live="polite" aria-atomic="true">
                        {message && <p role={messageType === "error" ? "alert" : "status"} className={`profile-message is-${messageType}`}>{message}</p>}
                    </div>
                    {loadFailed && <div className="profile-recovery">
                        <button type="button" onClick={() => {
                            setLoading(true); setLoadFailed(false); setMessage(""); setLoadVersion(version => version + 1);
                        }}>Try again</button>
                        <Link href="/">Sign in</Link>
                    </div>}
                </form>
            </section>
        </main>
    );
}
