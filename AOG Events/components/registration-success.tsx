"use client";

import { CheckCircle, QrCode, Mail, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";

interface RegistrationSuccessProps {
  registrationId: string;
  email: string;
  onNewRegistration: () => void;
}

export function RegistrationSuccess({
  registrationId,
  email,
  onNewRegistration,
}: RegistrationSuccessProps) {
  const downloadQRCode = () => {
    const canvas = document.getElementById("qr-code-canvas") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `AOG-Registration-${registrationId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Registration Complete!
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Your registration has been successfully submitted. You will receive a
          confirmation email with your QR code shortly.
        </p>
      </div>

      <div className="p-6 rounded-lg bg-secondary max-w-sm mx-auto">
        <div className="text-sm text-muted-foreground mb-2">Registration ID</div>
        <div className="font-mono text-lg font-semibold text-foreground">
          {registrationId}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 p-6 rounded-lg border border-border bg-card max-w-sm mx-auto">
        <div className="p-4 bg-white rounded-lg shadow-sm border">
          <QRCodeCanvas
            id="qr-code-canvas"
            value={registrationId}
            size={160}
            level={"H"}
            includeMargin={true}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Your QR code will be sent to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Button variant="outline" onClick={downloadQRCode} className="gap-2">
          <Download className="h-4 w-4" />
          Download QR Code
        </Button>
        <Button variant="outline" className="gap-2">
          <Mail className="h-4 w-4" />
          Resend Email
        </Button>
      </div>

      <div className="pt-6 space-y-3">
        <Button onClick={onNewRegistration} variant="outline">
          Register Another Person
        </Button>
        <div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
