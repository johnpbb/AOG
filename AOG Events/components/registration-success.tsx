"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";

interface BankDetails {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
}

interface RegistrationSuccessProps {
  registrationId: string;
  email: string;
  paymentMethod?: "bank-transfer" | "online" | string;
  fee?: number;
  numberOfTickets?: number;
  onNewRegistration: () => void;
}

// ── Pending (bank transfer) variant ─────────────────────────────────────────

function PendingScreen({
  registrationId,
  email,
  fee,
  numberOfTickets,
  onNewRegistration,
}: Omit<RegistrationSuccessProps, "paymentMethod">) {
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/bank-details")
      .then((r) => r.json())
      .then(setBank)
      .catch(() => setBank({ bankName: "", bankAccountName: "", bankAccountNumber: "", bankBranch: "" }));
  }, []);

  function copyRef() {
    navigator.clipboard.writeText(registrationId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasBankDetails = bank && bank.bankAccountNumber;

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="h-10 w-10 text-amber-600" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-foreground">Registration Received</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Your registration is <span className="font-semibold text-amber-600">pending payment verification</span>. Once our team confirms your bank transfer, your tickets will be emailed to{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>

      {/* Reference ID */}
      <div className="p-4 rounded-lg bg-secondary max-w-sm mx-auto space-y-1">
        <div className="text-xs text-muted-foreground">Your Reference Number</div>
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-lg font-semibold text-foreground">{registrationId}</span>
          <button onClick={copyRef} className="text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Use this as your payment reference</p>
      </div>

      {/* Bank details */}
      {hasBankDetails ? (
        <div className="max-w-sm mx-auto rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-5 text-left space-y-3">
          <p className="text-sm font-semibold text-foreground">Bank Transfer Details</p>
          <div className="space-y-2 text-sm">
            {bank.bankName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-medium text-foreground">{bank.bankName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Name</span>
              <span className="font-medium text-foreground">{bank.bankAccountName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Number</span>
              <span className="font-mono font-semibold text-foreground">{bank.bankAccountNumber}</span>
            </div>
            {bank.bankBranch && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch</span>
                <span className="font-medium text-foreground">{bank.bankBranch}</span>
              </div>
            )}
            {fee !== undefined && (
              <div className="flex justify-between border-t border-amber-200 dark:border-amber-900/40 pt-2">
                <span className="text-muted-foreground">Amount (FJD)</span>
                <span className="font-bold text-foreground">${fee.toLocaleString()}.00</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono font-semibold text-foreground">{registrationId}</span>
            </div>
          </div>
        </div>
      ) : bank !== null && !hasBankDetails ? (
        <div className="max-w-sm mx-auto p-4 rounded-lg bg-secondary text-sm text-muted-foreground text-center">
          Bank details will be emailed to you shortly.
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        A confirmation email with these details has been sent to <span className="font-medium text-foreground">{email}</span>. Tickets will be emailed once your transfer is verified — usually within 1–2 business days.
      </p>

      <div className="pt-2 space-y-3">
        <Button onClick={onNewRegistration} variant="outline">
          Register Another Church
        </Button>
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Completed (ANZ online) variant ───────────────────────────────────────────

function CompletedScreen({
  registrationId,
  email,
  onNewRegistration,
}: Pick<RegistrationSuccessProps, "registrationId" | "email" | "onNewRegistration">) {
  function downloadQRCode() {
    const canvas = document.getElementById("qr-code-canvas") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `AOG-Registration-${registrationId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-foreground">Registration Complete!</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Your registration has been successfully submitted. You will receive a confirmation email with your QR code shortly.
        </p>
      </div>

      <div className="p-6 rounded-lg bg-secondary max-w-sm mx-auto">
        <div className="text-sm text-muted-foreground mb-2">Registration ID</div>
        <div className="font-mono text-lg font-semibold text-foreground">{registrationId}</div>
      </div>

      <div className="flex flex-col items-center gap-4 p-6 rounded-lg border border-border bg-card max-w-sm mx-auto">
        <div className="p-4 bg-white rounded-lg shadow-sm border">
          <QRCodeCanvas id="qr-code-canvas" value={registrationId} size={160} level="H" includeMargin />
        </div>
        <p className="text-sm text-muted-foreground">
          Your QR code will be sent to <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Button variant="outline" onClick={downloadQRCode} className="gap-2">
          <Download className="h-4 w-4" /> Download QR Code
        </Button>
      </div>

      <div className="pt-6 space-y-3">
        <Button onClick={onNewRegistration} variant="outline">Register Another Person</Button>
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function RegistrationSuccess(props: RegistrationSuccessProps) {
  if (props.paymentMethod === "bank-transfer") {
    return <PendingScreen {...props} />;
  }
  return <CompletedScreen {...props} />;
}
