import BucketListProvider from "./bucket-list-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <BucketListProvider>{children}</BucketListProvider>;
}
