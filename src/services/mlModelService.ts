export interface ModelMetadata {
  accuracy: number;
  precision: number;
  recall: number;
  timestamp: string;
  feature_names: string[];
}

export interface XGBNode {
  nodeid: number;
  depth?: number;
  split?: number;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  leaf?: number;
  children?: XGBNode[];
}

export class MLModelService {
  private metadata: ModelMetadata | null = null;
  private isReady: boolean = false;

  async init() {
    if (this.isReady) return;
    try {
      console.log('Fetching model metadata...');
      const metaRes = await fetch('/models/url_model_metadata.json');
      
      if (metaRes.ok) {
        this.metadata = await metaRes.json();
        this.isReady = true;
      }
      
      console.log('ML Metadata status:', this.isReady ? 'READY' : 'UNAVAILABLE');
    } catch (err) {
      console.error('Failed to load ML metadata:', err);
      // We set isReady to true anyway because the backend handles prediction now
      this.isReady = true; 
    }
  }

  getMetadata() {
    return this.metadata;
  }

  checkReady() {
    // Always ready because prediction is now server-side
    return true;
  }
}



export const mlModelService = new MLModelService();

