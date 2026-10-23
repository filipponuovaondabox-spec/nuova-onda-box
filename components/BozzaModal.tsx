"use client";

import { FileImage, FilePdf, DownloadSimple } from "@phosphor-icons/react";
import { Articolo } from "@/lib/model";
import { Modal, Btn } from "./ui-kit";

export default function BozzaModal({
  articolo,
  onClose,
}: {
  articolo: Articolo | null;
  onClose: () => void;
}) {
  const isPdf = articolo?.bozzaData?.startsWith("data:application/pdf") ?? false;

  return (
    <Modal
      open={!!articolo}
      title={`Bozza di stampa — ${articolo?.codice ?? ""}`}
      onClose={onClose}
      wide
    >
      {articolo?.bozzaData ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs text-[#4a5d50]">
            <span className="flex items-center gap-1.5">
              {isPdf ? <FilePdf size={16} /> : <FileImage size={16} />}
              {articolo.bozzaNome || "bozza"}
            </span>
            <a href={articolo.bozzaData} download={articolo.bozzaNome || "bozza"}>
              <Btn variant="secondary" className="!px-2.5 !py-1 text-xs">
                <DownloadSimple size={14} weight="bold" /> Scarica
              </Btn>
            </a>
          </div>
          {isPdf ? (
            <iframe
              src={articolo.bozzaData}
              title="Bozza di stampa (PDF)"
              className="h-[70vh] w-full rounded-lg border border-[#cfe3d2]"
            />
          ) : (
            <img
              src={articolo.bozzaData}
              alt={`Bozza di stampa ${articolo.codice}`}
              className="max-h-[70vh] w-full rounded-lg border border-[#cfe3d2] object-contain bg-[#f7faf5]"
            />
          )}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-[#4a5d50]">
          Nessuna bozza di stampa caricata per questo articolo.
        </p>
      )}
    </Modal>
  );
}
