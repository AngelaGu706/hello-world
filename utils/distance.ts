export type Coordinates = { latitude: number; longitude: number };

export function isCoordinates(value: unknown): value is Coordinates {
    const point = value as Coordinates | null;
    return !!point && typeof point.latitude === "number" && typeof point.longitude === "number" &&
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
        Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export function haversineMiles(from: Coordinates, to: Coordinates): number {
    if (!isCoordinates(from) || !isCoordinates(to)) throw new Error("Invalid coordinates");
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2 +
        Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) *
        Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
    return 3958.7613 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}

export function formatDistance(miles: number): string {
    if (miles < 0.1) return "Less than 0.1 miles away";
    return `About ${miles.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} miles away`;
}

// Called only by the location button. No browser position object leaves this helper.
export function requestCurrentLocation(secure: boolean, geolocation?: Geolocation): Promise<Coordinates> {
    if (!secure) return Promise.reject(new Error("Location needs HTTPS or localhost. Open the secure site and try again."));
    if (!geolocation) return Promise.reject(new Error("This browser doesn’t support location. You can still explore picks."));
    return new Promise((resolve, reject) => {
        // A separate deadline also covers browsers that leave a permission prompt unanswered.
        const deadline = setTimeout(() => reject(new Error("Location took too long. Please try again.")), 15000);
        try {
            geolocation.getCurrentPosition(position => {
                clearTimeout(deadline);
                const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                if (isCoordinates(point)) resolve(point);
                else reject(new Error("Couldn’t read your location. Please try again."));
            }, error => {
                clearTimeout(deadline);
                reject(new Error(error.code === 1
                    ? "Location access is off. Allow it in your browser’s site settings, then try again. You can still explore picks."
                    : error.code === 3 ? "Location took too long. Please try again."
                        : "Your location is unavailable. Please try again. You can still explore picks."));
            }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
        } catch {
            clearTimeout(deadline);
            reject(new Error("Couldn’t read your location. Please try again."));
        }
    });
}
