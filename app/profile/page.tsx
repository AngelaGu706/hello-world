"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ProfilePage() {
    const supabase = createClient();

    const [userId, setUserId] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        async function loadProfile() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setMessage("Please log in first.");
                return;
            }

            setUserId(user.id);

            const { data, error } = await supabase
                .from("profiles")
                .select("first_name, last_name, avatar_url")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error(error);
                return;
            }

            if (data) {
                setFirstName(data.first_name ?? "");
                setLastName(data.last_name ?? "");
                setAvatarUrl(data.avatar_url ?? "");
            }
        }

        loadProfile();
    }, []);

    async function saveProfile() {
        if (!userId) {
            setMessage("Please log in first.");
            return;
        }

        const { error } = await supabase
            .from("profiles")
            .update({
                first_name: firstName,
                last_name: lastName,
            })
            .eq("id", userId);

        if (error) {
            console.error(error);
            setMessage("Error saving profile.");
        } else {
            setMessage("Profile saved!");
        }
    }

    async function uploadAvatar(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file || !userId) {
            return;
        }

        setMessage("Uploading...");

        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, file, {
                upsert: true,
            });

        if (uploadError) {
            console.error(uploadError);
            setMessage("Error uploading avatar.");
            return;
        }

        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const publicUrl = data.publicUrl;

        const { error: updateError } = await supabase
            .from("profiles")
            .update({
                avatar_url: publicUrl,
            })
            .eq("id", userId);

        if (updateError) {
            console.error(updateError);
            setMessage("Error saving avatar.");
            return;
        }

        setAvatarUrl(publicUrl);
        setMessage("Avatar uploaded!");
    }

    return (
        <main>
            <h1>Profile</h1>

            {avatarUrl && (
                <div>
                    <img
                        src={avatarUrl}
                        alt="Profile"
                        width={120}
                        height={120}
                    />
                </div>
            )}

            <div>
                <label>First name</label>
                <br />
                <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                />
            </div>

            <br />

            <div>
                <label>Last name</label>
                <br />
                <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                />
            </div>

            <br />

            <div>
                <label>Profile picture</label>
                <br />
                <input
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                />
            </div>

            <br />

            <button onClick={saveProfile}>
                Save Profile
            </button>

            {message && <p>{message}</p>}
        </main>
    );
}