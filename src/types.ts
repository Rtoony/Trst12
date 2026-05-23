export interface UserProfile {
  uid: string;
  email: string;
  preferences: {
    lookFor: string[];
    ignore: string[];
  };
  createdAt?: string;
}

export interface StoredDocument {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  extractedContent: string;
  extractedJson: any;
  format: 'json' | 'md';
  createdAt: any;
}
