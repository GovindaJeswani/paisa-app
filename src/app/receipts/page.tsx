"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, Image, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReceiptsPage() {
  const [uploadedFile, setUploadedFile] = useState<{ name: string; preview: string } | null>(null);

  const handleUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.capture = "environment"; // Opens camera on mobile
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => setUploadedFile({ name: file.name, preview: ev.target?.result as string });
        reader.readAsDataURL(file);
      } else {
        setUploadedFile({ name: file.name, preview: "" });
      }
    };
    input.click();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-4">
      <h1 className="text-xl font-bold text-text-primary">Receipts & Screenshots</h1>

      {/* Upload area */}
      <button
        onClick={handleUpload}
        className="w-full card-elevated p-8 flex flex-col items-center gap-4 text-center hover:bg-surface-hover transition-colors active:scale-[0.98]"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light">
          <Camera size={28} className="text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary">Upload receipt or screenshot</h3>
          <p className="text-xs text-text-tertiary mt-1">Take a photo or upload from gallery</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium text-text-tertiary">📸 Photo</span>
          <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium text-text-tertiary">🖼️ Gallery</span>
          <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium text-text-tertiary">📄 PDF</span>
        </div>
      </button>

      {/* Uploaded preview */}
      {uploadedFile && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-4">
          <h3 className="text-sm font-bold text-text-primary mb-3">Uploaded: {uploadedFile.name}</h3>
          {uploadedFile.preview && (
            <div className="rounded-xl overflow-hidden mb-3 border border-border-light">
              <img src={uploadedFile.preview} alt="Receipt" className="w-full max-h-64 object-contain bg-surface-secondary" />
            </div>
          )}
          <div className="rounded-xl bg-surface-secondary p-3 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-text-primary">OCR extraction</p>
              <p className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed">
                In a production app, this image would be processed using OCR (Tesseract.js or a cloud service) to extract the amount, merchant, date, and items automatically. The extracted data would then populate a transaction form for your confirmation.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* How it works */}
      <div className="card-elevated p-4">
        <h3 className="text-sm font-bold text-text-primary mb-3">How it works</h3>
        <div className="space-y-3">
          {[
            { icon: "📸", step: "1", title: "Capture", description: "Take a photo of your receipt, UPI screenshot, or bank statement" },
            { icon: "🔍", step: "2", title: "Extract", description: "OCR reads the amount, merchant, date, and tax from the image" },
            { icon: "✏️", step: "3", title: "Confirm", description: "Review the extracted data and confirm or edit before saving" },
            { icon: "📁", step: "4", title: "Attach", description: "The receipt is saved as an attachment to the transaction" },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary text-sm shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">{item.title}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supported formats */}
      <div className="rounded-xl bg-surface-secondary p-3">
        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">Supported</p>
        <div className="flex flex-wrap gap-1.5">
          {["UPI screenshots", "Bank SMS screenshots", "Physical receipts", "Digital invoices", "Credit card slips", "PDF statements"].map((f) => (
            <span key={f} className="rounded-full border border-border-light bg-surface px-2.5 py-1 text-[10px] font-medium text-text-secondary">{f}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
