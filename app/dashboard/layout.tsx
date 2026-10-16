import LocationProvider from "./location-provider";
import BucketListProvider from "./bucket-list-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <BucketListProvider><LocationProvider>{children}</LocationProvider></BucketListProvider>;
}
