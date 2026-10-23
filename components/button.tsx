// Shim di compatibilità: il componente Button vive in components/ui/button.tsx
// (convenzione shadcn/ui). Questo re-export mantiene funzionanti eventuali
// import legacy che puntano a "@/components/button".
export * from "@/components/ui/button";
