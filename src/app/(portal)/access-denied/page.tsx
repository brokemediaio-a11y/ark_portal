import Link from "next/link";
export default function AccessDenied() { return <div className="space-y-4 py-16"><h1 className="text-2xl font-bold text-brand">Access restricted</h1><p>Your role doesn’t include this tool. Ask your administrator if you need access.</p><Link href="/" className="text-brand underline">Back to home</Link></div>; }
