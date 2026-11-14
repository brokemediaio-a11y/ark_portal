import { requireUser } from "@/features/auth/server";
import { DatabaseManagement } from "@/features/auth/database-management";
export default async function DatabasePage() { await requireUser("database"); return <DatabaseManagement />; }
