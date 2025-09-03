/**
 * Input Components
 * Components for data input and file loading
 */

// Export components (none with custom UI yet)
export {};

// Export metadata for component library
export const inputsComponents = [
  {
    id: "csv-loader",
    name: "CSV Loader",
    description: "Load CSV files from local filesystem",
    icon: "📁",
    template: "inputs/csv_loader",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  // Future components:
  // { id: "json-loader", name: "JSON Loader", ... },
  // { id: "excel-loader", name: "Excel Loader", ... },
  // { id: "database-connector", name: "Database Connector", ... },
];