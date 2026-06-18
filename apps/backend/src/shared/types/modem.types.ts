export interface ModemConfig {
  portPath: string;
  country: string;
  simNumber: string;
}

export interface CusdParsedLine {
  status: number;
  message: string;
  dcs: number;
}
