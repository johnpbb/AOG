"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  QrCode,
  Search,
  CheckCircle,
  XCircle,
  User,
  Clock,
  AlertCircle,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckInResult {
  success: boolean;
  registrationId: string;
  name: string;
  category: string;
  venue: string;
  message: string;
  alreadyCheckedIn?: boolean;
}

const recentCheckIns = [
  {
    id: "AOG100-ABC123",
    name: "John Smith",
    time: "2 min ago",
    venue: "Main Arena",
  },
  {
    id: "AOG100-DEF456",
    name: "Grace Church",
    time: "5 min ago",
    venue: "Main Arena",
  },
  {
    id: "AOG100-GHI789",
    name: "Mary Johnson",
    time: "8 min ago",
    venue: "Conference Hall",
  },
];

export function CheckInSystem() {
  const [manualId, setManualId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);

  const handleManualCheckIn = () => {
    if (!manualId.trim()) return;

    // Simulate check-in
    const isValid = manualId.startsWith("AOG100-");
    const alreadyCheckedIn = Math.random() > 0.8;

    setLastResult({
      success: isValid && !alreadyCheckedIn,
      registrationId: manualId,
      name: isValid ? "Sample Attendee" : "Unknown",
      category: isValid ? "Individual" : "Unknown",
      venue: "Main Arena",
      message: !isValid
        ? "Invalid registration ID"
        : alreadyCheckedIn
        ? "Already checked in at 10:30 AM"
        : "Check-in successful!",
      alreadyCheckedIn,
    });

    setManualId("");
  };

  const toggleScanner = () => {
    setIsScanning(!isScanning);
    if (!isScanning) {
      // Simulate QR scan after 2 seconds
      setTimeout(() => {
        setLastResult({
          success: true,
          registrationId: "AOG100-SCAN" + Date.now().toString(36).toUpperCase(),
          name: "Scanned Attendee",
          category: "Large Church",
          venue: "Main Arena",
          message: "Check-in successful!",
        });
        setIsScanning(false);
      }, 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Check-In System</h1>
        <p className="text-muted-foreground">
          Scan QR codes or manually enter registration IDs for attendee check-in.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scanner Preview */}
            <div
              className={cn(
                "aspect-square max-w-sm mx-auto rounded-lg border-2 border-dashed flex items-center justify-center transition-colors",
                isScanning
                  ? "border-primary bg-primary/5"
                  : "border-border bg-secondary/30"
              )}
            >
              {isScanning ? (
                <div className="text-center">
                  <div className="relative">
                    <Camera className="h-16 w-16 text-primary animate-pulse" />
                    <div className="absolute inset-0 border-2 border-primary rounded-lg animate-ping" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Scanning for QR code...
                  </p>
                </div>
              ) : (
                <div className="text-center p-8">
                  <QrCode className="h-16 w-16 text-muted-foreground mx-auto" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Click the button below to start scanning
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={toggleScanner}
              className={cn("w-full gap-2", isScanning && "bg-destructive")}
            >
              {isScanning ? (
                <>
                  <XCircle className="h-4 w-4" />
                  Stop Scanning
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Start Scanner
                </>
              )}
            </Button>

            {/* Manual Entry */}
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">
                Or enter registration ID manually:
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="AOG100-XXXXXX"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleManualCheckIn()}
                    className="pl-9 font-mono"
                  />
                </div>
                <Button onClick={handleManualCheckIn}>Check In</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Result Section */}
        <div className="space-y-6">
          {/* Last Result */}
          {lastResult && (
            <Card
              className={cn(
                "border-2",
                lastResult.success
                  ? "border-green-500 bg-green-50"
                  : lastResult.alreadyCheckedIn
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-red-500 bg-red-50"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-full",
                      lastResult.success
                        ? "bg-green-100"
                        : lastResult.alreadyCheckedIn
                        ? "bg-yellow-100"
                        : "bg-red-100"
                    )}
                  >
                    {lastResult.success ? (
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    ) : lastResult.alreadyCheckedIn ? (
                      <AlertCircle className="h-8 w-8 text-yellow-600" />
                    ) : (
                      <XCircle className="h-8 w-8 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3
                      className={cn(
                        "text-lg font-semibold",
                        lastResult.success
                          ? "text-green-700"
                          : lastResult.alreadyCheckedIn
                          ? "text-yellow-700"
                          : "text-red-700"
                      )}
                    >
                      {lastResult.message}
                    </h3>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{lastResult.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">
                          {lastResult.registrationId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {lastResult.category} | {lastResult.venue}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Check-Ins */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Check-Ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentCheckIns.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {checkIn.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {checkIn.id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {checkIn.time}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {checkIn.venue}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">1,234</div>
                <div className="text-xs text-muted-foreground">Checked In</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-foreground">15,234</div>
                <div className="text-xs text-muted-foreground">Total Expected</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">8.1%</div>
                <div className="text-xs text-muted-foreground">Check-In Rate</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
