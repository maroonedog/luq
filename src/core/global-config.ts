export interface GlobalConfig {
  messageKeyPrefix?: string;
  toBooleanTruthyValues?: string[];
  numberFormat?: {
    decimalSeparator?: string;
    thousandSeparator?: string;
  };
  dateFormat?: string;
  trimStrings?: boolean;
  caseSensitive?: boolean;
  customTransforms?: Record<string, (value: any) => any>;
}

// Default configuration
const defaultConfig: GlobalConfig = {
  messageKeyPrefix: "",
  toBooleanTruthyValues: ["true", "1", "yes", "on"],
  numberFormat: {
    decimalSeparator: ".",
    thousandSeparator: ",",
  },
  dateFormat: "YYYY-MM-DD",
  trimStrings: false,
  caseSensitive: true,
  customTransforms: {},
};

// Current configuration state
let currentConfig: GlobalConfig = { ...defaultConfig };

// Global config object with getter properties
export const globalConfig = {
  setConfig(config: Partial<GlobalConfig>): void {
    currentConfig = {
      ...currentConfig,
      ...config,
      numberFormat: config.numberFormat
        ? {
            ...currentConfig.numberFormat,
            ...config.numberFormat,
          }
        : currentConfig.numberFormat,
    };
  },

  getConfig(): GlobalConfig {
    return { ...currentConfig };
  },

  get messageKeyPrefix(): string {
    return currentConfig.messageKeyPrefix || "";
  },

  get toBooleanTruthyValues(): string[] {
    return [...(currentConfig.toBooleanTruthyValues || [])];
  },

  get numberFormat(): NonNullable<GlobalConfig["numberFormat"]> {
    return { ...currentConfig.numberFormat! };
  },

  get dateFormat(): string {
    return currentConfig.dateFormat || "YYYY-MM-DD";
  },

  get trimStrings(): boolean {
    return currentConfig.trimStrings || false;
  },

  get caseSensitive(): boolean {
    return currentConfig.caseSensitive !== false;
  },

  get customTransforms(): Record<string, (value: any) => any> {
    return { ...currentConfig.customTransforms! };
  },

  reset(): void {
    currentConfig = {
      ...defaultConfig,
      numberFormat: { ...defaultConfig.numberFormat! },
      toBooleanTruthyValues: [...defaultConfig.toBooleanTruthyValues!],
      customTransforms: { ...defaultConfig.customTransforms! },
    };
  }
};

export function setGlobalConfig(config: Partial<GlobalConfig>): void {
  globalConfig.setConfig(config);
}

export function getGlobalConfig(): GlobalConfig {
  return globalConfig.getConfig();
}

export function resetGlobalConfig(): void {
  globalConfig.reset();
}
