declare module "exceljs" {
  type ColumnConfig = {
    header?: string;
    key?: string;
    width?: number;
  };

  export interface Worksheet {
    columns: ColumnConfig[];
    addRow(data: Record<string, unknown>): void;
    getRow(index: number): { font?: { bold?: boolean } };
    getColumn(index: number | string): { numFmt?: string };
  }

  export interface Workbook {
    addWorksheet(name: string): Worksheet;
    xlsx: {
      writeBuffer(): Promise<ArrayBuffer>;
    };
  }

  const ExcelJS: {
    Workbook: new () => Workbook;
  };

  export default ExcelJS;
}
