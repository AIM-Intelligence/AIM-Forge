/**
 * Report Components
 * Components for analysis and reporting
 */

// Export components (none with custom UI yet)
export {};

// Export metadata for component library
export const reportsComponents = [
  {
    id: "asr-measurement",
    name: "ASR Measurement",
    description: "Attack Success Rate measurement",
    icon: "📈",
    template: "reports/asr_measurement",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  // Future components:
  // { id: "report-generator", name: "Report Generator", ... },
  // { id: "data-visualizer", name: "Data Visualizer", ... },
  // { id: "metrics-dashboard", name: "Metrics Dashboard", ... },
];