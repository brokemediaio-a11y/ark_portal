"use client";

import { CheckCheck, Copy, Mail, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { downloadBlob } from "./pdf-preview-card";

type ShareResult = "shared" | "cancelled" | "unsupported";

/**
 * Hands the PDF itself to the device's share menu (Mail, WhatsApp, Outlook…), with the message filled in. Links such
 * as mailto: and wa.me can only carry text, so this is the only way a browser can attach a file to an email or a chat.
 */
async function sharePdf(blob: Blob, fileName: string, title: string, text: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  if (typeof navigator === "undefined" || !navigator.canShare?.({ files: [file] })) return "unsupported";
  try {
    await navigator.share({ files: [file], title, text });
    return "shared";
  } catch (error) {
    // Closing the share menu is not an error; anything else falls back to download + link.
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

const digitsOnly = (phone: string | null) => (phone ?? "").replace(/\D/g, "");

interface SendPdfCardProps {
  title: string;
  blob: Blob | null;
  fileName: string;
  subject: string;
  message: string;
  email?: string | null;
  phone?: string | null;
  /** Called once the PDF has been shared or downloaded for sending. */
  onSent?: () => void;
}

/**
 * Email and WhatsApp with the PDF attached. Where the browser can share files (phones, Chrome and Edge on Windows and
 * macOS, Safari), the PDF goes straight into the chosen app. Elsewhere it is downloaded and the email or chat opens
 * with the message, for the PDF to be attached by hand.
 */
export function SendPdfCard({ title, blob, fileName, subject, message, email = null, phone = null, onSent }: SendPdfCardProps) {
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const number = digitsOnly(phone);

  const send = async (channel: "email" | "whatsapp") => {
    if (!blob) return;
    setNote(null);
    const result = await sharePdf(blob, fileName, subject, channel === "email" ? `${subject}\n\n${message}` : message);
    if (result === "cancelled") return;
    if (result === "unsupported") {
      downloadBlob(blob, fileName);
      if (channel === "email") window.location.href = `mailto:${encodeURIComponent(email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      else window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      setNote(`This browser can't attach files to ${channel === "email" ? "an email" : "WhatsApp"} by itself, so ${fileName} was downloaded: attach it before sending.`);
    }
    onSent?.();
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={Send} title={title} description="Sends the PDF with a ready-written message: pick Mail or WhatsApp, and the chat, in your device's share menu." />
      <CardBody className="space-y-3">
        <Button variant="secondary" icon={Mail} className="w-full" onClick={() => send("email")} disabled={!blob}>
          Email with PDF
        </Button>
        <Button variant="secondary" icon={MessageCircle} className="w-full" onClick={() => send("whatsapp")} disabled={!blob}>
          WhatsApp with PDF
        </Button>
        <Button variant="ghost" icon={copied ? CheckCheck : Copy} className="w-full" onClick={copyMessage}>
          {copied ? "Message copied" : "Copy message text"}
        </Button>
        {note && <p className="text-xs text-ink-muted" role="status">{note}</p>}
      </CardBody>
    </Card>
  );
}
