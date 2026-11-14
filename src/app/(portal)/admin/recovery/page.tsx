import { requireUser } from "@/features/auth/server";
import { RecoveryManagement } from "@/features/auth/recovery-management";
export default async function RecoveryPage() { await requireUser("recovery"); return <RecoveryManagement />; }
