interface D1Result<T = unknown> {
  results: T[];
  meta: {
    changes?: number;
    served_by_region?: string;
    served_by_primary?: boolean;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<{ success: boolean; meta: { changes?: number } }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<{ success: boolean; meta: { changes?: number } }[]>;
  withSession?(constraint?: string): Pick<D1Database, 'prepare' | 'batch'>;
}

type HeadersInit = Headers | Record<string, string> | [string, string][];

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Cache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
}

declare const caches: {
  default: Cache;
};
