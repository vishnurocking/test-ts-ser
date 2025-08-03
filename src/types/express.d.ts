// ts-server/src/types/express.d.ts
// Express type extensions

import { User } from './models';

declare global {
  namespace Express {
    interface Request {
      // User authentication
      id?: string; // User ID from JWT
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        points?: number;
        level?: number;
        streak?: number;
      };
      
      // File uploads (Multer)
      file?: Multer.File;
      files?: Multer.File[] | { [fieldname: string]: Multer.File[] };
      
      // Lambda context (for AWS deployment)
      event?: any;
      context?: any;
    }
  }
}

// Multer types
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

// Make this file a module
export {};